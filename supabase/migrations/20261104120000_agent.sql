-- Agente Retta (docs/decisions.md, 2026-11-04): an agent that makes matches
-- happen. It rescues pending matches near their confirmation deadline
-- (invites similar players, extends the deadline, proposes another slot) and
-- weekly suggests a match to players who stopped playing.
--
-- The agent itself runs in the app (/api/agente/tick) with the service role.
-- This migration adds what it reads and writes, the in-app notices inbox, the
-- organizer's approval of a move, and the cron job that wakes the agent.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Matches: the organizer can stop the agent
-- ---------------------------------------------------------------------------

alter table public.matches add column agent_enabled boolean not null default true;
grant update (agent_enabled) on public.matches to authenticated;

-- The edit lock ("match_has_registrations") does not apply to the agent's own
-- changes (extending the deadline, an approved move). Those set the
-- transaction-local flag retta.agent = on. Deadline rules still apply.
create or replace function private.validate_match()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_starts_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'cancelled' then
      raise exception 'match_cancelled';
    end if;
    if coalesce(current_setting('retta.agent', true), '') <> 'on'
       and exists (select 1 from public.registrations where match_id = new.id) then
      raise exception 'match_has_registrations';
    end if;
  end if;

  select starts_at into v_starts_at from public.slots where id = new.slot_id;

  if v_starts_at <= now() then
    raise exception 'slot_in_past';
  end if;

  new.confirmation_deadline := date_trunc('minute',
    coalesce(new.confirmation_deadline, v_starts_at - interval '3 hours'));

  if new.confirmation_deadline > v_starts_at - interval '1 hour' then
    raise exception 'deadline_too_late';
  end if;
  if (new.confirmation_deadline at time zone 'America/Mexico_City')::date
     <> (v_starts_at at time zone 'America/Mexico_City')::date then
    raise exception 'deadline_not_same_day';
  end if;
  if new.confirmation_deadline <= now() then
    raise exception 'deadline_in_past';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notices (in-app inbox; no email or push)
-- ---------------------------------------------------------------------------

create type public.notice_kind as enum ('invite', 'reactivation', 'match_confirmed', 'match_cancelled', 'match_moved');

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notice_kind not null,
  match_id uuid references public.matches (id) on delete cascade,
  -- Kind-specific details, e.g. credit_cents, from_starts_at, rescued.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  dismissed_at timestamptz
);

create index notices_user_id_idx on public.notices (user_id, created_at desc);
-- The agent invites a player to a given match at most once.
create unique index notices_one_invite on public.notices (user_id, match_id) where kind = 'invite';

alter table public.notices enable row level security;

create policy "Users read their own notices"
on public.notices for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users mark their own notices"
on public.notices for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on public.notices from anon, authenticated;
grant select on public.notices to authenticated;
grant update (read_at, dismissed_at) on public.notices to authenticated;

-- Players hear when a match they joined is confirmed, cancelled (with the
-- credit they got back) or moved. Runs right after the status update, while
-- sign-ups are still active (private.cancel_match updates them afterwards).
create function private.notify_match_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_rescued boolean;
begin
  if new.status = 'confirmed' and old.status = 'pending' then
    v_rescued := exists (select 1 from public.agent_runs where match_id = new.id and kind = 'rescue');
    insert into public.notices (user_id, kind, match_id, data)
    select r.player_id, 'match_confirmed', new.id, jsonb_build_object('rescued', v_rescued)
    from public.registrations r
    where r.match_id = new.id and r.status = 'active';
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    insert into public.notices (user_id, kind, match_id, data)
    select r.player_id, 'match_cancelled', new.id,
      jsonb_build_object('credit_cents', private.paid_cents(r.id), 'reason', new.cancel_reason)
    from public.registrations r
    where r.match_id = new.id and r.status = 'active';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Agent runs and their steps (what the organizer sees as a task list)
-- ---------------------------------------------------------------------------

