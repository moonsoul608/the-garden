-- Run in the Supabase Preview SQL Editor after applying all migrations.
-- Every reference, Auth, lifecycle, and Storage fixture is rolled back.
begin;

set local statement_timeout = '30s';

do $$
declare
  storage_policy_count integer;
begin
  if to_regclass('public.storage_object_references') is null
     or to_regclass('public.storage_object_lifecycles') is null then
    raise exception 'Phase 04D-3B test failed: reference tables are missing';
  end if;

  if pg_catalog.has_table_privilege(
       'anon', 'public.storage_object_references', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.storage_object_references', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'anon', 'public.storage_object_lifecycles', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.storage_object_lifecycles', 'SELECT'
     ) then
    raise exception 'Phase 04D-3B test failed: browser role can inspect reference paths';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'public.inspect_storage_object_purge_safety(text,text)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.inspect_storage_object_purge_safety(text,text)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.quarantine_failed_storage_upload(text,text,interval)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'public.mark_storage_object_post_delete_bypass(text,text)',
       'EXECUTE'
     ) then
    raise exception 'Phase 04D-3B test failed: browser role crossed server-only Storage boundary';
  end if;

  if pg_catalog.has_table_privilege(
       'authenticated', 'storage.objects', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'anon', 'storage.objects', 'DELETE'
     ) then
    raise exception 'Phase 04D-3B test failed: direct browser Storage delete privilege remains';
  end if;

  select count(*)
  into storage_policy_count
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

  if storage_policy_count <> 5 then
    raise exception 'Phase 04D-3B test failed: existing Storage policies changed';
  end if;
end;
$$;

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
  '00000000-0000-4000-8000-000000004d01',
  'authenticated',
  'authenticated',
  'keeper-04d-3b@example.invalid',
  '',
  now(),
  '{"provider":"github","providers":["github"]}'::jsonb,
  '{"user_name":"phase-04d-3b-keeper"}'::jsonb,
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
  '00000000-0000-4000-8000-000000004d11',
  'github-phase-04d-3b-keeper',
  '00000000-0000-4000-8000-000000004d01',
  '{"sub":"github-phase-04d-3b-keeper","user_name":"phase-04d-3b-keeper"}'::jsonb,
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
  '00000000-0000-4000-8000-000000004d01',
  'github',
  'github-phase-04d-3b-keeper',
  'phase-04d-3b-keeper'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004d01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004d01',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.contents (
  id,
  slug,
  region,
  content_type,
  detail_level,
  lifecycle,
  growth_stage,
  title_en,
  summary_en,
  body_en_markdown,
  content_language,
  primary_categories,
  cover_image_path,
  cover_image_alt_en,
  created_at,
  updated_at,
  published_at,
  archived_at,
  archived_by
)
values
  (
    '00000000-0000-4000-8000-000000004e01',
    'storage-projection-reference',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Projection reference',
    null,
    null,
    'en',
    '{}',
    'contents/00000000-0000-4000-8000-000000004e01/projection.webp',
    null,
    now(),
    now(),
    null,
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000004e02',
    'storage-revision-reference',
    'Forest',
    'Question',
    'short',
    'Draft',
    'Seed',
    'Revision reference',
    null,
    null,
    'en',
    '{}',
    null,
    null,
    now(),
    now(),
    null,
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000004e03',
    'storage-version-reference',
    'Lake',
    'Reflection',
    'short',
    'Draft',
    'Seed',
    'Version reference',
    null,
    null,
    'en',
    '{}',
    null,
    null,
    now(),
    now(),
    null,
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000004e04',
    'storage-archive-reference',
    'Ruins',
    'Trace',
    'short',
    'Archived',
    'Dormant',
    'Archive checkpoint reference',
    'Archived checkpoint reference.',
    'Archived checkpoint body.',
    'en',
    array['Drafts'],
    null,
    null,
    now() - interval '2 days',
    now() - interval '1 day',
    now() - interval '2 days',
    now() - interval '1 day',
    '00000000-0000-4000-8000-000000004d01'
  ),
  (
    '00000000-0000-4000-8000-000000004e05',
    'storage-quarantine-reference',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Quarantine reference',
    null,
    null,
    'en',
    '{}',
    'contents/00000000-0000-4000-8000-000000004e05/replaced.webp',
    null,
    now(),
    now(),
    null,
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000004e06',
    'storage-delete-reference',
    'Garden',
    'Seed',
    'full',
    'Archived',
    'Dormant',
    'Delete keeps Storage',
    'Delete must retain the physical object.',
    'Immutable history protects this object.',
    'en',
    array['Coding'],
    'contents/00000000-0000-4000-8000-000000004e06/delete.webp',
    'Delete fixture cover',
    now() - interval '2 days',
    now() - interval '1 day',
    now() - interval '2 days',
    now() - interval '1 day',
    '00000000-0000-4000-8000-000000004d01'
  );

