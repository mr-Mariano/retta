-- Admins can take or pick a real photo for a field (admin flow B, 2026-11-04;
-- changes session 4, which allowed only the bundled set). Photos live in a
-- public Storage bucket; fields.cover_image holds either a bundled key
-- ('foto-1' … 'foto-6') or the photo's public URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('field-photos', 'field-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Admins upload field photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'field-photos' and private.is_admin());

alter table public.fields drop constraint fields_cover_image_check;
alter table public.fields add constraint fields_cover_image_check check (
  cover_image ~ '^foto-[1-6]$'
  or cover_image ~ '^https?://[^ ]+/storage/v1/object/public/field-photos/[^ ]+$'
);
