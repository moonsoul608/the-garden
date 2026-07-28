-- Phase 10A: allow public visitor-note submission without exposing notes.
-- Notes remain private: visitors receive INSERT only, never SELECT.

revoke select, update, delete on table public.visitor_notes from anon;

grant insert (name, message) on table public.visitor_notes to anon, authenticated;

create policy visitor_notes_public_insert
on public.visitor_notes
for insert
to anon, authenticated
with check (
  btrim(message) <> ''
  and char_length(message) between 2 and 1200
  and (
    name is null
    or (
      btrim(name) <> ''
      and char_length(name) <= 80
    )
  )
  and is_read = false
);