insert into public.content_revisions (
  id,
  content_id,
  lifecycle,
  slug,
  region,
  content_type,
  detail_level,
  growth_stage,
  title_en,
  content_language,
  cover_image_path,
  created_by,
  updated_by
)
values (
  '00000000-0000-4000-8000-000000004f02',
  '00000000-0000-4000-8000-000000004e02',
  'Draft',
  'storage-revision-reference',
  'Forest',
  'Question',
  'short',
  'Seed',
  'Revision reference',
  'en',
  'contents/00000000-0000-4000-8000-000000004e02/revision.webp',
  '00000000-0000-4000-8000-000000004d01',
  '00000000-0000-4000-8000-000000004d01'
);

insert into public.content_versions (
  id,
  content_id,
  snapshot,
  checkpoint_reason,
  created_at,
  created_by
)
values
  (
    '00000000-0000-4000-8000-000000004f03',
    '00000000-0000-4000-8000-000000004e03',
    jsonb_build_object(
      'projection', jsonb_build_object(
        'cover', jsonb_build_object(
          'path', 'contents/00000000-0000-4000-8000-000000004e03/version.webp'
        )
      )
    ),
    'Published',
    now(),
    '00000000-0000-4000-8000-000000004d01'
  ),
  (
    '00000000-0000-4000-8000-000000004f04',
    '00000000-0000-4000-8000-000000004e04',
    jsonb_build_object(
      'cover', jsonb_build_object(
        'path', 'contents/00000000-0000-4000-8000-000000004e04/archive.webp'
      ),
      'archive', jsonb_build_object('checkpoint', true)
    ),
    'Archived',
    now(),
    '00000000-0000-4000-8000-000000004d01'
  ),
  (
    '00000000-0000-4000-8000-000000004f06',
    '00000000-0000-4000-8000-000000004e06',
    jsonb_build_object(
      'projection', jsonb_build_object(
        'cover', jsonb_build_object(
          'path', 'contents/00000000-0000-4000-8000-000000004e06/delete.webp'
        )
      ),
      'cover', jsonb_build_object(
        'path', 'contents/00000000-0000-4000-8000-000000004e06/delete.webp'
      )
    ),
    'Archived',
    now(),
    '00000000-0000-4000-8000-000000004d01'
  );

insert into storage.objects (id, bucket_id, name, metadata)
values (
  '00000000-0000-4000-8000-000000004f16',
  'cover-images',
  'contents/00000000-0000-4000-8000-000000004e06/delete.webp',
  '{"mimetype":"image/webp","size":1}'::jsonb
);

do $$
declare
  inspection jsonb;
begin
  select public.inspect_storage_object_purge_safety(
    'cover-images',
    'contents/00000000-0000-4000-8000-000000004e01/projection.webp'
  ) into inspection;
  if (inspection ->> 'eligible')::boolean
     or (inspection ->> 'projectionReferenceCount')::integer <> 1 then
    raise exception 'Phase 04D-3B test failed: projection reference allowed purge';
  end if;

  select public.inspect_storage_object_purge_safety(
    'cover-images',
    'contents/00000000-0000-4000-8000-000000004e02/revision.webp'
  ) into inspection;
  if (inspection ->> 'eligible')::boolean
     or (inspection ->> 'activeRevisionReferenceCount')::integer <> 1 then
    raise exception 'Phase 04D-3B test failed: active revision reference allowed purge';
  end if;

  select public.inspect_storage_object_purge_safety(
    'cover-images',
    'contents/00000000-0000-4000-8000-000000004e03/version.webp'
  ) into inspection;
  if (inspection ->> 'eligible')::boolean
     or (inspection ->> 'versionReferenceCount')::integer <> 1 then
    raise exception 'Phase 04D-3B test failed: immutable version reference allowed purge';
  end if;

  select public.inspect_storage_object_purge_safety(
    'cover-images',
    'contents/00000000-0000-4000-8000-000000004e04/archive.webp'
  ) into inspection;
  if (inspection ->> 'eligible')::boolean
     or (inspection ->> 'versionReferenceCount')::integer <> 1 then
    raise exception 'Phase 04D-3B test failed: archive checkpoint reference allowed purge';
  end if;
end;
$$;

update public.contents
set cover_image_path = null
where id = '00000000-0000-4000-8000-000000004e05';

do $$
declare
  inspection jsonb;
  lifecycle public.storage_object_lifecycles%rowtype;