create type public.agent_run_kind as enum ('rescue', 'reactivation');
create type public.agent_run_status as enum ('running', 'finished', 'stopped');
create type public.agent_step_state as enum ('done', 'running', 'queued');

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  kind public.agent_run_kind not null,
  match_id uuid references public.matches (id) on delete cascade,
  status public.agent_run_status not null default 'running',
  -- rescued | not_rescued for rescues, sent for reactivation.
  outcome text check (outcome in ('rescued', 'not_rescued', 'sent')),
  -- Model that planned the run, or 'rules' when the fallback did.
  engine text not null default 'rules',
  passes int not null default 0,
  next_check_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint agent_runs_match check ((kind = 'rescue') = (match_id is not null))
);

create unique index agent_runs_one_rescue on public.agent_runs (match_id) where kind = 'rescue';
create index agent_runs_started_at_idx on public.agent_runs (started_at desc);

create table public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  position int not null,
  title text not null,
  result text,
  state public.agent_step_state not null,
  updated_at timestamptz not null default now(),
  unique (run_id, position)
);

alter table public.agent_runs enable row level security;
alter table public.agent_steps enable row level security;

create policy "Organizers and admins read agent runs"
on public.agent_runs for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.matches m
    where m.id = match_id and m.organizer_id = (select auth.uid())
  )
);

create policy "Organizers and admins read agent steps"
on public.agent_steps for select to authenticated
using (
  exists (select 1 from public.agent_runs r where r.id = run_id)
);

revoke all on public.agent_runs, public.agent_steps from anon, authenticated;
grant select on public.agent_runs, public.agent_steps to authenticated;

create trigger notify_match_status
after update of status on public.matches
for each row execute function private.notify_match_status();

-- ---------------------------------------------------------------------------
-- Move proposals: the agent proposes, the organizer decides
-- ---------------------------------------------------------------------------

create table public.move_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  run_id uuid references public.agent_runs (id) on delete set null,
  to_slot_id uuid not null references public.slots (id),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create unique index move_proposals_one_pending on public.move_proposals (match_id) where status = 'pending';

alter table public.move_proposals enable row level security;

create policy "Organizers and admins read move proposals"
on public.move_proposals for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.matches m
    where m.id = match_id and m.organizer_id = (select auth.uid())
  )
);

revoke all on public.move_proposals from anon, authenticated;
grant select on public.move_proposals to authenticated;

-- The agent (service role) writes runs, steps, notices and proposals.
grant select, insert, update, delete on public.notices, public.agent_runs, public.agent_steps,
  public.move_proposals to service_role;

