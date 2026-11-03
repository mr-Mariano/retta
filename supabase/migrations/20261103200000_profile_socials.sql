-- Players can link Instagram and Facebook (docs/decisions.md, session 7).
-- Other players only see them when both share a sign-up in the same match,
-- so the columns are not readable directly: they come through functions.

alter table public.profiles
  add column instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column facebook text check (facebook ~ '^[A-Za-z0-9.]{5,50}$');

-- Profiles stay readable except for the social columns.
revoke select on public.profiles from authenticated;
grant select (id, full_name, phone, role, created_at) on public.profiles to authenticated;
grant update (instagram, facebook) on public.profiles to authenticated;

-- Matches (not cancelled) where both players hold an active sign-up.
create function private.shared_matches(p_a uuid, p_b uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(distinct a.match_id)::int
  from public.registrations a
  join public.registrations b on b.match_id = a.match_id
  join public.matches m on m.id = a.match_id
  where a.player_id = p_a and a.status = 'active'
    and b.player_id = p_b and b.status = 'active'
    and m.status <> 'cancelled'
$$;

-- The caller's own social usernames, for the profile screen.
create function public.my_socials()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('instagram', instagram, 'facebook', facebook)
  from public.profiles
  where id = auth.uid()
$$;

-- Everyone signed up for a match except the caller, with how many matches they
-- share; socials only for players who share at least one with the caller.
create function public.match_players(p_match_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(player order by joined), '[]'::jsonb)
  from (
    select
      r.created_at as joined,
      jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'shared', s.shared,
        'instagram', case when s.shared > 0 then p.instagram end,
        'facebook', case when s.shared > 0 then p.facebook end
      ) as player
    from public.registrations r
    join public.profiles p on p.id = r.player_id
    cross join lateral (select private.shared_matches(auth.uid(), p.id) as shared) s
    where r.match_id = p_match_id and r.status = 'active' and r.player_id <> auth.uid()
  ) players
$$;

revoke execute on function public.my_socials(), public.match_players(uuid) from public, anon;
grant execute on function public.my_socials(), public.match_players(uuid) to authenticated;