begin
  select registry.*
  into lifecycle
  from public.storage_object_lifecycles as registry
  where registry.bucket = 'cover-images'
    and registry.object_path =
      'contents/00000000-0000-4000-8000-000000004e05/replaced.webp';

  if lifecycle.lifecycle_state <> 'Quarantine'
     or lifecycle.quarantine_reason <> 'OrdinaryReplacement'
     or lifecycle.quarantine_until < lifecycle.unreferenced_at + interval '30 days'
     or lifecycle.quarantine_until > lifecycle.unreferenced_at + interval '30 days 1 second' then
    raise exception 'Phase 04D-3B test failed: ordinary replacement did not enter 30-day quarantine';
  end if;

  select public.inspect_storage_object_purge_safety(
    'cover-images',
    'contents/00000000-0000-4000-8000-000000004e05/replaced.webp'
  ) into inspection;
  if (inspection ->> 'eligible')::boolean
     or not (inspection -> 'blockingReasons' ? 'quarantine_not_elapsed') then
    raise exception 'Phase 04D-3B test failed: quarantine candidate became eligible immediately';
  end if;

  update public.storage_object_lifecycles
  set
    lifecycle_state = 'EligibleForPurge',
    quarantine_started_at = statement_timestamp() - interval '1 day',
    quarantine_until = statement_timestamp() - interval '1 second',
    updated_at = statement_timestamp()
  where bucket = 'cover-images'
    and object_path =
      'contents/00000000-0000-4000-8000-000000004e05/replaced.webp';

  select public.inspect_storage_object_purge_safety(
    'cover-images',
    'contents/00000000-0000-4000-8000-000000004e05/replaced.webp'
  ) into inspection;
  if not (inspection ->> 'eligible')::boolean then
    raise exception 'Phase 04D-3B test failed: elapsed zero-reference quarantine is not a purge candidate';
  end if;
end;
$$;

do $$
declare
  failed_upload jsonb;
begin
  select public.quarantine_failed_storage_upload(
    'cover-images',
    'failed-uploads/phase-04d-3b.webp',
    interval '2 hours'
  ) into failed_upload;

  if failed_upload ->> 'quarantineReason' <> 'FailedUpload'
     or failed_upload ->> 'lifecycleState' <> 'Quarantine'
     or (failed_upload ->> 'quarantineUntil')::timestamptz <
       statement_timestamp() + interval '1 hour 59 minutes' then
    raise exception 'Phase 04D-3B test failed: failed-upload grace period is not separate';
  end if;
end;
$$;

set local role authenticated;

do $$
declare
  preview jsonb;
  receipt jsonb;
  denied boolean := false;
begin
  select public.preview_archived_content_deletion(
    '00000000-0000-4000-8000-000000004e06'
  ) into preview;

  select public.delete_archived_content(
    '00000000-0000-4000-8000-000000004e06',
    (preview ->> 'expectedArchivedToken')::timestamptz,
    preview ->> 'impactDigest',
    '00000000-0000-4000-8000-000000004f26'
  ) into receipt;

  if receipt ->> 'status' <> 'deleted' then
    raise exception 'Phase 04D-3B test failed: delete fixture did not complete';
  end if;

  begin
    delete from storage.objects
    where id = '00000000-0000-4000-8000-000000004f16';
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 04D-3B test failed: Keeper directly deleted a Storage object';
  end if;

  denied := false;
  begin
    perform public.inspect_storage_object_purge_safety(
      'cover-images',
      'contents/00000000-0000-4000-8000-000000004e06/delete.webp'
    );
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception 'Phase 04D-3B test failed: Keeper invoked the service-role purge contract';
  end if;
end;
$$;

reset role;

do $$
declare
  inspection jsonb;
  bypass_blocked boolean := false;
  physical_count integer;
begin
  select count(*)
  into physical_count
  from storage.objects
  where id = '00000000-0000-4000-8000-000000004f16';

  if physical_count <> 1 then
    raise exception 'Phase 04D-3B test failed: content delete removed the physical Storage object';
  end if;

  select public.inspect_storage_object_purge_safety(
    'cover-images',
    'contents/00000000-0000-4000-8000-000000004e06/delete.webp'
  ) into inspection;

  if (inspection ->> 'eligible')::boolean
     or (inspection ->> 'projectionReferenceCount')::integer <> 0
     or (inspection ->> 'versionReferenceCount')::integer <> 1 then
    raise exception 'Phase 04D-3B test failed: deleted projection bypassed immutable version protection';
  end if;

  begin
    perform public.mark_storage_object_post_delete_bypass(
      'cover-images',
      'contents/00000000-0000-4000-8000-000000004e06/delete.webp'
    );
  exception
    when sqlstate '55000' then
      bypass_blocked := sqlerrm = 'storage_object_still_referenced';
  end;

  if not bypass_blocked then
    raise exception 'Phase 04D-3B test failed: post-delete bypass ignored a version reference';
  end if;
end;
$$;

rollback;
