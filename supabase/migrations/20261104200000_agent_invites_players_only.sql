-- The rescue agent invites only players, never organizers, field managers or admins.

create or replace function public.agent_candidates(p_match_id uuid, p_limit int default 20)
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
      and p.role = 'player'
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
