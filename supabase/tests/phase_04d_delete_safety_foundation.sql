-- Run this file in the Supabase Preview SQL Editor after applying all
-- migrations. Every fixture and destructive assertion is transaction-local.
begin;

set local statement_timeout = '30s';

do $$
declare
  preview_security_definer boolean;
  preview_volatility "char";
  preview_result text;
  preview_config text[];
  delete_security_definer boolean;
  delete_volatility "char";
  delete_result text;
  delete_config text[];
begin
  select
    procedure.prosecdef,
    procedure.provolatile,
    pg_catalog.pg_get_function_result(procedure.oid),
    procedure.proconfig
  into
    preview_security_definer,
    preview_volatility,
    preview_result,
    preview_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'preview_archived_content_deletion'
    and procedure.pronargs = 1;

  if not found
     or preview_security_definer is distinct from true
     or preview_volatility <> 's'
     or preview_result <> 'jsonb'
     or preview_config is null
     or not ('search_path=pg_catalog' = any(preview_config)) then
    raise exception 'Phase 04D-3A test failed: impact preview is not a fixed SECURITY DEFINER jsonb boundary';
  end if;

  select
    procedure.prosecdef,
    procedure.provolatile,
    pg_catalog.pg_get_function_result(procedure.oid),
    procedure.proconfig
  into
    delete_security_definer,
    delete_volatility,
    delete_result,
    delete_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'delete_archived_content'
    and procedure.pronargs = 4;

  if not found
     or delete_security_definer is distinct from true
     or delete_volatility <> 'v'
     or delete_result <> 'jsonb'
     or delete_config is null
     or not ('search_path=pg_catalog' = any(delete_config)) then
    raise exception 'Phase 04D-3A test failed: deletion RPC is not a fixed SECURITY DEFINER jsonb command';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'public.preview_archived_content_deletion(uuid)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.preview_archived_content_deletion(uuid)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'anon',
       'public.delete_archived_content(uuid,timestamp with time zone,text,uuid)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.delete_archived_content(uuid,timestamp with time zone,text,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Phase 04D-3A test failed: delete functions have incorrect grants';
  end if;

  if pg_catalog.has_table_privilege(
       'authenticated', 'public.contents', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.route_redirects', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_versions', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_versions', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_versions', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_deletion_receipts', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_deletion_receipts', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_deletion_receipts', 'DELETE'
     ) then
    raise exception 'Phase 04D-3A test failed: direct destructive writes remain exposed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_class as child_table
      on child_table.oid = constraint_record.conrelid
    join pg_catalog.pg_class as parent_table
      on parent_table.oid = constraint_record.confrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = child_table.relnamespace
    where namespace.nspname = 'public'
      and child_table.relname = 'content_versions'
      and parent_table.relname = 'contents'
      and constraint_record.contype = 'f'
  ) then
    raise exception 'Phase 04D-3A test failed: immutable versions still depend on live contents deletion';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'content_deletion_receipts'
      and relation.relrowsecurity
  ) then
    raise exception 'Phase 04D-3A test failed: deletion receipts do not have RLS';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'contents',
        'content_versions',
        'route_redirects',
        'content_deletion_receipts'
      )
      and relation.relrowsecurity
  ) <> 4
  or not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'storage'
      and relation.relname = 'objects'
      and relation.relrowsecurity
  ) then
    raise exception 'Phase 04D-3A test failed: content or Storage RLS was weakened';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'content_deletion_receipts'
      and column_name in (
        'title',
        'body',
        'snapshot',
        'growth_notes',
        'cover_image_path',
        'cover_metadata'
      )
  ) then
    raise exception 'Phase 04D-3A test failed: receipt schema contains forbidden editorial data';
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
values
  (
    '00000000-0000-4000-8000-000000003a01',
    'authenticated',
    'authenticated',
    'keeper-04d-3a@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-3a-keeper"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000003a02',
    'authenticated',
    'authenticated',
    'non-keeper-04d-3a@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-3a-non-keeper"}'::jsonb,
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
values
  (
    '00000000-0000-4000-8000-000000003a11',
    'github-phase-04d-3a-keeper',
    '00000000-0000-4000-8000-000000003a01',
    '{"sub":"github-phase-04d-3a-keeper","user_name":"phase-04d-3a-keeper"}'::jsonb,
    'github',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000003a12',
    'github-phase-04d-3a-non-keeper',
    '00000000-0000-4000-8000-000000003a02',
    '{"sub":"github-phase-04d-3a-non-keeper","user_name":"phase-04d-3a-non-keeper"}'::jsonb,
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
  '00000000-0000-4000-8000-000000003a01',
  'github',
  'github-phase-04d-3a-keeper',
  'phase-04d-3a-keeper'
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
    '00000000-0000-4000-8000-000000003b01',
    'delete-safety',
    'Garden',
    'Seed',
    'full',
    'Archived',
    'Dormant',
    'Delete safety fixture',
    'This summary must never enter the receipt.',
    'This body remains only in immutable history.',
    'en',
    array['Coding'],
    'contents/00000000-0000-4000-8000-000000003b01/cover.webp',
    'Delete safety cover',
    '2026-07-16 01:00:00+00',
    '2026-07-16 03:00:00+00',
    '2026-07-16 01:30:00+00',
    '2026-07-16 03:00:00+00',
    '00000000-0000-4000-8000-000000003a01'
  ),
  (
    '00000000-0000-4000-8000-000000003b02',
    'delete-safety-inbound',
    'Forest',
    'Question',
    'short',
    'Published',
    'Growing',
    'Inbound relation source',
    'Published relation source.',
    'Published source body.',
    'en',
    array['Humans & AI'],
    null,
    null,
    now(),
    '2026-07-16 03:00:00+00',
    '2026-07-16 02:00:00+00',
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000003b03',
    'delete-safety-outbound',
    'Lake',
    'Reflection',
    'short',
    'Published',
    'Sprout',
    'Outbound relation target',
    'Published relation target.',
    'Published target body.',
    'en',
    array['Internet'],
    null,
    null,
    now(),
    '2026-07-16 03:00:00+00',
    '2026-07-16 02:00:00+00',
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000003b04',
    'delete-safety-published',
    'Garden',
    'Seed',
    'short',
    'Published',
    'Seed',
    'Published cannot delete',
    'Published summary.',
    'Published body.',
    'en',
    array['Coding'],
    null,
    null,
    now(),
    '2026-07-16 03:00:00+00',
    '2026-07-16 02:00:00+00',
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000003b05',
    'delete-safety-draft',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Draft cannot delete',
    null,
    null,
    'en',
    '{}'::text[],
    null,
    null,
    now(),
    '2026-07-16 03:00:00+00',
    null,
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000003b06',
    'delete-safety-review',
    'Forest',
    'Question',
    'short',
    'Review',
    'Seed',
    'Review cannot delete',
    'Review summary.',
    'Review body.',
    'en',
    array['Mind & Behavior'],
    null,
    null,
    now(),
    '2026-07-16 03:00:00+00',
    null,
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000003b07',
    'delete-safety-active',
    'Ruins',
    'Trace',
    'short',
    'Archived',
    'Dormant',
    'Active Draft blocks delete',
    'Archived summary.',
    'Archived body.',
    'en',
    array['Attempts'],
    null,
    null,
    now(),
    '2026-07-16 03:00:00+00',
    '2026-07-16 02:00:00+00',
    '2026-07-16 03:00:00+00',
    '00000000-0000-4000-8000-000000003a01'
  ),
  (
    '00000000-0000-4000-8000-000000003b08',
    'delete-safety-digest-failure',
    'Lake',
    'Reflection',
    'short',
    'Archived',
    'Dormant',
    'Digest mismatch remains intact',
    'Archived summary.',
    'Archived body.',
    'en',
    array['Internet'],
    null,
    null,
    now(),
    '2026-07-16 03:00:00+00',
    '2026-07-16 02:00:00+00',
    '2026-07-16 03:00:00+00',
    '00000000-0000-4000-8000-000000003a01'
  ),
  (
    '00000000-0000-4000-8000-000000003b09',
    'delete-safety-non-keeper',
    'Forest',
    'Question',
    'short',
    'Archived',
    'Dormant',
    'Non Keeper cannot delete',
    'Archived summary.',
    'Archived body.',
    'en',
    array['Humans & AI'],
    null,
    null,
    now(),
    '2026-07-16 03:00:00+00',
    '2026-07-16 02:00:00+00',
    '2026-07-16 03:00:00+00',
    '00000000-0000-4000-8000-000000003a01'
  );

insert into public.content_versions (
  id,
  content_id,
  snapshot,
  checkpoint_reason,
  created_at,
  created_by
)
values (
  '00000000-0000-4000-8000-000000003c01',
  '00000000-0000-4000-8000-000000003b01',
  jsonb_build_object(
    'projection', jsonb_build_object(
      'id', '00000000-0000-4000-8000-000000003b01',
      'bodyEnMarkdown', 'Immutable historical body.',
      'cover', jsonb_build_object(
        'path', 'contents/00000000-0000-4000-8000-000000003b01/cover.webp'
      )
    ),
    'cover', jsonb_build_object(
      'path', 'contents/00000000-0000-4000-8000-000000003b01/cover.webp'
    )
  ),
  'Archived',
  '2026-07-16 03:00:00+00',
  '00000000-0000-4000-8000-000000003a01'
);

insert into public.content_relations (
  id,
  source_content_id,
  target_content_id,
  relation_type,
  note_en
)
values
  (
    '00000000-0000-4000-8000-000000003c11',
    '00000000-0000-4000-8000-000000003b02',
    '00000000-0000-4000-8000-000000003b01',
    'grewInto',
    'Inbound live relation.'
  ),
  (
    '00000000-0000-4000-8000-000000003c12',
    '00000000-0000-4000-8000-000000003b01',
    '00000000-0000-4000-8000-000000003b03',
    'relatedTo',
    'Outbound live relation.'
  ),
  (
    '00000000-0000-4000-8000-000000003c13',
    '00000000-0000-4000-8000-000000003b08',
    '00000000-0000-4000-8000-000000003b03',
    'relatedTo',
    'Failed deletion must preserve this relation.'
  );

insert into public.route_redirects (
  id,
  old_path,
  new_path,
  status_code,
  content_id,
  created_at
)
values
  (
    '00000000-0000-4000-8000-000000003c21',
    '/forest/delete-safety-old',
    '/garden/delete-safety',
    308,
    '00000000-0000-4000-8000-000000003b01',
    '2026-07-16 01:45:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000003c22',
    '/garden/delete-safety-first',
    null,
    410,
    '00000000-0000-4000-8000-000000003b01',
    '2026-07-16 01:50:00+00'
  );

insert into public.tags (id, normalized_name, display_name)
values (
  '00000000-0000-4000-8000-000000003c31',
  'delete safety',
  'Delete Safety'
);

insert into public.content_tags (content_id, tag_id)
values (
  '00000000-0000-4000-8000-000000003b01',
  '00000000-0000-4000-8000-000000003c31'
);

insert into public.growth_notes (
  id,
  content_id,
  from_stage,
  to_stage,
  note_en,
  is_public
)
values (
  '00000000-0000-4000-8000-000000003c32',
  '00000000-0000-4000-8000-000000003b01',
  'Growing',
  'Dormant',
  'Live Growth Note cascades with the projection.',
  false
);

insert into public.home_curation (content_id, slot, sort_order)
values (
  '00000000-0000-4000-8000-000000003b01',
  'currentlyGrowing',
  0
);

insert into public.preview_tokens (
  id,
  content_id,
  token_hash,
  expires_at,
  created_by
)
values (
  '00000000-0000-4000-8000-000000003c33',
  '00000000-0000-4000-8000-000000003b01',
  'phase-04d-3a-preview-token-hash-0000000000000000',
  now() + interval '1 day',
  '00000000-0000-4000-8000-000000003a01'
);

insert into storage.objects (id, bucket_id, name, metadata)
values (
  '00000000-0000-4000-8000-000000003e01',
  'cover-images',
  'contents/00000000-0000-4000-8000-000000003b01/cover.webp',
  '{"mimetype":"image/webp","size":1}'::jsonb
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003a01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003a01',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

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
  created_by,
  updated_by
)
values (
  '00000000-0000-4000-8000-000000003d01',
  '00000000-0000-4000-8000-000000003b07',
  'Draft',
  'delete-safety-active',
  'Ruins',
  'Trace',
  'short',
  'Dormant',
  'Active Draft workspace',
  'en',
  '00000000-0000-4000-8000-000000003a01',
  '00000000-0000-4000-8000-000000003a01'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003a02","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003a02',
  true
);
set local role authenticated;

do $$
declare
  rejected_preview boolean := false;
  rejected_delete boolean := false;
begin
  begin
    perform public.preview_archived_content_deletion(
      '00000000-0000-4000-8000-000000003b09'
    );
  exception
    when insufficient_privilege then
      rejected_preview := true;
  end;

  begin
    perform public.delete_archived_content(
      '00000000-0000-4000-8000-000000003b09',
      '2026-07-16 03:00:00+00',
      '00000000000000000000000000000000',
      '00000000-0000-4000-8000-000000003f09'
    );
  exception
    when insufficient_privilege then
      rejected_delete := true;
  end;

  if not rejected_preview or not rejected_delete then
    raise exception 'Phase 04D-3A test failed: non-Keeper crossed the deletion boundary';
  end if;
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000003a01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000003a01',
  true
);
set local role authenticated;

