-- Any player can organize (2026-11-06): the organizer role goes away.
-- Organizers become players; players and admins create matches.
-- The enum keeps the old value (Postgres can't drop it); a check keeps it unused.

update public.profiles set role = 'player' where role = 'organizer';

alter table public.profiles
  add constraint profiles_role_not_organizer check (role <> 'organizer');

drop policy "Organizers create matches" on public.matches;

create policy "Players create matches"
on public.matches for insert to authenticated
with check (
  organizer_id = (select auth.uid())
  and (select private.user_role()) in ('player', 'admin')
);
