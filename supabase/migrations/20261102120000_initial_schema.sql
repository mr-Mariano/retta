-- Retta MVP schema: profiles, fields, slots, matches, registrations, transactions.
-- Business rules come from docs/decisions.md (sessions 2 and 3).
--
-- Writes that need row locks (sign-up, drop-out, cancellation) go through the
-- security-definer functions at the end of this file. Everything else is plain
-- queries guarded by RLS and column grants.
--
-- Errors are raised as short snake_case codes (e.g. 'match_full') that the app
-- maps to Spanish UI messages.

create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- Internal helpers live outside the API-exposed schema.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('player', 'organizer', 'field_manager', 'admin');
create type public.match_status as enum ('pending', 'confirmed', 'cancelled');
create type public.cancel_reason as enum ('minimum_not_reached', 'organizer', 'admin');
create type public.registration_status as enum ('active', 'dropped', 'match_cancelled');
create type public.attendance_status as enum ('unrecorded', 'present', 'absent');
create type public.transaction_type as enum ('charge', 'credit_used', 'credit_dropout', 'credit_cancellation');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  -- 10-digit Mexican number, digits only.
  phone text not null check (phone ~ '^[0-9]{10}$'),
  role public.user_role not null default 'player',
  created_at timestamptz not null default now()
);

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text not null check (length(trim(address)) > 0),
  notes text,
  manager_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index fields_manager_id_idx on public.fields (manager_id);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint slots_valid_range check (ends_at > starts_at),
  constraint slots_no_overlap exclude using gist (
    field_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id),
  organizer_id uuid not null references public.profiles (id),
  -- Null title is shown as "Reta en {field}".
  title text,
  description text,
  min_players int not null,
  max_players int not null,
  -- Whole pesos only, stored as cents.
  price_cents int not null default 0,
  -- Defaults to 3 h before the slot starts (see private.validate_match).
  confirmation_deadline timestamptz not null,
  status public.match_status not null default 'pending',
  cancel_reason public.cancel_reason,
  cancel_note text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint matches_capacity check (min_players >= 2 and min_players <= max_players and max_players <= 30),
  constraint matches_price check (price_cents >= 0 and price_cents % 100 = 0),
  constraint matches_cancellation check (
    (status = 'cancelled') = (cancel_reason is not null and cancelled_at is not null)
  ),
  constraint matches_organizer_cancel_note check (
    cancel_reason is distinct from 'organizer' or length(trim(coalesce(cancel_note, ''))) > 0
  )
);

-- A slot holds at most one non-cancelled match.
create unique index matches_one_per_slot on public.matches (slot_id) where status <> 'cancelled';
create index matches_organizer_id_idx on public.matches (organizer_id);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id),
  player_id uuid not null references public.profiles (id),
  status public.registration_status not null default 'active',
  attendance public.attendance_status not null default 'unrecorded',
  attendance_marked_by uuid references public.profiles (id),
  attendance_marked_at timestamptz,
  created_at timestamptz not null default now()
);

-- A player who dropped out can sign up again, which creates a new row.
create unique index registrations_one_active_per_player
  on public.registrations (match_id, player_id) where status = 'active';
create index registrations_player_id_idx on public.registrations (player_id);

-- Immutable ledger. Balance = credit_dropout + credit_cancellation - credit_used.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id),
  type public.transaction_type not null,
  amount_cents int not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create index transactions_registration_id_idx on public.transactions (registration_id);

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create function private.user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.user_role() = 'admin', false)
$$;

create function private.balance_cents(p_player_id uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(
    case
      when t.type in ('credit_dropout', 'credit_cancellation') then t.amount_cents
      when t.type = 'credit_used' then -t.amount_cents
      else 0
    end
  ), 0)::int
  from public.transactions t
  join public.registrations r on r.id = t.registration_id
  where r.player_id = p_player_id
$$;

-- Total a registration paid, in cash or credit. This is what gets returned as credit.
create function private.paid_cents(p_registration_id uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(amount_cents), 0)::int
  from public.transactions
  where registration_id = p_registration_id and type in ('charge', 'credit_used')
$$;