do $$
declare
  preview jsonb;
  active_preview jsonb;
  failed_preview jsonb;
  first_receipt jsonb;
  retry_receipt jsonb;
  completed_receipt jsonb;
  rejected boolean;
begin
  select public.preview_archived_content_deletion(
    '00000000-0000-4000-8000-000000003b01'
  ) into preview;

  if preview ->> 'canonicalRoute' <> '/garden/delete-safety'
     or jsonb_array_length(preview -> 'historicalRoutes') <> 2
     or jsonb_array_length(preview -> 'redirectReferences') <> 2
     or (preview ->> 'versionCount')::integer <> 1
     or (preview #>> '{revisionStatus,active}')::boolean
     or jsonb_array_length(preview -> 'inboundRelations') <> 1
     or jsonb_array_length(preview -> 'outboundRelations') <> 1
     or (preview ->> 'storageReferenceCount')::integer <> 2
     or jsonb_array_length(preview -> 'affectedInvalidationSurfaces') <> 4
     or preview ->> 'impactDigest' !~ '^[0-9a-f]{32}$'
     or (preview ->> 'expectedArchivedToken')::timestamptz <>
       '2026-07-16 03:00:00+00'::timestamptz
     or preview::text like '%cover.webp%'
     or preview::text like '%This body remains%' then
    raise exception 'Phase 04D-3A test failed: server impact preview is incomplete or leaks private data';
  end if;

  select public.delete_archived_content(
    '00000000-0000-4000-8000-000000003b01',
    (preview ->> 'expectedArchivedToken')::timestamptz,
    preview ->> 'impactDigest',
    '00000000-0000-4000-8000-000000003f01'
  ) into first_receipt;

  select public.delete_archived_content(
    '00000000-0000-4000-8000-000000003b01',
    (preview ->> 'expectedArchivedToken')::timestamptz,
    preview ->> 'impactDigest',
    '00000000-0000-4000-8000-000000003f01'
  ) into retry_receipt;

  if retry_receipt is distinct from first_receipt
     or first_receipt ->> 'status' <> 'deleted' then
    raise exception 'Phase 04D-3A test failed: same-operation retry did not return the original receipt';
  end if;

  select public.delete_archived_content(
    '00000000-0000-4000-8000-000000003b01',
    (preview ->> 'expectedArchivedToken')::timestamptz,
    preview ->> 'impactDigest',
    '00000000-0000-4000-8000-000000003f02'
  ) into completed_receipt;

  if completed_receipt ->> 'status' <> 'already_completed'
     or completed_receipt ->> 'operationId' <>
       '00000000-0000-4000-8000-000000003f01' then
    raise exception 'Phase 04D-3A test failed: different-operation retry was not typed already-completed';
  end if;

  foreach preview in array array[
    jsonb_build_object(
      'contentId', '00000000-0000-4000-8000-000000003b04',
      'token', '2026-07-16 03:00:00+00'
    ),
    jsonb_build_object(
      'contentId', '00000000-0000-4000-8000-000000003b05',
      'token', '2026-07-16 03:00:00+00'
    ),
    jsonb_build_object(
      'contentId', '00000000-0000-4000-8000-000000003b06',
      'token', '2026-07-16 03:00:00+00'
    )
  ] loop
    rejected := false;
    begin
      perform public.delete_archived_content(
        (preview ->> 'contentId')::uuid,
        (preview ->> 'token')::timestamptz,
        '00000000000000000000000000000000',
        '00000000-0000-4000-8000-000000003f10'
      );
    exception
      when invalid_parameter_value then
        rejected := sqlerrm = 'delete_lifecycle_conflict';
    end;

    if not rejected then
      raise exception 'Phase 04D-3A test failed: non-Archived lifecycle was deleted';
    end if;
  end loop;

  select public.preview_archived_content_deletion(
    '00000000-0000-4000-8000-000000003b07'
  ) into active_preview;

  if not (active_preview #>> '{revisionStatus,active}')::boolean
     or active_preview #>> '{revisionStatus,lifecycle}' <> 'Draft' then
    raise exception 'Phase 04D-3A test failed: active revision status missing from preview';
  end if;

  rejected := false;
  begin
    perform public.delete_archived_content(
      '00000000-0000-4000-8000-000000003b07',
      (active_preview ->> 'expectedArchivedToken')::timestamptz,
      active_preview ->> 'impactDigest',
      '00000000-0000-4000-8000-000000003f07'
    );
  exception
    when sqlstate '55000' then
      rejected := sqlerrm = 'active_editorial_workspace';
  end;
  if not rejected then
    raise exception 'Phase 04D-3A test failed: active Draft did not block deletion';
  end if;

  select public.preview_archived_content_deletion(
    '00000000-0000-4000-8000-000000003b08'
  ) into failed_preview;

  rejected := false;
  begin
    perform public.delete_archived_content(
      '00000000-0000-4000-8000-000000003b08',
      (failed_preview ->> 'expectedArchivedToken')::timestamptz,
      case
        when failed_preview ->> 'impactDigest' =
          '00000000000000000000000000000000'
          then '11111111111111111111111111111111'
        else '00000000000000000000000000000000'
      end,
      '00000000-0000-4000-8000-000000003f08'
    );
  exception
    when serialization_failure then
      rejected := sqlerrm = 'impact_digest_mismatch';
  end;
  if not rejected then
    raise exception 'Phase 04D-3A test failed: impact digest mismatch succeeded';
  end if;

  rejected := false;
  begin
    delete from public.contents
    where id = '00000000-0000-4000-8000-000000003b09';
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D-3A test failed: Keeper directly deleted contents';
  end if;

  rejected := false;
  begin
    delete from public.route_redirects
    where old_path = '/garden/delete-safety';
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D-3A test failed: Keeper directly deleted a route tombstone';
  end if;
end;
$$;

reset role;

do $$
declare
  receipt public.content_deletion_receipts%rowtype;
  immutable_snapshot jsonb;
begin
  if exists (
    select 1
    from public.contents as content
    where content.id = '00000000-0000-4000-8000-000000003b01'
  ) then
    raise exception 'Phase 04D-3A test failed: Archived live projection was not deleted';
  end if;

  select version.snapshot
  into immutable_snapshot
  from public.content_versions as version
  where version.id = '00000000-0000-4000-8000-000000003c01'
    and version.content_id = '00000000-0000-4000-8000-000000003b01';

  if not found
     or immutable_snapshot #>> '{projection,bodyEnMarkdown}' <>
       'Immutable historical body.'
     or immutable_snapshot #>> '{cover,path}' <>
       'contents/00000000-0000-4000-8000-000000003b01/cover.webp' then
    raise exception 'Phase 04D-3A test failed: immutable version was changed or deleted';
  end if;

  if exists (
    select 1
    from public.content_relations as relation
    where relation.source_content_id =
        '00000000-0000-4000-8000-000000003b01'
       or relation.target_content_id =
        '00000000-0000-4000-8000-000000003b01'
  ) then
    raise exception 'Phase 04D-3A test failed: live inbound or outbound relations remain';
  end if;

  if exists (
    select 1 from public.growth_notes as note
    where note.content_id = '00000000-0000-4000-8000-000000003b01'
  )
  or exists (
    select 1 from public.content_tags as binding
    where binding.content_id = '00000000-0000-4000-8000-000000003b01'
  )
  or exists (
    select 1 from public.home_curation as curated
    where curated.content_id = '00000000-0000-4000-8000-000000003b01'
  )
  or exists (
    select 1 from public.preview_tokens as token
    where token.content_id = '00000000-0000-4000-8000-000000003b01'
  ) then
    raise exception 'Phase 04D-3A test failed: cascading live dependents remain';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.id = '00000000-0000-4000-8000-000000003e01'
      and object.name =
        'contents/00000000-0000-4000-8000-000000003b01/cover.webp'
  ) then
    raise exception 'Phase 04D-3A test failed: Storage object was deleted';
  end if;

  if (
    select count(*)
    from public.route_redirects as redirect
    where redirect.tombstone_original_content_id =
        '00000000-0000-4000-8000-000000003b01'
      and redirect.tombstone_operation_id =
        '00000000-0000-4000-8000-000000003f01'
      and redirect.status_code = 410
      and redirect.new_path is null
      and redirect.content_id is null
      and redirect.tombstoned_at is not null
  ) <> 3 then
    raise exception 'Phase 04D-3A test failed: canonical and historical tombstones are incomplete';
  end if;

  if not exists (
    select 1
    from public.route_redirects as redirect
    where redirect.old_path = '/garden/delete-safety'
      and redirect.created_at = redirect.tombstoned_at
  ) then
    raise exception 'Phase 04D-3A test failed: canonical tombstone creation time is missing';
  end if;

  select candidate.*
  into receipt
  from public.content_deletion_receipts as candidate
  where candidate.original_content_id =
    '00000000-0000-4000-8000-000000003b01';

  if not found
     or receipt.operation_id <>
       '00000000-0000-4000-8000-000000003f01'
     or receipt.actor_id <>
       '00000000-0000-4000-8000-000000003a01'
     or receipt.impact_counts ->> 'versionCount' <> '1'
     or receipt.impact_counts ->> 'inboundRelationCount' <> '1'
     or receipt.impact_counts ->> 'outboundRelationCount' <> '1'
     or receipt.impact_counts ->> 'storageReferenceCount' <> '2'
     or receipt.tombstone_result ->> 'requestedCount' <> '3'
     or receipt.tombstone_result ->> 'createdCount' <> '3'
     or receipt.tombstone_result ->> 'insertedCount' <> '1'
     or receipt.tombstone_result ->> 'convertedCount' <> '2'
     or receipt::text like '%Immutable historical body%'
     or receipt::text like '%cover.webp%' then
    raise exception 'Phase 04D-3A test failed: deletion receipt is incomplete or contains forbidden data';
  end if;

  if not exists (
    select 1
    from public.contents as content
    where content.id = '00000000-0000-4000-8000-000000003b08'
      and content.lifecycle = 'Archived'
  )
  or not exists (
    select 1
    from public.content_relations as relation
    where relation.id = '00000000-0000-4000-8000-000000003c13'
  )
  or exists (
    select 1
    from public.content_deletion_receipts as failed_receipt
    where failed_receipt.original_content_id =
      '00000000-0000-4000-8000-000000003b08'
  )
  or exists (
    select 1
    from public.route_redirects as failed_tombstone
    where failed_tombstone.tombstone_original_content_id =
      '00000000-0000-4000-8000-000000003b08'
  ) then
    raise exception 'Phase 04D-3A test failed: failed deletion did not roll back atomically';
  end if;
end;
$$;

rollback;
