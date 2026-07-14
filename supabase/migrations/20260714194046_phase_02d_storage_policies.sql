begin;

-- The cover-images bucket remains private. Published delivery is authorized
-- per object only when contents.cover_image_path references the exact object
-- name and the owning content row is Published.
create policy cover_images_public_read_published
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'cover-images'
  and exists (
    select 1
    from public.contents as content
    where content.cover_image_path = storage.objects.name
      and content.lifecycle = 'Published'
  )
);

-- The future Garden Keeper may read private cover objects for Draft, Review,
-- and Archived content after Phase 04A binds an approved identity.
create policy cover_images_garden_keeper_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cover-images'
  and (select private.is_garden_keeper())
);

-- New and moved objects must follow the confirmed convention:
-- contents/{content-id}/{unique-file-name}. Comparing UUIDs as text avoids an
-- unsafe cast when a malformed object name is rejected by the same policy.
create policy cover_images_garden_keeper_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cover-images'
  and (select private.is_garden_keeper())
  and name ~ '^contents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
  and exists (
    select 1
    from public.contents as content
    where content.id::text = split_part(storage.objects.name, '/', 2)
  )
);

create policy cover_images_garden_keeper_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cover-images'
  and (select private.is_garden_keeper())
)
with check (
  bucket_id = 'cover-images'
  and (select private.is_garden_keeper())
  and name ~ '^contents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
  and exists (
    select 1
    from public.contents as content
    where content.id::text = split_part(storage.objects.name, '/', 2)
  )
);

create policy cover_images_garden_keeper_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cover-images'
  and (select private.is_garden_keeper())
);

commit;
