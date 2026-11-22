-- Guests can browse published matches and capacity without profile or registration access.
create function public.browse_matches(p_match_id uuid default null)
returns setof jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id, 'title', m.title, 'description', m.description,
    'min_players', m.min_players, 'max_players', m.max_players,
    'price_cents', m.price_cents, 'status', m.status,
    'confirmation_deadline', m.confirmation_deadline, 'format', m.format,
    'level', m.level, 'type', m.type,
    'slot', jsonb_build_object(
      'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'field', jsonb_build_object(
        'name', f.name, 'area', f.area, 'address', f.address,
        'has_changing_rooms', f.has_changing_rooms, 'cover_image', f.cover_image,
        'latitude', f.latitude, 'longitude', f.longitude
      )
    ),
    'registrations', jsonb_build_array(jsonb_build_object('count', private.active_count(m.id)))
  )
  from public.matches m
  join public.slots s on s.id = m.slot_id
  join public.fields f on f.id = s.field_id
  where m.status in ('pending', 'confirmed')
    and s.starts_at > now()
    and (m.status = 'confirmed' or m.confirmation_deadline > now())
    and (p_match_id is null or m.id = p_match_id)
  order by s.starts_at, m.id;
$$;

revoke all on function public.browse_matches(uuid) from public;
grant execute on function public.browse_matches(uuid) to anon, authenticated;

-- Introduce scoped phone access before removing the legacy column grant.
create function public.my_profile_phone()
returns text
language sql stable security definer set search_path = ''
as $$
  select phone from public.profiles where id = auth.uid();
$$;

create function public.organizer_match_phones(p_match_id uuid)
returns table (registration_id uuid, phone text)
language sql stable security definer set search_path = ''
as $$
  select r.id, p.phone
  from public.matches m
  join public.registrations r on r.match_id = m.id
  join public.profiles p on p.id = r.player_id
  where m.id = p_match_id
    and m.organizer_id = auth.uid()
    and m.status <> 'cancelled'
    and r.status = 'active';
$$;

revoke all on function public.my_profile_phone(), public.organizer_match_phones(uuid) from public;
grant execute on function public.my_profile_phone(), public.organizer_match_phones(uuid) to authenticated;
