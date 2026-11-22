-- PostgREST discovers computed relationships through their named return type.
create view public.match_capacity_value as select 0::int as count where false;
revoke all on public.match_capacity_value from public, anon, authenticated;
grant select on public.match_capacity_value to authenticated;

drop function public.match_capacity(public.matches);
create function public.match_capacity(public.matches)
returns setof public.match_capacity_value
language sql stable security definer set search_path = ''
as $$
  select private.active_count($1.id);
$$;
revoke all on function public.match_capacity(public.matches) from public, anon;
grant execute on function public.match_capacity(public.matches) to authenticated;