-- Counts only; the caller must already hold the match row lock.
create function private.active_count(p_match_id uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.registrations where match_id = p_match_id and status = 'active'
$$;

-- ---------------------------------------------------------------------------
-- Confirmation deadline jobs (pg_cron)
-- ---------------------------------------------------------------------------
-- One job per match named 'deadline-<match id>', scheduled at the deadline's
-- exact minute (UTC). The cron expression repeats yearly, so the job removes
-- itself after running.

create function private.unschedule_deadline(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from cron.job where jobname = 'deadline-' || p_match_id) then
    perform cron.unschedule('deadline-' || p_match_id);
  end if;
end;
$$;

create function private.schedule_deadline(p_match_id uuid, p_deadline timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_at timestamp := p_deadline at time zone 'UTC';
begin
  -- cron.schedule replaces an existing job with the same name.
  perform cron.schedule(
    'deadline-' || p_match_id,
    format('%s %s %s %s *',
      extract(minute from v_at)::int,
      extract(hour from v_at)::int,
      extract(day from v_at)::int,
      extract(month from v_at)::int),
    format('select private.handle_confirmation_deadline(%L::uuid)', p_match_id)
  );
end;
$$;

create function private.cancel_match(p_match_id uuid, p_reason public.cancel_reason, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.matches
  set status = 'cancelled',
      cancel_reason = p_reason,
      cancel_note = nullif(trim(p_note), ''),
      cancelled_at = now()
  where id = p_match_id;

  -- Everything each player paid comes back as credit.
  with cancelled as (
    update public.registrations
    set status = 'match_cancelled'
    where match_id = p_match_id and status = 'active'
    returning id
  )
  insert into public.transactions (registration_id, type, amount_cents)
  select c.id, 'credit_cancellation', private.paid_cents(c.id)
  from cancelled c
  where private.paid_cents(c.id) > 0;

  perform private.unschedule_deadline(p_match_id);
end;
$$;

create function private.handle_confirmation_deadline(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;

  if not found then
    perform private.unschedule_deadline(p_match_id);
    return;
  end if;

  -- Stale run (deadline moved later): leave the rescheduled job alone.
  if v_match.confirmation_deadline > now() then
    return;
  end if;

  if v_match.status = 'pending' then
    perform private.cancel_match(p_match_id, 'minimum_not_reached', null);
  else
    perform private.unschedule_deadline(p_match_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Profile is created from sign-up metadata; phone is mandatory, so sign-up
-- fails without it. Role always starts as 'player'.
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- Enforces deadline rules and locks edits once anyone has signed up.
create function private.validate_match()
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
    if exists (select 1 from public.registrations where match_id = new.id) then
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

create trigger validate_match
before insert or update of slot_id, title, description, min_players, max_players, price_cents, confirmation_deadline
on public.matches
for each row execute function private.validate_match();

create function private.sync_deadline_job()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.schedule_deadline(new.id, new.confirmation_deadline);
  return new;
end;
$$;

create trigger sync_deadline_job
after insert or update of confirmation_deadline on public.matches
for each row execute function private.sync_deadline_job();

-- Attendance: active registrations of confirmed matches, from start until 24 h later.
create function private.validate_attendance()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.match_status;
  v_starts_at timestamptz;
begin
  if new.status <> 'active' then
    raise exception 'registration_not_active';
  end if;

  select m.status, s.starts_at into v_status, v_starts_at
  from public.matches m
  join public.slots s on s.id = m.slot_id
  where m.id = new.match_id;

  if v_status <> 'confirmed' then
    raise exception 'match_not_confirmed';
  end if;
  if now() < v_starts_at or now() > v_starts_at + interval '24 hours' then
    raise exception 'attendance_window_closed';
  end if;

  new.attendance_marked_by := auth.uid();
  new.attendance_marked_at := now();
  return new;
end;
$$;

create trigger validate_attendance
before update of attendance on public.registrations
for each row execute function private.validate_attendance();

-- ---------------------------------------------------------------------------
-- API functions (called with supabase.rpc)
-- ---------------------------------------------------------------------------

-- Signs up and pays in one step. Credit is applied first; the rest is a
-- simulated charge. Free matches create no transactions.
create function public.sign_up_for_match(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches;
  v_starts_at timestamptz;
  v_active int;
  v_credit int := 0;
  v_charge int := 0;
  v_registration_id uuid;
  v_just_confirmed boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match_not_found';
  end if;
  if v_match.status = 'cancelled' then
    raise exception 'match_cancelled';
  end if;

  select starts_at into v_starts_at from public.slots where id = v_match.slot_id;
  if now() >= v_starts_at then
    raise exception 'match_started';
  end if;
  -- A pending match past its deadline is about to be cancelled by its job.
  if v_match.status = 'pending' and now() >= v_match.confirmation_deadline then
    raise exception 'deadline_passed';
  end if;

  if exists (
    select 1 from public.registrations
    where match_id = p_match_id and player_id = v_uid and status = 'active'
  ) then
    raise exception 'already_registered';
  end if;

  v_active := private.active_count(p_match_id);
  if v_active >= v_match.max_players then
    raise exception 'match_full';
  end if;

  -- Serializes balance use across concurrent sign-ups by the same player.
  perform 1 from public.profiles where id = v_uid for update;

  if v_match.price_cents > 0 then
    v_credit := least(greatest(private.balance_cents(v_uid), 0), v_match.price_cents);
    v_charge := v_match.price_cents - v_credit;
  end if;

  insert into public.registrations (match_id, player_id)
  values (p_match_id, v_uid)
  returning id into v_registration_id;

  if v_credit > 0 then
    insert into public.transactions (registration_id, type, amount_cents)
    values (v_registration_id, 'credit_used', v_credit);
  end if;
  if v_charge > 0 then
    insert into public.transactions (registration_id, type, amount_cents)
    values (v_registration_id, 'charge', v_charge);
  end if;

  if v_match.status = 'pending' and v_active + 1 >= v_match.min_players then
    update public.matches set status = 'confirmed' where id = p_match_id;
    v_match.status := 'confirmed';
    v_just_confirmed := true;
  end if;

  return jsonb_build_object(
    'registration_id', v_registration_id,
    'credit_used_cents', v_credit,
    'charged_cents', v_charge,
    'match_status', v_match.status,
    'just_confirmed', v_just_confirmed
  );
end;
$$;

-- Allowed only before the deadline. Everything paid comes back as credit.
create function public.drop_out_of_match(p_match_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches;
  v_registration_id uuid;
  v_credit int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match_not_found';
  end if;
  if v_match.status = 'cancelled' then
    raise exception 'match_cancelled';
  end if;
  if now() >= v_match.confirmation_deadline then
    raise exception 'deadline_passed';
  end if;

  select id into v_registration_id
  from public.registrations
  where match_id = p_match_id and player_id = v_uid and status = 'active'
  for update;
  if not found then
    raise exception 'not_registered';
  end if;

  update public.registrations set status = 'dropped' where id = v_registration_id;

  v_credit := private.paid_cents(v_registration_id);
  if v_credit > 0 then
    insert into public.transactions (registration_id, type, amount_cents)
    values (v_registration_id, 'credit_dropout', v_credit);
  end if;

  if v_match.status = 'confirmed' and private.active_count(p_match_id) < v_match.min_players then
    update public.matches set status = 'pending' where id = p_match_id;
    v_match.status := 'pending';
  end if;

  return jsonb_build_object('credit_cents', v_credit, 'match_status', v_match.status);
end;
$$;

-- Organizers cancel their own match (note required); admins cancel any match.
create function public.cancel_match(p_match_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches;
  v_starts_at timestamptz;
  v_reason public.cancel_reason;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match_not_found';
  end if;
  if v_match.status = 'cancelled' then
    raise exception 'match_cancelled';
  end if;

  select starts_at into v_starts_at from public.slots where id = v_match.slot_id;
  if now() >= v_starts_at then
    raise exception 'match_started';
  end if;

  if v_match.organizer_id = v_uid then
    if length(trim(coalesce(p_note, ''))) = 0 then
      raise exception 'cancel_note_required';
    end if;
    v_reason := 'organizer';
  elsif private.is_admin() then
    v_reason := 'admin';
  else
    raise exception 'not_allowed';
  end if;

  perform private.cancel_match(p_match_id, v_reason, p_note);
end;
$$;

create function public.my_balance()
returns int
language sql stable security definer set search_path = ''
as $$
  select private.balance_cents(auth.uid())
$$;

-- Admin panel: change a user's role. Admins cannot change their own role.
create function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_change_own_role';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'user_not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.fields enable row level security;
alter table public.slots enable row level security;
alter table public.matches enable row level security;
alter table public.registrations enable row level security;
alter table public.transactions enable row level security;

-- Profiles: names are shown on match details and organizers need phones for
-- WhatsApp reminders, so signed-in users can read all profiles.
create policy "Signed-in users read profiles"
on public.profiles for select to authenticated
using (true);

create policy "Users update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Fields: admins manage them.
create policy "Signed-in users read fields"
on public.fields for select to authenticated
using (true);

create policy "Admins insert fields"
on public.fields for insert to authenticated
with check ((select private.is_admin()));

create policy "Admins update fields"
on public.fields for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins delete fields"
on public.fields for delete to authenticated
using ((select private.is_admin()));

-- Slots: the field's manager (or an admin) publishes them and deletes free ones.
create policy "Signed-in users read slots"
on public.slots for select to authenticated
using (true);

create policy "Managers insert slots for their fields"
on public.slots for insert to authenticated
with check (
  (select private.is_admin())
  or exists (
    select 1 from public.fields f
    where f.id = field_id and f.manager_id = (select auth.uid())
  )
);

create policy "Managers delete available slots"
on public.slots for delete to authenticated
using (
  (
    (select private.is_admin())
    or exists (
      select 1 from public.fields f
      where f.id = field_id and f.manager_id = (select auth.uid())
    )
  )
  and not exists (
    select 1 from public.matches m
    where m.slot_id = slots.id and m.status <> 'cancelled'
  )
);

-- Matches: organizers create and edit their own. Status changes go through functions.
create policy "Signed-in users read matches"
on public.matches for select to authenticated
using (true);

create policy "Organizers create matches"
on public.matches for insert to authenticated
with check (
  organizer_id = (select auth.uid())
  and (select private.user_role()) = 'organizer'
);

create policy "Organizers edit their own matches"
on public.matches for update to authenticated
using (organizer_id = (select auth.uid()))
with check (organizer_id = (select auth.uid()));

-- Registrations: visible to everyone (capacity and "Ana, Luis y 5 más");
-- organizers mark attendance on their matches.
create policy "Signed-in users read registrations"
on public.registrations for select to authenticated
using (true);

create policy "Organizers mark attendance"
on public.registrations for update to authenticated
using (
  exists (
    select 1 from public.matches m
    where m.id = match_id and m.organizer_id = (select auth.uid())
  )
);

-- Transactions: players see their own; admins see all.
create policy "Players read their own transactions"
on public.transactions for select to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.player_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Start from nothing (newer projects grant nothing by default, older ones grant
-- everything), then allow exactly what RLS expects. Column grants keep clients
-- away from role, status and ledger columns.

revoke all on public.profiles, public.fields, public.slots, public.matches,
  public.registrations, public.transactions from anon, authenticated;

grant select on public.profiles, public.fields, public.slots, public.matches,
  public.registrations, public.transactions to authenticated;

grant update (full_name, phone) on public.profiles to authenticated;

grant insert, update, delete on public.fields to authenticated;

grant insert, delete on public.slots to authenticated;

grant insert (id, slot_id, organizer_id, title, description, min_players, max_players, price_cents, confirmation_deadline)
  on public.matches to authenticated;
grant update (slot_id, title, description, min_players, max_players, price_cents, confirmation_deadline)
  on public.matches to authenticated;

grant update (attendance) on public.registrations to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.user_role(), private.is_admin() to authenticated;

revoke execute on function
  public.sign_up_for_match(uuid),
  public.drop_out_of_match(uuid),
  public.cancel_match(uuid, text),
  public.my_balance(),
  public.set_user_role(uuid, public.user_role)
from public, anon;

grant execute on function
  public.sign_up_for_match(uuid),
  public.drop_out_of_match(uuid),
  public.cancel_match(uuid, text),
  public.my_balance(),
  public.set_user_role(uuid, public.user_role)
to authenticated;
