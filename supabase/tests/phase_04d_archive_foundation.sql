-- Run this file in the Supabase Preview SQL Editor after applying all
-- migrations. Auth, content, association, Storage, and receipt fixtures are
-- transaction-local and are always rolled back.
begin;

set local statement_timeout = '30s';

do $$
declare
  rpc_security_definer boolean;
  rpc_volatility "char";
  rpc_result text;
  rpc_config text[];
begin
  select
    procedure.prosecdef,
    procedure.provolatile,
    pg_catalog.pg_get_function_result(procedure.oid),
    procedure.proconfig
  into
    rpc_security_definer,
    rpc_volatility,
    rpc_result,
    rpc_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'archive_published_content'
    and procedure.pronargs = 3;

  if not found
     or rpc_security_definer is distinct from true
     or rpc_volatility <> 'v'
     or rpc_result <> 'jsonb'
     or rpc_config is null
     or not ('search_path=pg_catalog' = any(rpc_config)) then
    raise exception 'Phase 04D-2A test failed: archive RPC is not a fixed SECURITY DEFINER jsonb command';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'public.archive_published_content(uuid,timestamp with time zone,uuid)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.archive_published_content(uuid,timestamp with time zone,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Phase 04D-2A test failed: archive RPC grants are broader or narrower than intended';
  end if;

  if pg_catalog.has_table_privilege(
       'authenticated', 'public.contents', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.contents', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_versions', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_versions', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_versions', 'DELETE'
     ) then
    raise exception 'Phase 04D-2A test failed: direct archive projection or checkpoint writes remain exposed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'content_versions'
      and indexname = 'content_versions_archive_receipt_idx'
      and indexdef ilike 'create unique index%'
  ) then
    raise exception 'Phase 04D-2A test failed: durable archive receipt index is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('contents', 'content_versions')
      and relation.relrowsecurity
    group by namespace.nspname
    having count(*) = 2
  ) then
    raise exception 'Phase 04D-2A test failed: content RLS was weakened';
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
    '00000000-0000-4000-8000-000000004a01',
    'authenticated',
    'authenticated',
    'keeper-04d-2a@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-2a-keeper"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004a02',
    'authenticated',
    'authenticated',
    'non-keeper-04d-2a@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-2a-non-keeper"}'::jsonb,
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
    '00000000-0000-4000-8000-000000004a11',
    'github-phase-04d-2a-keeper',
    '00000000-0000-4000-8000-000000004a01',
    '{"sub":"github-phase-04d-2a-keeper","user_name":"phase-04d-2a-keeper"}'::jsonb,
    'github',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004a12',
    'github-phase-04d-2a-non-keeper',
    '00000000-0000-4000-8000-000000004a02',
    '{"sub":"github-phase-04d-2a-non-keeper","user_name":"phase-04d-2a-non-keeper"}'::jsonb,
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
  '00000000-0000-4000-8000-000000004a01',
  'github',
  'github-phase-04d-2a-keeper',
  'phase-04d-2a-keeper'
);

