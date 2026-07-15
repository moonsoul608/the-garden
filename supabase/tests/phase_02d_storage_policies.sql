-- Run this file in the Supabase Preview SQL Editor after applying all
-- migrations. Every content, Auth, allow-list, and Storage fixture is rolled
-- back at the end of the transaction.
begin;

set local statement_timeout = '30s';

do $$
declare
  bucket_is_public boolean;
  policy_count integer;
begin
  select bucket.public
  into bucket_is_public
  from storage.buckets as bucket
  where bucket.id = 'cover-images';

  if not found then
    raise exception 'Phase 02D-2 test failed: cover-images bucket does not exist';
  end if;

  if bucket_is_public is distinct from false then
    raise exception 'Phase 02D-2 test failed: cover-images bucket is public';
  end if;

  select count(*)
  into policy_count
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'cover_images_public_read_published',
      'cover_images_garden_keeper_read',
      'cover_images_garden_keeper_insert',
      'cover_images_garden_keeper_update',
      'cover_images_garden_keeper_delete'
    );

  if policy_count <> 5 then
    raise exception 'Phase 02D-2 test failed: found % of 5 expected cover policies', policy_count;
  end if;
end;
$$;

-- A transaction-only Auth row makes it possible to exercise the positive
-- Garden Keeper path without configuring an Auth provider or preserving a
-- user after this test.
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-4000-8000-000000002d01',
  'authenticated',
  'authenticated',
  'phase-02d-storage@example.invalid',
  '',
  now(),
  '{"provider":"github","providers":["github"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-4000-8000-000000002e01',
  'phase-02d-storage-provider-id',
  '00000000-0000-4000-8000-000000002d01',
  '{"sub":"phase-02d-storage-provider-id","user_name":"phase-02d-storage-test"}'::jsonb,
  'github',
  now(),
  now(),
  now()
);

insert into private.garden_keeper_identities (
  user_id,
  provider,
  provider_user_id,
  username
)
values (
  '00000000-0000-4000-8000-000000002d01',
  'github',
  'phase-02d-storage-provider-id',
  'phase-02d-storage-test'
);

insert into public.contents (
  id,
  slug,
  region,
  content_type,
  detail_level,
  lifecycle,
  growth_stage,
  title_en,
  content_language,
  cover_image_path,
  cover_image_alt_en,
  published_at
)
values
  (
    '00000000-0000-4000-8000-000000002801',
    'phase-02d-storage-published',
    'Garden',
    'Seed',
    'full',
    'Published',
    'Growing',
    'Phase 02D Storage Published',
    'en',
    'contents/00000000-0000-4000-8000-000000002801/published.webp',
    'Published cover test fixture',
    now()
  ),
  (
    '00000000-0000-4000-8000-000000002802',
    'phase-02d-storage-draft',
    'Forest',
    'Question',
    'short',
    'Draft',
    'Seed',
    'Phase 02D Storage Draft',
    'en',
    'contents/00000000-0000-4000-8000-000000002802/draft.webp',
    null,
    null
  );

insert into storage.objects (id, bucket_id, name, metadata)
values
  (
    '00000000-0000-4000-8000-000000002901',
    'cover-images',
    'contents/00000000-0000-4000-8000-000000002801/published.webp',
    '{"mimetype":"image/webp","size":1}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000002902',
    'cover-images',
    'contents/00000000-0000-4000-8000-000000002802/draft.webp',
    '{"mimetype":"image/webp","size":1}'::jsonb
  );

-- Anonymous visitors can read only the object referenced by Published
-- content and cannot upload to the private bucket.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;

do $$
declare
  visible_count integer;
  denied boolean := false;
begin
  select count(*)
  into visible_count
  from storage.objects
  where id in (
    '00000000-0000-4000-8000-000000002901',
    '00000000-0000-4000-8000-000000002902'
  );

  if visible_count <> 1 then
    raise exception 'Phase 02D-2 test failed: anon saw % cover fixtures, expected only the Published cover', visible_count;
  end if;

  begin
    insert into storage.objects (id, bucket_id, name, metadata)
    values (
      '00000000-0000-4000-8000-000000002911',
      'cover-images',
      'contents/00000000-0000-4000-8000-000000002801/anon-upload.webp',
      '{"mimetype":"image/webp","size":1}'::jsonb
    );
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 02D-2 test failed: anonymous upload succeeded';
  end if;
end;
$$;

reset role;

-- An authenticated user absent from the private allow-list keeps the public
-- Published read but cannot upload.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000002d02","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002d02',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  visible_count integer;
  denied boolean := false;
begin
  select count(*)
  into visible_count
  from storage.objects
  where id in (
    '00000000-0000-4000-8000-000000002901',
    '00000000-0000-4000-8000-000000002902'
  );

  if visible_count <> 1 then
    raise exception 'Phase 02D-2 test failed: non-Keeper saw % cover fixtures, expected only the Published cover', visible_count;
  end if;

  begin
    insert into storage.objects (id, bucket_id, name, metadata)
    values (
      '00000000-0000-4000-8000-000000002912',
      'cover-images',
      'contents/00000000-0000-4000-8000-000000002802/non-keeper-upload.webp',
      '{"mimetype":"image/webp","size":1}'::jsonb
    );
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 02D-2 test failed: non-Keeper authenticated upload succeeded';
  end if;
end;
$$;

reset role;

-- The transaction-only allow-list row activates the positive Garden Keeper
-- path. The test covers private reads plus insert, update, and delete.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000002d01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000002d01',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if not private.is_garden_keeper() then
    raise exception 'Phase 02D-2 test failed: allow-listed Keeper was not authorized';
  end if;
end;
$$;

set local role authenticated;

do $$
declare
  visible_count integer;
  affected_count integer;
begin
  select count(*)
  into visible_count
  from storage.objects
  where id in (
    '00000000-0000-4000-8000-000000002901',
    '00000000-0000-4000-8000-000000002902'
  );

  if visible_count <> 2 then
    raise exception 'Phase 02D-2 test failed: Keeper saw % cover fixtures, expected 2', visible_count;
  end if;

  insert into storage.objects (id, bucket_id, name, metadata)
  values (
    '00000000-0000-4000-8000-000000002913',
    'cover-images',
    'contents/00000000-0000-4000-8000-000000002802/keeper-upload.webp',
    '{"mimetype":"image/webp","size":1}'::jsonb
  );

  update storage.objects
  set name = 'contents/00000000-0000-4000-8000-000000002802/keeper-updated.webp'
  where id = '00000000-0000-4000-8000-000000002913';
  get diagnostics affected_count = row_count;
  if affected_count <> 1 then
    raise exception 'Phase 02D-2 test failed: Keeper update affected % rows', affected_count;
  end if;

  delete from storage.objects
  where id = '00000000-0000-4000-8000-000000002913';
  get diagnostics affected_count = row_count;
  if affected_count <> 1 then
    raise exception 'Phase 02D-2 test failed: Keeper delete affected % rows', affected_count;
  end if;
end;
$$;

reset role;

rollback;
