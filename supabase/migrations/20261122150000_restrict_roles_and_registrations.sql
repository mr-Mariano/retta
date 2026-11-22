-- After app clients switch to match_capacity and the scoped profile RPCs,
-- remove direct access to other players' roles and schedules.
revoke select (role) on public.profiles from authenticated;

drop policy "Signed-in users read registrations" on public.registrations;
create policy "Players, organizers and admins read authorized registrations"
on public.registrations for select to authenticated
using (
  player_id = (select auth.uid())
  or (select private.is_admin())
  or exists (
    select 1 from public.matches m
    where m.id = match_id and m.organizer_id = (select auth.uid())
  )
);

-- Roster is available to the organizer and active participants of that match.
create or replace function public.match_players(p_match_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(player order by joined), '[]'::jsonb)
  from (
    select r.created_at as joined, jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'shared', s.shared,
      'instagram', case when s.shared > 0 then p.instagram end,
      'facebook', case when s.shared > 0 then p.facebook end
    ) as player
    from public.registrations r
    join public.profiles p on p.id = r.player_id
    cross join lateral (select private.shared_matches(auth.uid(), p.id) as shared) s
    where r.match_id = p_match_id and r.status = 'active' and r.player_id <> auth.uid()
      and (
        exists(select 1 from public.matches m where m.id = p_match_id and m.organizer_id = auth.uid())
        or exists(select 1 from public.registrations mine
          where mine.match_id = p_match_id and mine.player_id = auth.uid() and mine.status = 'active')
      )
  ) players;
$$;

-- No application runtime needs these previous service-role entry points.
revoke execute on function public.agent_candidates(uuid, int),
  public.agent_move_options(uuid), public.agent_extend_deadline(uuid, timestamptz),
  public.agent_inactive_players() from service_role;