insert into public.contents (
  id,
  legacy_id,
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
  published_at
)
values
  (
    '00000000-0000-4000-8000-000000004b01',
    'phase-04d-2a-legacy-id',
    'phase-04d-2a-archive',
    'Garden',
    'Seed',
    'full',
    'Published',
    'Growing',
    'Archive foundation',
    'Published summary remains unchanged.',
    'Published body remains unchanged.',
    'en',
    array['Coding'],
    'contents/00000000-0000-4000-8000-000000004b01/cover.webp',
    'Archive fixture cover',
    '2026-07-15 08:00:00+00',
    '2026-07-15 12:00:00+00',
    '2026-07-15 09:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000004b02',
    null,
    'phase-04d-2a-draft',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Draft cannot archive',
    null,
    null,
    'en',
    '{}'::text[],
    null,
    null,
    now(),
    '2026-07-15 12:00:00+00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000004b03',
    null,
    'phase-04d-2a-review',
    'Forest',
    'Question',
    'short',
    'Review',
    'Seed',
    'Review cannot archive',
    'Review summary',
    'Review body',
    'en',
    array['Mind & Behavior'],
    null,
    null,
    now(),
    '2026-07-15 12:00:00+00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000004b04',
    null,
    'phase-04d-2a-stale',
    'Lake',
    'Reflection',
    'short',
    'Published',
    'Sprout',
    'Stale archive must roll back',
    'Stale summary',
    'Stale body',
    'en',
    array['Internet'],
    null,
    null,
    now(),
    '2026-07-15 12:00:00+00',
    '2026-07-15 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000004b05',
    null,
    'phase-04d-2a-active-workspace',
    'Ruins',
    'Trace',
    'short',
    'Published',
    'Dormant',
    'Active workspace blocks archive',
    'Workspace summary',
    'Workspace body',
    'en',
    array['Attempts'],
    null,
    null,
    now(),
    '2026-07-15 12:00:00+00',
    '2026-07-15 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000004b06',
    null,
    'phase-04d-2a-related',
    'Garden',
    'Seed',
    'short',
    'Published',
    'Seed',
    'Related content remains',
    'Related summary',
    'Related body',
    'en',
    array['Coding'],
    null,
    null,
    now(),
    '2026-07-15 12:00:00+00',
    '2026-07-15 10:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000004b07',
    null,
    'phase-04d-2a-non-keeper',
    'Forest',
    'Question',
    'short',
    'Published',
    'Seed',
    'Non Keeper cannot archive',
    'Authorization summary',
    'Authorization body',
    'en',
    array['Humans & AI'],
    null,
    null,
    now(),
    '2026-07-15 12:00:00+00',
    '2026-07-15 10:00:00+00'
  );

insert into public.tags (id, normalized_name, display_name)
values (
  '00000000-0000-4000-8000-000000004c11',
  'archive safety',
  'Archive Safety'
);

insert into public.content_tags (content_id, tag_id)
values (
  '00000000-0000-4000-8000-000000004b01',
  '00000000-0000-4000-8000-000000004c11'
);

insert into public.growth_notes (
  id,
  content_id,
  from_stage,
  to_stage,
  note_en,
  occurred_at,
  is_public
)
values (
  '00000000-0000-4000-8000-000000004c12',
  '00000000-0000-4000-8000-000000004b01',
  'Sprout',
  'Growing',
  'This Growth Note remains after archive.',
  '2026-07-15 11:00:00+00',
  true
);

insert into public.content_relations (
  id,
  source_content_id,
  target_content_id,
  relation_type,
  note_en
)
values (
  '00000000-0000-4000-8000-000000004c13',
  '00000000-0000-4000-8000-000000004b01',
  '00000000-0000-4000-8000-000000004b06',
  'relatedTo',
  'This relation remains after archive.'
);

insert into public.home_curation (content_id, slot, sort_order)
values (
  '00000000-0000-4000-8000-000000004b01',
  'currentlyGrowing',
  0
);

insert into storage.objects (id, bucket_id, name, metadata)
values (
  '00000000-0000-4000-8000-000000004e01',
  'cover-images',
  'contents/00000000-0000-4000-8000-000000004b01/cover.webp',
  '{"mimetype":"image/webp","size":1}'::jsonb
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004a01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004a01',
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
  '00000000-0000-4000-8000-000000004d01',
  '00000000-0000-4000-8000-000000004b05',
  'Draft',
  'phase-04d-2a-active-workspace',
  'Ruins',
  'Trace',
  'short',
  'Dormant',
  'Active Draft workspace',
  'en',
  '00000000-0000-4000-8000-000000004a01',
  '00000000-0000-4000-8000-000000004a01'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004a02","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004a02',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.archive_published_content(
      '00000000-0000-4000-8000-000000004b07',
      '2026-07-15 12:00:00+00',
      '00000000-0000-4000-8000-000000004c07'
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if not rejected then
    raise exception 'Phase 04D-2A test failed: non-Keeper archived Published content';
  end if;
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004a01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004a01',
  true
);
set local role authenticated;

