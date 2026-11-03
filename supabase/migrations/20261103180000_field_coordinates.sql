-- Fields store their location for the in-app map and the "Cerca de mí"
-- filter (docs/decisions.md, session 7). Nullable so a field can be created
-- before its pin is placed; the app hides the map until both are set.

alter table public.fields
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add constraint fields_coordinates_together check ((latitude is null) = (longitude is null));

-- Approximate pins for the demo fields already loaded by the seed.
update public.fields set latitude = 20.6707, longitude = -103.3934 where name = 'Cancha La Estancia';
update public.fields set latitude = 20.6955, longitude = -103.3826 where name = 'Fut 7 Providencia';
update public.fields set latitude = 20.6405, longitude = -103.3115 where name = 'Deportivo Tlaquepaque';
