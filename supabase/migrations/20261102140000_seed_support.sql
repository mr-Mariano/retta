-- Support for server-side scripts such as app/scripts/seed.ts.

-- Newer projects don't grant table privileges to service_role by default.
-- service_role bypasses RLS, so its key must never reach the browser.
grant select, insert, update, delete on public.profiles, public.fields, public.slots,
  public.matches, public.registrations, public.transactions to service_role;

-- Matches are only deleted by scripts (clients cancel instead); drop their
-- deadline job with them so no stale jobs pile up.
create function private.drop_deadline_job()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.unschedule_deadline(old.id);
  return old;
end;
$$;

create trigger drop_deadline_job
after delete on public.matches
for each row execute function private.drop_deadline_job();

revoke all on function private.drop_deadline_job() from public, anon, authenticated;
