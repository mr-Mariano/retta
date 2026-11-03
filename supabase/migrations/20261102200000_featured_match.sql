-- Featured match for the welcome screen ("Faltan N para que se arme") and the
-- "Se está armando" card in Explore (docs/decisions.md, sessions 5 and 6).
-- Readable by anon: the welcome screen is shown before signing in, so it only
-- exposes what a public listing would.

create function public.featured_match()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'title', coalesce(m.title, 'Reta en ' || f.name),
    'field_name', f.name,
    'starts_at', s.starts_at,
    'active_count', c.active,
    'min_players', m.min_players,
    'max_players', m.max_players,
    'status', m.status
  )
  from public.matches m
  join public.slots s on s.id = m.slot_id
  join public.fields f on f.id = s.field_id
  cross join lateral (
    select count(*)::int as active
    from public.registrations r
    where r.match_id = m.id and r.status = 'active'
  ) c
  where m.status <> 'cancelled'
    and s.starts_at > now()
    and c.active < m.max_players
    -- A pending match past its deadline is about to be cancelled.
    and not (m.status = 'pending' and m.confirmation_deadline <= now())
  -- Pending first, closest to its minimum, then soonest.
  order by
    (m.status = 'pending') desc,
    greatest(m.min_players - c.active, 0),
    s.starts_at
  limit 1
$$;

revoke execute on function public.featured_match() from public;
grant execute on function public.featured_match() to anon, authenticated;