-- Accepting moves the match to the proposed slot, keeps sign-ups and tells
-- each player (who can drop out with full credit if it no longer works).
create function public.decide_move_proposal(p_proposal_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_proposal public.move_proposals;
  v_match public.matches;
  v_from_starts timestamptz;
  v_to_starts timestamptz;
  v_deadline timestamptz;
begin
  select * into v_proposal from public.move_proposals where id = p_proposal_id for update;
  if not found or v_proposal.status <> 'pending' then
    raise exception 'proposal_not_pending';
  end if;

  select * into v_match from public.matches where id = v_proposal.match_id for update;
  if v_match.organizer_id is distinct from auth.uid() then
    raise exception 'not_allowed';
  end if;

  if not p_accept then
    update public.move_proposals set status = 'rejected', decided_at = now() where id = p_proposal_id;
    update public.agent_steps set state = 'done', result = 'La dejaste como está', updated_at = now()
    where run_id = v_proposal.run_id and position = 7;
    return;
  end if;

  if v_match.status = 'cancelled' then
    raise exception 'match_cancelled';
  end if;
  if exists (
    select 1 from public.matches where slot_id = v_proposal.to_slot_id and status <> 'cancelled'
  ) then
    raise exception 'slot_taken';
  end if;

  select starts_at into v_from_starts from public.slots where id = v_match.slot_id;
  select starts_at into v_to_starts from public.slots where id = v_proposal.to_slot_id;

  -- Keep the deadline unless the new slot needs it earlier.
  v_deadline := least(v_match.confirmation_deadline, v_to_starts - interval '1 hour');
  if v_deadline <= now() then
    raise exception 'proposal_expired';
  end if;

  perform set_config('retta.agent', 'on', true);
  update public.matches
  set slot_id = v_proposal.to_slot_id, confirmation_deadline = v_deadline
  where id = v_match.id;
  perform set_config('retta.agent', 'off', true);

  update public.move_proposals set status = 'accepted', decided_at = now() where id = p_proposal_id;
  update public.agent_steps
  set state = 'done', result = 'La moviste a las ' || to_char(v_to_starts at time zone 'America/Mexico_City', 'HH24:MI'), updated_at = now()
  where run_id = v_proposal.run_id and position = 7;

  insert into public.notices (user_id, kind, match_id, data)
  select r.player_id, 'match_moved', v_match.id,
    jsonb_build_object('from_starts_at', v_from_starts, 'to_starts_at', v_to_starts)
  from public.registrations r
  where r.match_id = v_match.id and r.status = 'active';
end;
$$;

-- ---------------------------------------------------------------------------
-- Agent tools (service role only)
-- ---------------------------------------------------------------------------

-- Players who could fill a match, best first. Affinity: sign-ups at the same
-- field, at a similar hour, and attendance. Excludes players already in the
-- match, already invited to it, or in another match at the same time.
create function public.agent_candidates(p_match_id uuid, p_limit int default 20)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with target as (
    select m.id, m.organizer_id, s.field_id, s.starts_at, s.ends_at
    from public.matches m join public.slots s on s.id = m.slot_id
    where m.id = p_match_id
  ),
  history as (
    select r.player_id,
      count(*) filter (where s.field_id = t.field_id) as same_field,
      count(*) filter (
        where abs(extract(epoch from ((s.starts_at at time zone 'America/Mexico_City')::time
          - (t.starts_at at time zone 'America/Mexico_City')::time))) <= 3600
      ) as same_hour,
      count(*) filter (where r.attendance = 'present') as attended,
      count(*) filter (where r.attendance = 'absent') as missed
    from public.registrations r
    join public.matches m on m.id = r.match_id
    join public.slots s on s.id = m.slot_id
    cross join target t
    where r.status = 'active' and m.status <> 'cancelled' and m.id <> t.id
    group by r.player_id
  )
  select coalesce(jsonb_agg(c order by score desc, c ->> 'full_name'), '[]'::jsonb)
  from (
    select coalesce(h.same_field, 0) * 3 + coalesce(h.same_hour, 0) * 2
        + coalesce(h.attended, 0) - coalesce(h.missed, 0) * 2 as score,
      jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'same_field', coalesce(h.same_field, 0),
      'same_hour', coalesce(h.same_hour, 0),
      'attended', coalesce(h.attended, 0),
      'missed', coalesce(h.missed, 0),
      'score', coalesce(h.same_field, 0) * 3 + coalesce(h.same_hour, 0) * 2
        + coalesce(h.attended, 0) - coalesce(h.missed, 0) * 2
    ) as c
    from public.profiles p
    cross join target t
    left join history h on h.player_id = p.id
    where p.phone is not null
      and p.id <> t.organizer_id
      and not exists (
        select 1 from public.registrations r
        where r.match_id = t.id and r.player_id = p.id and r.status = 'active'
      )
      and not exists (
        select 1 from public.notices n
        where n.match_id = t.id and n.user_id = p.id and n.kind = 'invite'
      )
      and not exists (
        select 1 from public.registrations r
        join public.matches m on m.id = r.match_id
        join public.slots s on s.id = m.slot_id
        where r.player_id = p.id and r.status = 'active' and m.status <> 'cancelled'
          and m.id <> t.id and tstzrange(s.starts_at, s.ends_at) && tstzrange(t.starts_at, t.ends_at)
      )
    order by score desc, p.full_name
    limit greatest(p_limit, 1)
  ) ranked
$$;