do $$
declare
  first_receipt jsonb;
  retry_receipt jsonb;
  rejected boolean;
begin
  select public.archive_published_content(
    '00000000-0000-4000-8000-000000004b01',
    '2026-07-15 12:00:00+00',
    '00000000-0000-4000-8000-000000004c01'
  ) into first_receipt;

  select public.archive_published_content(
    '00000000-0000-4000-8000-000000004b01',
    '2026-07-15 12:00:00+00',
    '00000000-0000-4000-8000-000000004c01'
  ) into retry_receipt;

  if retry_receipt is distinct from first_receipt then
    raise exception 'Phase 04D-2A test failed: retry did not return the original receipt';
  end if;

  rejected := false;
  begin
    perform public.archive_published_content(
      '00000000-0000-4000-8000-000000004b01',
      '2026-07-15 12:00:00+00',
      '00000000-0000-4000-8000-000000004c02'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'archive_lifecycle_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-2A test failed: a different operation re-archived content';
  end if;

  rejected := false;
  begin
    perform public.archive_published_content(
      '00000000-0000-4000-8000-000000004b02',
      '2026-07-15 12:00:00+00',
      '00000000-0000-4000-8000-000000004c03'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'archive_lifecycle_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-2A test failed: Draft content archived';
  end if;

  rejected := false;
  begin
    perform public.archive_published_content(
      '00000000-0000-4000-8000-000000004b03',
      '2026-07-15 12:00:00+00',
      '00000000-0000-4000-8000-000000004c04'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'archive_lifecycle_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-2A test failed: Review content archived';
  end if;

  rejected := false;
  begin
    perform public.archive_published_content(
      '00000000-0000-4000-8000-000000004b04',
      '2026-07-15 11:59:59+00',
      '00000000-0000-4000-8000-000000004c05'
    );
  exception
    when serialization_failure then
      rejected := sqlerrm = 'archive_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-2A test failed: stale archive concurrency token succeeded';
  end if;

  rejected := false;
  begin
    perform public.archive_published_content(
      '00000000-0000-4000-8000-000000004b05',
      '2026-07-15 12:00:00+00',
      '00000000-0000-4000-8000-000000004c06'
    );
  exception
    when sqlstate '55000' then
      rejected := sqlerrm = 'active_editorial_workspace';
  end;
  if not rejected then
    raise exception 'Phase 04D-2A test failed: active editorial workspace did not block archive';
  end if;

  rejected := false;
  begin
    update public.contents
    set lifecycle = 'Archived'
    where id = '00000000-0000-4000-8000-000000004b06';
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D-2A test failed: Keeper directly changed lifecycle to Archived';
  end if;
end;
$$;

reset role;

do $$
declare
  projection public.contents%rowtype;
  checkpoint public.content_versions%rowtype;
begin
  select candidate.*
  into projection
  from public.contents as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004b01';

  select version.*
  into checkpoint
  from public.content_versions as version
  where version.archive_operation_id = '00000000-0000-4000-8000-000000004c01';

  if projection.lifecycle <> 'Archived'
     or projection.archived_at is null
     or projection.archived_by <> '00000000-0000-4000-8000-000000004a01'
     or projection.updated_at <> projection.archived_at
     or projection.slug <> 'phase-04d-2a-archive'
     or projection.region <> 'Garden'
     or projection.legacy_id <> 'phase-04d-2a-legacy-id'
     or projection.published_at <> '2026-07-15 09:00:00+00'::timestamptz
     or projection.body_en_markdown <> 'Published body remains unchanged.'
     or projection.cover_image_path <> 'contents/00000000-0000-4000-8000-000000004b01/cover.webp' then
    raise exception 'Phase 04D-2A test failed: archive projection or stable fields are incorrect';
  end if;

  if checkpoint.content_id <> projection.id
     or checkpoint.checkpoint_reason <> 'Archived'
     or checkpoint.created_by <> '00000000-0000-4000-8000-000000004a01'
     or checkpoint.created_at <> projection.archived_at
     or checkpoint.snapshot #>> '{projection,lifecycle}' <> 'Published'
     or checkpoint.snapshot #>> '{projection,bodyEnMarkdown}' <> 'Published body remains unchanged.'
     or checkpoint.snapshot #>> '{cover,path}' <> projection.cover_image_path
     or checkpoint.snapshot #>> '{archive,operationId}' <> '00000000-0000-4000-8000-000000004c01'
     or checkpoint.snapshot #>> '{archive,archivedBy}' <> '00000000-0000-4000-8000-000000004a01'
     or jsonb_array_length(checkpoint.snapshot -> 'tags') <> 1
     or jsonb_array_length(checkpoint.snapshot -> 'relations') <> 1
     or jsonb_array_length(checkpoint.snapshot -> 'growthNotes') <> 1 then
    raise exception 'Phase 04D-2A test failed: immutable pre-archive checkpoint is incomplete';
  end if;

  if (select count(*) from public.content_versions as version
      where version.archive_operation_id = '00000000-0000-4000-8000-000000004c01') <> 1 then
    raise exception 'Phase 04D-2A test failed: archive retry created duplicate checkpoints';
  end if;

  if exists (
    select 1 from public.home_curation as curated
    where curated.content_id = projection.id
  ) then
    raise exception 'Phase 04D-2A test failed: Home curation was not removed';
  end if;

  if not exists (
    select 1 from public.content_relations as relation
    where relation.id = '00000000-0000-4000-8000-000000004c13'
      and relation.source_content_id = projection.id
      and relation.target_content_id = '00000000-0000-4000-8000-000000004b06'
  ) then
    raise exception 'Phase 04D-2A test failed: relation changed during archive';
  end if;

  if not exists (
    select 1 from public.growth_notes as note
    where note.id = '00000000-0000-4000-8000-000000004c12'
      and note.content_id = projection.id
  ) then
    raise exception 'Phase 04D-2A test failed: Growth Note changed during archive';
  end if;

  if not exists (
    select 1 from public.content_tags as binding
    where binding.content_id = projection.id
      and binding.tag_id = '00000000-0000-4000-8000-000000004c11'
  ) then
    raise exception 'Phase 04D-2A test failed: tag binding changed during archive';
  end if;

  if not exists (
    select 1 from storage.objects as object
    where object.id = '00000000-0000-4000-8000-000000004e01'
      and object.bucket_id = 'cover-images'
      and object.name = projection.cover_image_path
  ) then
    raise exception 'Phase 04D-2A test failed: Storage object or reference changed during archive';
  end if;

  if exists (
    select 1 from public.content_versions as version
    where version.content_id in (
      '00000000-0000-4000-8000-000000004b02',
      '00000000-0000-4000-8000-000000004b03',
      '00000000-0000-4000-8000-000000004b04',
      '00000000-0000-4000-8000-000000004b05',
      '00000000-0000-4000-8000-000000004b07'
    )
      and version.archive_operation_id is not null
  ) then
    raise exception 'Phase 04D-2A test failed: rejected archive left a checkpoint';
  end if;

  if exists (
    select 1 from public.contents as candidate
    where candidate.id in (
      '00000000-0000-4000-8000-000000004b04',
      '00000000-0000-4000-8000-000000004b05',
      '00000000-0000-4000-8000-000000004b07'
    )
      and candidate.lifecycle <> 'Published'
  ) then
    raise exception 'Phase 04D-2A test failed: rejected archive changed a Published projection';
  end if;
end;
$$;

rollback;
