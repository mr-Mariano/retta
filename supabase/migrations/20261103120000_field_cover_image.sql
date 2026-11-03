-- Each field has a cover image picked by the admin from a bundled set
-- (docs/decisions.md, session 4). Matches inherit it. The app serves the files
-- from /fotos/canchas/<cover_image>.jpg.

alter table public.fields
  add column cover_image text not null default 'foto-1'
    check (cover_image in ('foto-1', 'foto-2', 'foto-3', 'foto-4', 'foto-5', 'foto-6'));

-- Spread existing fields across the set, then require new fields to choose one.
update public.fields f
set cover_image = 'foto-' || (((n.rn - 1) % 6) + 1)
from (select id, row_number() over (order by created_at, id) as rn from public.fields) n
where n.id = f.id;

alter table public.fields alter column cover_image drop default;