-- Free slots the match could move to: same day, within 2 h of its start, at
-- least 90 min from now, with how many players have history at that field.
create function public.agent_move_options(p_match_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with target as (
    select m.id, s.field_id, s.starts_at
    from public.matches m join public.slots s on s.id = m.slot_id
    where m.id = p_match_id
  )
  select coalesce(jsonb_agg(o order by (o ->> 'affinity')::int desc, o ->> 'starts_at'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'slot_id', s.id,
      'field_name', f.name,
      'field_area', f.area,
      'starts_at', s.starts_at,
      'same_field', s.field_id = t.field_id,
      'affinity', (
        select count(distinct r.player_id)::int
        from public.registrations r
        join public.matches m2 on m2.id = r.match_id
        join public.slots s2 on s2.id = m2.slot_id
        where s2.field_id = s.field_id and r.status = 'active' and m2.id <> t.id
          and not exists (
            select 1 from public.registrations mine
            where mine.match_id = t.id and mine.player_id = r.player_id and mine.status = 'active'
          )
      )
    ) as o
    from public.slots s
    join public.fields f on f.id = s.field_id
    cross join target t
    where s.id <> (select slot_id from public.matches where id = t.id)
      and s.starts_at >= now() + interval '90 minutes'
      and abs(extract(epoch from (s.starts_at - t.starts_at))) <= 7200
      and (s.starts_at at time zone 'America/Mexico_City')::date = (t.starts_at at time zone 'America/Mexico_City')::date
      and not exists (select 1 from public.matches m where m.slot_id = s.id and m.status <> 'cancelled')
    limit 10
  ) options
$$;

-- Moves the deadline later, within the usual rules (validate_match).
create function public.agent_extend_deadline(p_match_id uuid, p_deadline timestamptz)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_deadline timestamptz;
begin
  perform set_config('retta.agent', 'on', true);
  update public.matches
  set confirmation_deadline = p_deadline
  where id = p_match_id and status = 'pending' and agent_enabled and p_deadline > confirmation_deadline
  returning confirmation_deadline into v_deadline;
  perform set_config('retta.agent', 'off', true);
  if v_deadline is null then
    raise exception 'cannot_extend';
  end if;
  return v_deadline;
end;
$$;

-- Players with no sign-up in the last 14 days or ahead, who have not had a
-- suggestion this week, with where and when they usually play.
create function public.agent_inactive_players()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'last_played_at', (
        select max(s.starts_at) from public.registrations r
        join public.matches m on m.id = r.match_id join public.slots s on s.id = m.slot_id
        where r.player_id = p.id and r.status = 'active' and m.status <> 'cancelled' and s.starts_at < now()
      ),
      'fields', coalesce((
        select jsonb_agg(distinct s.field_id) from public.registrations r
        join public.matches m on m.id = r.match_id join public.slots s on s.id = m.slot_id
        where r.player_id = p.id
      ), '[]'::jsonb),
      'usual_hour', (
        select mode() within group (order by extract(hour from s.starts_at at time zone 'America/Mexico_City'))
        from public.registrations r
        join public.matches m on m.id = r.match_id join public.slots s on s.id = m.slot_id
        where r.player_id = p.id
      )
    ) as x
    from public.profiles p
    where p.phone is not null
      and p.role = 'player'
      and not exists (
        select 1 from public.registrations r
        join public.matches m on m.id = r.match_id join public.slots s on s.id = m.slot_id
        where r.player_id = p.id and r.status = 'active' and m.status <> 'cancelled'
          and s.starts_at >= now() - interval '14 days'
      )
      and not exists (
        select 1 from public.notices n
        where n.user_id = p.id and n.kind = 'reactivation' and n.created_at > now() - interval '7 days'
      )
  ) inactive
$$;

revoke execute on function
  public.decide_move_proposal(uuid, boolean),
  public.agent_candidates(uuid, int),
  public.agent_move_options(uuid),
  public.agent_extend_deadline(uuid, timestamptz),
  public.agent_inactive_players()
from public, anon, authenticated;

grant execute on function public.decide_move_proposal(uuid, boolean) to authenticated;
grant execute on function
  public.agent_candidates(uuid, int),
  public.agent_move_options(uuid),
  public.agent_extend_deadline(uuid, timestamptz),
  public.agent_inactive_players()
to service_role;

-- ---------------------------------------------------------------------------
-- Wake-up: every 5 minutes pg_cron calls the app's agent endpoint
-- ---------------------------------------------------------------------------
-- The endpoint URL and its secret live in Supabase Vault (never in git):
--   select vault.create_secret('https://<app>/api/agente/tick', 'agent_tick_url');
--   select vault.create_secret('<same value as AGENT_CRON_SECRET>', 'agent_tick_secret');
-- Without them the job does nothing.

create function private.agent_tick()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'agent_tick_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'agent_tick_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.agent_tick() from public, anon, authenticated;

select cron.schedule('agent-tick', '*/5 * * * *', 'select private.agent_tick()');
