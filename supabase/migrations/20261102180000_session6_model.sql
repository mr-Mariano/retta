-- Session 6 model changes (docs/decisions.md, 2026-11-02):
-- * Google sign-in: a profile may exist without a phone until "Completa tu
--   perfil"; signing up for a match requires it.
-- * Phones stored in international format (E.164, e.g. +523312345678).
-- * Matches get format, level and type; fields get area and changing rooms.

-- ---------------------------------------------------------------------------
-- Profiles: optional phone, international format
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint profiles_phone_check;
alter table public.profiles alter column phone drop not null;

-- Existing numbers are 10-digit Mexican ones.
update public.profiles set phone = '+52' || phone where phone ~ '^[0-9]{10}$';

alter table public.profiles
  add constraint profiles_phone_e164 check (phone ~ '^\+[1-9][0-9]{7,14}$');

-- Email sign-up sends full_name and phone; Google sends full_name (or name)
-- and no phone, which is asked for afterwards.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;

-- Organizers need the phone for WhatsApp reminders.
create function private.require_player_phone()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select phone from public.profiles where id = new.player_id) is null then
    raise exception 'profile_incomplete';
  end if;
  return new;
end;
$$;

create trigger require_player_phone
before insert on public.registrations
for each row execute function private.require_player_phone();

-- ---------------------------------------------------------------------------
-- Matches: format, level, type
-- ---------------------------------------------------------------------------

create type public.match_format as enum ('fut5', 'fut7', 'fut11');
create type public.skill_level as enum ('beginner', 'intermediate', 'advanced');
create type public.match_type as enum ('men', 'women', 'mixed');

-- Defaults only backfill existing rows; new matches must set all three.
alter table public.matches
  add column format public.match_format not null default 'fut7',
  add column level public.skill_level not null default 'intermediate',
  add column type public.match_type not null default 'mixed';

alter table public.matches
  alter column format drop default,
  alter column level drop default,
  alter column type drop default;

-- The edit lock covers the new columns too.
drop trigger validate_match on public.matches;
create trigger validate_match
before insert or update of slot_id, title, description, min_players, max_players, price_cents,
  confirmation_deadline, format, level, type
on public.matches
for each row execute function private.validate_match();

grant insert (format, level, type) on public.matches to authenticated;
grant update (format, level, type) on public.matches to authenticated;

-- ---------------------------------------------------------------------------
-- Fields: area and changing rooms
-- ---------------------------------------------------------------------------

-- Short area shown under the field name (e.g. "Tlaquepaque"); the app falls
-- back to the address while it is empty.
alter table public.fields
  add column area text check (area is null or length(trim(area)) > 0),
  add column has_changing_rooms boolean not null default false;
