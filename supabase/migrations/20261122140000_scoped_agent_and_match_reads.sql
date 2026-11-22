-- Each request uses the anon API key and the existing Vault-backed cron credential.
-- The credential authorizes only these operations, with fixed SQL and bounded inputs.
create extension if not exists pgcrypto with schema extensions;

alter table public.agent_runs add column work_until timestamptz;

create function private.agent_match_snapshot(p_match_id uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id, 'title', m.title, 'status', m.status, 'min_players', m.min_players,
    'max_players', m.max_players, 'confirmation_deadline', m.confirmation_deadline,
    'agent_enabled', m.agent_enabled,
    'slot', jsonb_build_object('field_id', s.field_id, 'starts_at', s.starts_at,
      'ends_at', s.ends_at, 'field', jsonb_build_object('name', f.name)),
    'registrations', jsonb_build_array(jsonb_build_object('count', private.active_count(m.id)))
  )
  from public.matches m join public.slots s on s.id = m.slot_id
  join public.fields f on f.id = s.field_id where m.id = p_match_id;
$$;

create function public.agent_repository(p_secret text, p_operation text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text;
  v_match uuid;
  v_run uuid;
  v_player uuid;
  v_slot uuid;
  v_position int;
  v_result text := p_args ->> 'result';
  v_now timestamptz := now();
  v_data jsonb;
  v_changed int;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'agent_tick_secret';
  if v_secret is null or v_secret = '' or p_secret is null
     or extensions.digest(p_secret, 'sha256') <> extensions.digest(v_secret, 'sha256') then
    raise insufficient_privilege using message = 'Agent credential is invalid';
  end if;

  v_match := (p_args ->> 'match_id')::uuid;
  v_run := (p_args ->> 'run_id')::uuid;
  v_player := (p_args ->> 'user_id')::uuid;
  v_slot := (p_args ->> 'slot_id')::uuid;
  v_position := (p_args ->> 'position')::int;

  case p_operation
    when 'running_rescues' then
      select jsonb_agg(jsonb_build_object('id', r.id, 'match_id', r.match_id, 'passes', r.passes,
        'next_check_at', r.next_check_at, 'match', private.agent_match_snapshot(r.match_id)))
        into v_data from public.agent_runs r where r.kind = 'rescue' and r.status = 'running';
    when 'pending_matches' then
      select jsonb_agg(private.agent_match_snapshot(m.id) order by m.confirmation_deadline) into v_data
        from public.matches m where m.status = 'pending' and m.agent_enabled and m.confirmation_deadline > v_now;
    when 'claim_rescue' then
      if (p_args ->> 'pass')::int = 0 then
        insert into public.agent_runs(kind, match_id, work_until)
        select 'rescue', m.id, v_now + interval '2 minutes' from public.matches m
        where m.id = v_match and m.status = 'pending' and m.agent_enabled and m.confirmation_deadline > v_now
        on conflict (match_id) where kind = 'rescue' do update set work_until = excluded.work_until
        where agent_runs.status = 'running' and agent_runs.passes = 0
          and coalesce(agent_runs.work_until, '-infinity'::timestamptz) <= v_now
        returning to_jsonb(id) into v_data;
      elsif (p_args ->> 'pass')::int = 1 then
        update public.agent_runs set work_until = v_now + interval '2 minutes'
        where kind = 'rescue' and match_id = v_match and status = 'running'
          and passes = 1 and next_check_at <= v_now
          and coalesce(work_until, '-infinity'::timestamptz) <= v_now
        returning to_jsonb(id) into v_data;
      end if;
    when 'finish_rescue' then
      update public.agent_runs
      set status = (p_args ->> 'status')::public.agent_run_status,
        outcome = p_args ->> 'outcome', next_check_at = null, work_until = null, finished_at = v_now
      where id = v_run and kind = 'rescue' and status = 'running';
    when 'save_pass' then
      update public.agent_runs
      set passes = (p_args ->> 'passes')::int, next_check_at = (p_args ->> 'next')::timestamptz,
        engine = coalesce(p_args ->> 'engine', engine), work_until = null
      where id = v_run and kind = 'rescue' and status = 'running'
        and passes + 1 = (p_args ->> 'passes')::int and passes < 2;
    when 'accepted_count' then
      select jsonb_build_object('invited', count(*), 'accepted', count(*) filter (where exists (
        select 1 from public.registrations r where r.match_id = v_match and r.player_id = n.user_id
          and r.status = 'active' and r.created_at >= n.created_at
      ))) into v_data from public.notices n where n.match_id = v_match and n.kind = 'invite';
    when 'candidates' then
      if exists(select 1 from public.matches where id = v_match and status = 'pending' and agent_enabled and confirmation_deadline > v_now) then
        select coalesce(jsonb_agg(candidate - 'full_name' order by position), '[]'::jsonb) into v_data
        from jsonb_array_elements(public.agent_candidates(v_match, least(10, greatest(1, (p_args ->> 'limit')::int))))
          with ordinality as ranked(candidate, position);
        return v_data;
      end if;
      return '[]'::jsonb;
    when 'invite' then
      perform 1 from public.matches where id = v_match and status = 'pending' and agent_enabled
        and confirmation_deadline > v_now for update;
      if not found then return 'false'::jsonb; end if;
      insert into public.notices(user_id, kind, match_id, data)
      select v_player, 'invite', v_match, jsonb_build_object('reason', left(p_args ->> 'reason', 200), 'missing', p_args -> 'missing')
      where (select count(*) from public.notices where match_id = v_match and kind = 'invite') < 10
        and exists(select 1 from jsonb_array_elements(public.agent_candidates(v_match, 10)) candidate
          where candidate ->> 'id' = v_player::text)
      on conflict do nothing;
      get diagnostics v_changed = row_count;
      return to_jsonb(v_changed = 1);
    when 'extend_deadline' then
      if exists(select 1 from public.matches m join public.slots s on s.id = m.slot_id
        where m.id = v_match and m.status = 'pending' and m.agent_enabled
          and m.confirmation_deadline > v_now and s.starts_at - interval '1 hour' = (p_args ->> 'deadline')::timestamptz
          and m.confirmation_deadline < s.starts_at - interval '1 hour') then
        begin
          return to_jsonb(public.agent_extend_deadline(v_match, (p_args ->> 'deadline')::timestamptz));
        exception when raise_exception then
          if sqlerrm <> 'cannot_extend' then raise; end if;
        end;
      end if;
    when 'move_options' then
      return public.agent_move_options(v_match);
    when 'propose' then
      insert into public.move_proposals(match_id, run_id, to_slot_id, reason)
      select v_match, v_run, v_slot, left(coalesce(p_args ->> 'reason', ''), 200)
      where exists(select 1 from public.agent_runs r join public.matches m on m.id = r.match_id
        where r.id = v_run and r.match_id = v_match and r.kind = 'rescue'
          and r.status = 'running' and m.status = 'pending' and m.agent_enabled and m.confirmation_deadline > v_now)
        and exists(select 1 from jsonb_array_elements(public.agent_move_options(v_match)) slot
          where slot ->> 'slot_id' = v_slot::text)
      on conflict do nothing;
      get diagnostics v_changed = row_count;
      return to_jsonb(v_changed = 1);
    when 'set_step' then
      insert into public.agent_steps(run_id, position, title, result, state)
      select v_run, v_position, left(p_args ->> 'title', 150), left(v_result, 200), (p_args ->> 'state')::public.agent_step_state
      where v_position between 1 and 7 and exists(select 1 from public.agent_runs where id = v_run and status = 'running')
      on conflict (run_id, position) do update
      set title = excluded.title, result = excluded.result, state = excluded.state, updated_at = v_now;
    when 'update_step' then
      update public.agent_steps set state = 'done', result = left(v_result, 200), updated_at = v_now
      where run_id = v_run and position = v_position;
    when 'close_steps' then
      update public.agent_steps set state = 'done', result = left(v_result, 200), updated_at = v_now
      where run_id = v_run and state in ('running', 'queued');
    when 'begin_reactivation' then
      perform pg_advisory_xact_lock(628071, 1);
      update public.agent_runs set work_until = v_now + interval '2 minutes'
      where id = (
        select id from public.agent_runs where kind = 'reactivation' and status = 'running'
          and started_at > v_now - interval '7 days'
          and coalesce(work_until, started_at + interval '2 minutes') <= v_now
        order by started_at desc limit 1
      ) returning to_jsonb(id) into v_data;
      if not found then
        insert into public.agent_runs(kind, work_until)
        select 'reactivation', v_now + interval '2 minutes' where not exists(select 1 from public.agent_runs
          where kind = 'reactivation' and started_at > v_now - interval '7 days')
        returning to_jsonb(id) into v_data;
      end if;
    when 'inactive_players' then
      select coalesce(jsonb_agg(player - 'full_name'), '[]'::jsonb) into v_data
        from jsonb_array_elements(public.agent_inactive_players()) player;
    when 'open_matches' then
      select jsonb_agg(private.agent_match_snapshot(m.id) order by s.starts_at) into v_data
      from public.matches m join public.slots s on s.id = m.slot_id
      where m.status <> 'cancelled' and s.starts_at between v_now + interval '3 hours' and v_now + interval '7 days';
    when 'suggest' then
      perform pg_advisory_xact_lock(628071, 2);
      insert into public.notices(user_id, kind, match_id, data)
      select v_player, 'reactivation', v_match, jsonb_build_object('last_played_at', p_args -> 'last_played_at', 'left', p_args -> 'left')
      where exists(select 1 from public.profiles p where p.id = v_player and p.role = 'player')
        and exists(select 1 from public.matches m join public.slots s on s.id = m.slot_id
          where m.id = v_match and m.status <> 'cancelled' and m.confirmation_deadline > v_now
            and s.starts_at between v_now + interval '3 hours' and v_now + interval '7 days'
            and private.active_count(m.id) < m.max_players)
        and not exists(select 1 from public.registrations r
          where r.player_id = v_player and r.match_id = v_match and r.status = 'active')
        and not exists(select 1 from public.notices n where n.user_id = v_player and n.kind = 'reactivation'
          and n.created_at > v_now - interval '7 days');
      get diagnostics v_changed = row_count;
      return to_jsonb(v_changed = 1);
    when 'finish_reactivation' then
      update public.agent_runs set status = 'finished', outcome = 'sent', passes = 1, work_until = null, finished_at = v_now
      where id = v_run and kind = 'reactivation' and status = 'running';
    else
      raise invalid_parameter_value using message = 'Unknown agent operation';
  end case;
  return v_data;
end;
$$;

revoke all on function private.agent_match_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.agent_repository(text, text, jsonb) from public, authenticated;
grant execute on function public.agent_repository(text, text, jsonb) to anon;

-- A computed relationship gives PostgREST clients capacity without exposing registrations.
create function public.match_capacity(public.matches)
returns table (count int)
language sql stable security definer set search_path = ''
as $$
  select private.active_count($1.id);
$$;

create function public.my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select private.user_role();
$$;

create function public.admin_profiles(p_role public.user_role default null)
returns table (id uuid, full_name text, role public.user_role)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.full_name, p.role from public.profiles p
  where private.is_admin() and (p_role is null or p.role = p_role)
  order by p.full_name;
$$;

revoke all on function public.match_capacity(public.matches), public.my_role(), public.admin_profiles(public.user_role)
  from public, anon;
grant execute on function public.match_capacity(public.matches), public.my_role(), public.admin_profiles(public.user_role)
  to authenticated;

-- Only an admin can load the facts used by the impact dashboard.
create function public.agent_impact_facts(p_since timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_facts jsonb;
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
  with outcomes as (
    select r.match_id, r.outcome
    from public.agent_runs r where r.kind = 'rescue' and r.started_at > p_since
  ), returning_players as (
    select distinct r.match_id, r.player_id
    from public.notices n
    join public.registrations r on r.player_id = n.user_id and r.match_id = n.match_id
    where n.kind = 'reactivation' and n.created_at > p_since
      and r.status = 'active' and r.created_at > n.created_at
  ), affected as (
    select match_id from outcomes where outcome = 'rescued'
    union select match_id from returning_players
  )
  select jsonb_build_object(
    'outcomes', coalesce((select jsonb_agg(outcome) from outcomes), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(facts) from (
      select jsonb_build_object(
        'startsAt', s.starts_at, 'endsAt', s.ends_at,
        'active', count(r.id), 'present', count(r.id) filter (where r.attendance = 'present'),
        'returning', coalesce(jsonb_agg(r.player_id) filter (where rr.player_id is not null and r.attendance = 'present'), '[]'::jsonb)
      ) as facts
      from public.matches m
      join public.slots s on s.id = m.slot_id
      join affected a on a.match_id = m.id
      left join lateral (
        select reg.* from public.registrations reg where reg.match_id = m.id and reg.status = 'active'
          and (exists(select 1 from outcomes o where o.match_id = m.id and o.outcome = 'rescued')
            or exists(select 1 from returning_players ret where ret.match_id = m.id and ret.player_id = reg.player_id))
      ) r on true
      left join returning_players rr on rr.match_id = m.id and rr.player_id = r.player_id
      where m.status = 'confirmed'
      group by m.id, s.starts_at, s.ends_at
      ) per_match
    ), '[]'::jsonb)
  ) into v_facts;
  return v_facts;
end;
$$;
revoke all on function public.agent_impact_facts(timestamptz) from public, anon;
grant execute on function public.agent_impact_facts(timestamptz) to authenticated;
