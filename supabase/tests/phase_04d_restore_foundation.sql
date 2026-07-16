-- Run this file in the Supabase Preview SQL Editor after applying all
-- migrations. Auth, content, version, association, Storage, and failure
-- fixtures are transaction-local and are always rolled back.
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
    and procedure.proname = 'restore_version_to_draft'
    and procedure.pronargs = 4;

  if not found
     or rpc_security_definer is distinct from true
     or rpc_volatility <> 'v'
     or rpc_result <> 'jsonb'
     or rpc_config is null
     or not ('search_path=pg_catalog' = any(rpc_config)) then
    raise exception 'Phase 04D-2B test failed: restore RPC is not a fixed SECURITY DEFINER jsonb command';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'public.restore_version_to_draft(uuid,uuid,timestamp with time zone,uuid)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.restore_version_to_draft(uuid,uuid,timestamp with time zone,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Phase 04D-2B test failed: restore RPC grants are broader or narrower than intended';
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
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_revisions', 'DELETE'
     )
     or not pg_catalog.has_table_privilege(
       'authenticated', 'public.content_revisions', 'INSERT'
     )
     or not pg_catalog.has_table_privilege(
       'authenticated', 'public.content_revisions', 'UPDATE'
     ) then
    raise exception 'Phase 04D-2B test failed: direct table grants do not preserve the command boundary';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'contents',
        'content_revisions',
        'content_versions'
      )
      and relation.relrowsecurity
    group by namespace.nspname
    having count(*) = 3
  ) then
    raise exception 'Phase 04D-2B test failed: content RLS was weakened';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'content_versions'
      and (
        (column_name in (
          'restore_operation_id',
          'restore_source_version_id',
          'restore_revision_id'
        ) and data_type = 'uuid')
        or (
          column_name = 'restore_archived_token'
          and data_type = 'timestamp with time zone'
        )
      )
  ) <> 4 then
    raise exception 'Phase 04D-2B test failed: durable restore receipt columns are missing or mistyped';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'content_revisions'
      and (
        (column_name in ('restore_operation_id', 'restored_by') and data_type = 'uuid')
        or (
          column_name = 'restored_at'
          and data_type = 'timestamp with time zone'
        )
      )
  ) <> 3 then
    raise exception 'Phase 04D-2B test failed: Draft restore provenance columns are missing or mistyped';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'content_versions'
      and indexdef ilike 'create unique index%restore_operation_id%'
  ) then
    raise exception 'Phase 04D-2B test failed: durable restore receipt index is missing';
  end if;
end;
$$;

-- A transaction-local helper keeps the individual source-version fixtures
-- readable while still producing the complete snapshot shape written by the
-- existing publication/archive commands.
create temporary table phase_04d_restore_fixture_marker (
  value integer
) on commit drop;

create function pg_temp.phase_04d_restore_snapshot(
  p_content_id uuid,
  p_slug text,
  p_region text,
  p_content_type text,
  p_detail_level text,
  p_growth_stage text,
  p_category text,
  p_title text,
  p_cover_path text default null,
  p_cover_alt text default null,
  p_tags jsonb default '[]'::jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'projection', jsonb_build_object(
      'id', p_content_id,
      'legacyId', null,
      'slug', p_slug,
      'region', p_region,
      'contentType', p_content_type,
      'detailLevel', p_detail_level,
      'lifecycle', 'Published',
      'growthStage', p_growth_stage,
      'titleZh', null,
      'titleEn', p_title,
      'summaryZh', null,
      'summaryEn', p_title || ' summary',
      'bodyZhMarkdown', null,
      'bodyEnMarkdown', p_title || ' body',
      'contentLanguage', 'en',
      'primaryCategories', jsonb_build_array(p_category),
      'cover', case
        when p_cover_path is null then null
        else jsonb_build_object(
          'path', p_cover_path,
          'altZh', null,
          'altEn', p_cover_alt
        )
      end,
      'featured', true,
      'manualOrder', 17,
      'createdAt', '2026-07-15T00:00:00+00:00',
      'updatedAt', '2026-07-15T01:00:00+00:00',
      'publishedAt', '2026-07-15T01:00:00+00:00',
      'archivedAt', null,
      'lastTendedAt', '2026-07-15T01:00:00+00:00',
      'createdBy', 'ffffffff-ffff-4fff-8fff-fffffffffff1',
      'updatedBy', 'ffffffff-ffff-4fff-8fff-fffffffffff2'
    ),
    'tags', p_tags,
    'relations', '[]'::jsonb,
    'growthNotes', '[]'::jsonb,
    'cover', case
      when p_cover_path is null then null
      else jsonb_build_object(
        'path', p_cover_path,
        'altZh', null,
        'altEn', p_cover_alt
      )
    end,
    'publication', jsonb_build_object(
      'publishedAt', '2026-07-15T01:00:00+00:00',
      'publishedBy', 'ffffffff-ffff-4fff-8fff-fffffffffff3',
      'sourceRevisionId', 'ffffffff-ffff-4fff-8fff-fffffffffff4',
      'sourceLockVersion', 9
    )
  );
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
    '00000000-0000-4000-8000-000000004f01',
    'authenticated',
    'authenticated',
    'keeper-04d-2b@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-2b-keeper"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004f02',
    'authenticated',
    'authenticated',
    'non-keeper-04d-2b@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-2b-non-keeper"}'::jsonb,
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
    '00000000-0000-4000-8000-000000004f11',
    'github-phase-04d-2b-keeper',
    '00000000-0000-4000-8000-000000004f01',
    '{"sub":"github-phase-04d-2b-keeper","user_name":"phase-04d-2b-keeper"}'::jsonb,
    'github',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004f12',
    'github-phase-04d-2b-non-keeper',
    '00000000-0000-4000-8000-000000004f02',
    '{"sub":"github-phase-04d-2b-non-keeper","user_name":"phase-04d-2b-non-keeper"}'::jsonb,
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
  '00000000-0000-4000-8000-000000004f01',
  'github',
  'github-phase-04d-2b-keeper',
  'phase-04d-2b-keeper'
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
  featured,
  manual_order,
  created_at,
  updated_at,
  published_at,
  archived_at,
  archived_by,
  last_tended_at,
  created_by,
  updated_by
)
values
  (
    '00000000-0000-4000-8000-000000005001',
    'phase-04d-2b-published-source',
    'Garden',
    'Seed',
    'short',
    'Archived',
    'Dormant',
    'Current archived projection',
    'Current archived summary',
    'Current archived body',
    'en',
    array['AI'],
    'contents/00000000-0000-4000-8000-000000005001/current.webp',
    'Current archived cover',
    true,
    4,
    '2026-07-15 00:00:00+00',
    '2026-07-16 01:00:00+00',
    '2026-07-15 01:00:00+00',
    '2026-07-16 01:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '2026-07-15 23:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005002',
    'phase-04d-2b-archived-source',
    'Forest',
    'Question',
    'short',
    'Archived',
    'Growing',
    'Second current archived projection',
    'Second current archived summary',
    'Second current archived body',
    'en',
    array['Humans & AI'],
    null,
    null,
    true,
    5,
    '2026-07-15 00:00:00+00',
    '2026-07-16 02:00:00+00',
    '2026-07-15 02:00:00+00',
    '2026-07-16 02:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '2026-07-15 23:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005003',
    'phase-04d-2b-published-conflict',
    'Lake',
    'Reflection',
    'short',
    'Published',
    'Bloom',
    'Published cannot restore',
    'Published conflict summary',
    'Published conflict body',
    'en',
    array['Internet'],
    null,
    null,
    false,
    null,
    '2026-07-15 00:00:00+00',
    '2026-07-16 03:00:00+00',
    '2026-07-15 03:00:00+00',
    null,
    null,
    '2026-07-16 03:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005004',
    'phase-04d-2b-workspace-conflict',
    'Ruins',
    'Trace',
    'short',
    'Archived',
    'Dormant',
    'Generic workspace blocks restore',
    'Generic workspace summary',
    'Generic workspace body',
    'en',
    array['Attempts'],
    null,
    null,
    false,
    null,
    '2026-07-15 00:00:00+00',
    '2026-07-16 04:00:00+00',
    '2026-07-15 04:00:00+00',
    '2026-07-16 04:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '2026-07-16 04:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005005',
    'phase-04d-2b-invalid-source',
    'Garden',
    'Seed',
    'short',
    'Archived',
    'Seed',
    'Invalid sources roll back',
    'Invalid source summary',
    'Invalid source body',
    'en',
    array['Coding'],
    null,
    null,
    false,
    null,
    '2026-07-15 00:00:00+00',
    '2026-07-16 05:00:00+00',
    '2026-07-15 05:00:00+00',
    '2026-07-16 05:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '2026-07-16 05:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005006',
    'phase-04d-2b-related-content',
    'Garden',
    'Seed',
    'short',
    'Published',
    'Seed',
    'Related and wrong source owner',
    'Related summary',
    'Related body',
    'en',
    array['Coding'],
    null,
    null,
    false,
    null,
    '2026-07-15 00:00:00+00',
    '2026-07-16 06:00:00+00',
    '2026-07-15 06:00:00+00',
    null,
    null,
    '2026-07-16 06:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005007',
    'phase-04d-2b-token-conflict',
    'Forest',
    'Question',
    'short',
    'Archived',
    'Growing',
    'Token and authorization conflicts',
    'Token conflict summary',
    'Token conflict body',
    'en',
    array['Mind & Behavior'],
    null,
    null,
    false,
    null,
    '2026-07-15 00:00:00+00',
    '2026-07-16 07:00:00+00',
    '2026-07-15 07:00:00+00',
    '2026-07-16 07:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '2026-07-16 07:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005008',
    'phase-04d-2b-bypass-guard',
    'Lake',
    'Reflection',
    'short',
    'Archived',
    'Dormant',
    'Archived workflow bypass guard',
    'Bypass guard summary',
    'Bypass guard body',
    'en',
    array['Books & Words'],
    null,
    null,
    false,
    null,
    '2026-07-15 00:00:00+00',
    '2026-07-16 08:00:00+00',
    '2026-07-15 08:00:00+00',
    '2026-07-16 08:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '2026-07-16 08:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005009',
    'phase-04d-2b-forced-failure',
    'Ruins',
    'Trace',
    'short',
    'Archived',
    'Dormant',
    'Forced failure rolls back',
    'Forced failure summary',
    'Forced failure body',
    'en',
    array['Mistakes'],
    null,
    null,
    false,
    null,
    '2026-07-15 00:00:00+00',
    '2026-07-16 09:00:00+00',
    '2026-07-15 09:00:00+00',
    '2026-07-16 09:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '2026-07-16 09:00:00+00',
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004f01'
  );

insert into public.content_versions (
  id,
  content_id,
  snapshot,
  checkpoint_reason,
  checkpoint_note,
  created_at,
  created_by
)
values
  (
    '00000000-0000-4000-8000-000000005101',
    '00000000-0000-4000-8000-000000005001',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005001',
      'phase-04d-2b-published-source',
      'Garden',
      'Seed',
      'full',
      'Sprout',
      'Coding',
      'Historical selected version',
      'contents/00000000-0000-4000-8000-000000005001/historical.webp',
      'Historical selected cover',
      jsonb_build_array(
        jsonb_build_object(
          'id', '00000000-0000-4000-8000-000000005211',
          'normalizedName', 'historical tag',
          'displayName', 'Historical Tag'
        ),
        jsonb_build_object(
          'id', '00000000-0000-4000-8000-000000005212',
          'normalizedName', 'restore test',
          'displayName', 'Restore Test'
        )
      )
    ) || jsonb_build_object(
      'relations', jsonb_build_array(
        jsonb_build_object(
          'id', 'ffffffff-ffff-4fff-8fff-fffffffff101',
          'sourceContentId', '00000000-0000-4000-8000-000000005001',
          'targetContentId', 'ffffffff-ffff-4fff-8fff-fffffffff102',
          'relationType', 'grewInto'
        )
      ),
      'growthNotes', jsonb_build_array(
        jsonb_build_object(
          'id', 'ffffffff-ffff-4fff-8fff-fffffffff103',
          'contentId', '00000000-0000-4000-8000-000000005001',
          'fromStage', 'Seed',
          'toStage', 'Sprout',
          'noteEn', 'Historical snapshot-only Growth Note.'
        )
      )
    ),
    'Published',
    'Selected Published source fixture',
    '2026-07-15 01:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005102',
    '00000000-0000-4000-8000-000000005002',
    (
      pg_temp.phase_04d_restore_snapshot(
        '00000000-0000-4000-8000-000000005002',
        'phase-04d-2b-archived-source',
        'Forest',
        'Question',
        'full',
        'Seed',
        'Stories & Memory',
        'Historical pre-archive version',
        null,
        null,
        jsonb_build_array(
          jsonb_build_object(
            'id', '00000000-0000-4000-8000-000000005213',
            'normalizedName', 'archive source',
            'displayName', 'Archive Source'
          )
        )
      ) - 'publication'
    ) || jsonb_build_object(
      'archive', jsonb_build_object(
        'operationId', 'ffffffff-ffff-4fff-8fff-fffffffff104',
        'archivedAt', '2026-07-16T02:00:00+00:00',
        'archivedBy', '00000000-0000-4000-8000-000000004f01'
      )
    ),
    'Archived',
    'Selected pre-archive source fixture',
    '2026-07-16 02:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005103',
    '00000000-0000-4000-8000-000000005003',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005003',
      'phase-04d-2b-published-conflict',
      'Lake',
      'Reflection',
      'short',
      'Bloom',
      'Internet',
      'Published lifecycle source'
    ),
    'Published',
    null,
    '2026-07-15 03:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005104',
    '00000000-0000-4000-8000-000000005004',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005004',
      'phase-04d-2b-workspace-conflict',
      'Ruins',
      'Trace',
      'short',
      'Dormant',
      'Attempts',
      'Workspace conflict source'
    ),
    'Published',
    null,
    '2026-07-15 04:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005105',
    '00000000-0000-4000-8000-000000005005',
    jsonb_build_object(
      'projection', jsonb_build_object(
        'id', '00000000-0000-4000-8000-000000005005',
        'lifecycle', 'Published'
      ),
      'tags', '[]'::jsonb
    ),
    'Published',
    'Malformed snapshot fixture',
    '2026-07-15 05:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005106',
    '00000000-0000-4000-8000-000000005006',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005006',
      'phase-04d-2b-related-content',
      'Garden',
      'Seed',
      'short',
      'Seed',
      'Coding',
      'Wrong content source owner'
    ),
    'Published',
    null,
    '2026-07-15 06:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005107',
    '00000000-0000-4000-8000-000000005007',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005007',
      'phase-04d-2b-token-conflict',
      'Forest',
      'Question',
      'short',
      'Growing',
      'Mind & Behavior',
      'Token conflict source'
    ),
    'Published',
    null,
    '2026-07-15 07:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005108',
    '00000000-0000-4000-8000-000000005008',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005008',
      'phase-04d-2b-bypass-guard',
      'Lake',
      'Reflection',
      'short',
      'Dormant',
      'Books & Words',
      'Bypass guard source'
    ),
    'Published',
    null,
    '2026-07-15 08:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005109',
    '00000000-0000-4000-8000-000000005009',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005009',
      'phase-04d-2b-forced-failure',
      'Ruins',
      'Trace',
      'short',
      'Dormant',
      'Mistakes',
      'Forced failure source'
    ),
    'Published',
    null,
    '2026-07-15 09:00:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005110',
    '00000000-0000-4000-8000-000000005005',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005005',
      'phase-04d-2b-invalid-source',
      'Garden',
      'Seed',
      'short',
      'Seed',
      'Coding',
      'PreRestore cannot be a source'
    ),
    'PreRestore',
    'Non-restorable reason fixture',
    '2026-07-15 05:10:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005111',
    '00000000-0000-4000-8000-000000005005',
    jsonb_set(
      pg_temp.phase_04d_restore_snapshot(
        '00000000-0000-4000-8000-000000005005',
        'phase-04d-2b-invalid-source',
        'Garden',
        'Seed',
        'short',
        'Seed',
        'Coding',
        'Archived projection cannot be a source'
      ),
      '{projection,lifecycle}',
      '"Archived"'::jsonb
    ),
    'Published',
    'Non-restorable projection lifecycle fixture',
    '2026-07-15 05:11:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005112',
    '00000000-0000-4000-8000-000000005005',
    jsonb_set(
      pg_temp.phase_04d_restore_snapshot(
        '00000000-0000-4000-8000-000000005005',
        'phase-04d-2b-invalid-source',
        'Garden',
        'Seed',
        'short',
        'Seed',
        'Coding',
        'Mismatched snapshot identity'
      ),
      '{projection,id}',
      '"00000000-0000-4000-8000-000000005006"'::jsonb
    ),
    'Published',
    'Mismatched identity fixture',
    '2026-07-15 05:12:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005113',
    '00000000-0000-4000-8000-000000005005',
    jsonb_set(
      pg_temp.phase_04d_restore_snapshot(
        '00000000-0000-4000-8000-000000005005',
        'phase-04d-2b-invalid-source',
        'Garden',
        'Seed',
        'short',
        'Seed',
        'Coding',
        'Invalid source slug'
      ),
      '{projection,slug}',
      '"Invalid Slug"'::jsonb
    ),
    'Published',
    'Invalid source slug fixture',
    '2026-07-15 05:13:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005114',
    '00000000-0000-4000-8000-000000005005',
    jsonb_set(
      pg_temp.phase_04d_restore_snapshot(
        '00000000-0000-4000-8000-000000005005',
        'phase-04d-2b-invalid-source',
        'Garden',
        'Seed',
        'short',
        'Seed',
        'Coding',
        'Mismatched source Region'
      ),
      '{projection,region}',
      '"Forest"'::jsonb
    ),
    'Published',
    'Mismatched source Region fixture',
    '2026-07-15 05:14:00+00',
    '00000000-0000-4000-8000-000000004f01'
  ),
  (
    '00000000-0000-4000-8000-000000005115',
    '00000000-0000-4000-8000-000000005005',
    pg_temp.phase_04d_restore_snapshot(
      '00000000-0000-4000-8000-000000005005',
      'phase-04d-2b-invalid-source',
      'Garden',
      'Seed',
      'short',
      'Seed',
      'Coding',
      'Invalid source cover',
      'outside-the-content-prefix/cover.webp',
      'Invalid source cover'
    ),
    'Published',
    'Invalid source cover fixture',
    '2026-07-15 05:15:00+00',
    '00000000-0000-4000-8000-000000004f01'
  );

insert into public.tags (id, normalized_name, display_name)
values (
  '00000000-0000-4000-8000-000000005201',
  'current binding',
  'Current Binding'
);

insert into public.content_tags (content_id, tag_id)
values (
  '00000000-0000-4000-8000-000000005001',
  '00000000-0000-4000-8000-000000005201'
);

insert into public.content_relations (
  id,
  source_content_id,
  target_content_id,
  relation_type,
  note_en
)
values (
  '00000000-0000-4000-8000-000000005202',
  '00000000-0000-4000-8000-000000005001',
  '00000000-0000-4000-8000-000000005006',
  'relatedTo',
  'Current relation must remain untouched.'
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
  '00000000-0000-4000-8000-000000005203',
  '00000000-0000-4000-8000-000000005001',
  'Bloom',
  'Dormant',
  'Current Growth Note must remain untouched.',
  '2026-07-15 22:00:00+00',
  true
);

insert into storage.objects (id, bucket_id, name, metadata)
values
  (
    '00000000-0000-4000-8000-000000005e01',
    'cover-images',
    'contents/00000000-0000-4000-8000-000000005001/current.webp',
    '{"mimetype":"image/webp","size":1}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000005e02',
    'cover-images',
    'contents/00000000-0000-4000-8000-000000005001/historical.webp',
    '{"mimetype":"image/webp","size":1}'::jsonb
  );

-- Seed one generic Draft workspace as the database owner. The revision audit
-- trigger still receives a real Keeper identity, while the owner bypass is
-- limited to transaction-local fixture construction.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004f01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004f01',
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
  summary_en,
  body_en_markdown,
  content_language,
  primary_categories,
  tags,
  source_version_id,
  base_content_updated_at,
  created_by,
  updated_by
)
values (
  '00000000-0000-4000-8000-000000005204',
  '00000000-0000-4000-8000-000000005004',
  'Draft',
  'phase-04d-2b-workspace-conflict',
  'Ruins',
  'Trace',
  'short',
  'Dormant',
  'Existing generic Draft workspace',
  'Existing generic Draft summary',
  'Existing generic Draft body',
  'en',
  array['Attempts'],
  '{}'::text[],
  '00000000-0000-4000-8000-000000005104',
  '2026-07-16 04:00:00+00',
  '00000000-0000-4000-8000-000000004f01',
  '00000000-0000-4000-8000-000000004f01'
);

-- Force a failure after the RPC has inserted its PreRestore checkpoint but
-- while it is inserting the Draft. A correct single transaction loses both.
create function public.phase_04d_restore_fail_revision_insert()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.content_id = '00000000-0000-4000-8000-000000005009'
     and new.restore_operation_id is not null then
    raise check_violation using message = 'forced_restore_failure';
  end if;

  return new;
end;
$$;

revoke all on function public.phase_04d_restore_fail_revision_insert()
  from public, anon, authenticated;

create trigger phase_04d_restore_force_revision_failure
after insert on public.content_revisions
for each row execute function public.phase_04d_restore_fail_revision_insert();

-- An authenticated user who is not the Garden Keeper cannot invoke restore,
-- even though the RPC itself is granted to the authenticated database role.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004f02","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004f02',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005007',
      '00000000-0000-4000-8000-000000005107',
      '2026-07-16 07:00:00+00',
      '00000000-0000-4000-8000-000000006001'
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if not rejected then
    raise exception 'Phase 04D-2B test failed: non-Keeper restored Archived content';
  end if;
end;
$$;

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004f01","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004f01',
  true
);
set local role authenticated;

do $$
declare
  rejected boolean;
  first_receipt jsonb;
  retry_receipt jsonb;
  archived_source_receipt jsonb;
  receipt_keys text[] := array[
    'contentId',
    'sourceVersionId',
    'revisionId',
    'operationId',
    'preRestoreVersionId',
    'lockVersion',
    'restoredAt',
    'restoredBy'
  ];
begin
  -- The generic clone command must no longer open an Archived workspace.
  rejected := false;
  begin
    perform public.start_content_draft_revision(
      '00000000-0000-4000-8000-000000005008'
    );
  exception
    when invalid_parameter_value then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: generic clone command bypassed Archived restore';
  end if;

  -- Existing direct INSERT permission is needed by SECURITY INVOKER Draft
  -- creation, so the restrictive revision policy must reject Archived rows.
  rejected := false;
  begin
    insert into public.content_revisions (
      content_id,
      lifecycle,
      slug,
      region,
      content_type,
      detail_level,
      growth_stage,
      title_en,
      summary_en,
      body_en_markdown,
      content_language,
      primary_categories,
      tags,
      source_version_id,
      base_content_updated_at,
      restore_operation_id,
      restored_by,
      restored_at,
      created_by,
      updated_by
    ) values (
      '00000000-0000-4000-8000-000000005008',
      'Draft',
      'phase-04d-2b-bypass-guard',
      'Lake',
      'Reflection',
      'short',
      'Dormant',
      'Direct Archived Draft must fail',
      'Direct Archived summary',
      'Direct Archived body',
      'en',
      array['Books & Words'],
      '{}'::text[],
      '00000000-0000-4000-8000-000000005108',
      '2026-07-16 08:00:00+00',
      '00000000-0000-4000-8000-000000006201',
      '00000000-0000-4000-8000-000000004f01',
      now(),
      '00000000-0000-4000-8000-000000004f01',
      '00000000-0000-4000-8000-000000004f01'
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: direct revision INSERT bypassed Archived restore';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005003',
      '00000000-0000-4000-8000-000000005103',
      '2026-07-16 03:00:00+00',
      '00000000-0000-4000-8000-000000006002'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_lifecycle_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: Published content was restored';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005004',
      '00000000-0000-4000-8000-000000005104',
      '2026-07-16 04:00:00+00',
      '00000000-0000-4000-8000-000000006003'
    );
  exception
    when sqlstate '55000' then
      rejected := sqlerrm = 'active_editorial_workspace';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: generic Draft/Review workspace did not block restore';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005106',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006004'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_version_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: cross-content source version was accepted';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005199',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006005'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_version_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: missing source version was accepted';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005110',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006006'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_version_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: PreRestore checkpoint became a restore source';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005111',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006007'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_snapshot_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: non-Published snapshot projection became a restore source';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005105',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006008'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_snapshot_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: malformed source snapshot was trusted';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005112',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006009'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_snapshot_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: mismatched snapshot identity was trusted';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005113',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006010'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_snapshot_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: invalid snapshot slug was trusted';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005114',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006011'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_snapshot_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: mismatched snapshot Region was trusted';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005115',
      '2026-07-16 05:00:00+00',
      '00000000-0000-4000-8000-000000006012'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'restore_snapshot_invalid';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: invalid snapshot cover reference was trusted';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005007',
      '00000000-0000-4000-8000-000000005107',
      '2026-07-16 06:59:59+00',
      '00000000-0000-4000-8000-000000006013'
    );
  exception
    when serialization_failure then
      rejected := sqlerrm = 'restore_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: stale Archived token succeeded';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005007',
      '00000000-0000-4000-8000-000000005107',
      null,
      '00000000-0000-4000-8000-000000006014'
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'invalid_concurrency_token';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: null Archived token succeeded';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005007',
      '00000000-0000-4000-8000-000000005107',
      '2026-07-16 07:00:00+00',
      null
    );
  exception
    when invalid_parameter_value then
      rejected := sqlerrm = 'invalid_operation_id';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: null restore operation ID succeeded';
  end if;

  select public.restore_version_to_draft(
    '00000000-0000-4000-8000-000000005001',
    '00000000-0000-4000-8000-000000005101',
    '2026-07-16 01:00:00+00',
    '00000000-0000-4000-8000-000000006101'
  ) into first_receipt;

  select public.restore_version_to_draft(
    '00000000-0000-4000-8000-000000005001',
    '00000000-0000-4000-8000-000000005101',
    '2026-07-16 01:00:00+00',
    '00000000-0000-4000-8000-000000006101'
  ) into retry_receipt;

  if retry_receipt is distinct from first_receipt then
    raise exception 'Phase 04D-2B test failed: retry did not return the original Draft receipt';
  end if;

  if not (first_receipt ?& receipt_keys)
     or first_receipt - receipt_keys <> '{}'::jsonb
     or first_receipt ->> 'contentId' <> '00000000-0000-4000-8000-000000005001'
     or first_receipt ->> 'sourceVersionId' <> '00000000-0000-4000-8000-000000005101'
     or first_receipt ->> 'operationId' <> '00000000-0000-4000-8000-000000006101'
     or nullif(first_receipt ->> 'revisionId', '') is null
     or nullif(first_receipt ->> 'preRestoreVersionId', '') is null
     or first_receipt ->> 'lockVersion' <> '1'
     or nullif(first_receipt ->> 'restoredAt', '') is null
     or first_receipt ->> 'restoredBy' <> '00000000-0000-4000-8000-000000004f01' then
    raise exception 'Phase 04D-2B test failed: restore receipt shape or values are incorrect';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005001',
      '00000000-0000-4000-8000-000000005106',
      '2026-07-16 01:00:00+00',
      '00000000-0000-4000-8000-000000006101'
    );
  exception
    when serialization_failure then
      rejected := sqlerrm = 'restore_operation_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: operation ID was reused with different source input';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005001',
      '00000000-0000-4000-8000-000000005101',
      '2026-07-16 01:00:00+00',
      '00000000-0000-4000-8000-000000006102'
    );
  exception
    when sqlstate '55000' then
      rejected := sqlerrm = 'active_restore_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: different operation duplicated an active restoration';
  end if;

  select public.restore_version_to_draft(
    '00000000-0000-4000-8000-000000005002',
    '00000000-0000-4000-8000-000000005102',
    '2026-07-16 02:00:00+00',
    '00000000-0000-4000-8000-000000006103'
  ) into archived_source_receipt;

  if archived_source_receipt ->> 'contentId' <> '00000000-0000-4000-8000-000000005002'
     or archived_source_receipt ->> 'sourceVersionId' <> '00000000-0000-4000-8000-000000005102'
     or archived_source_receipt ->> 'operationId' <> '00000000-0000-4000-8000-000000006103'
     or archived_source_receipt ->> 'lockVersion' <> '1' then
    raise exception 'Phase 04D-2B test failed: Archived-reason source version was not restored';
  end if;

  rejected := false;
  begin
    perform public.restore_version_to_draft(
      '00000000-0000-4000-8000-000000005009',
      '00000000-0000-4000-8000-000000005109',
      '2026-07-16 09:00:00+00',
      '00000000-0000-4000-8000-000000006104'
    );
  exception
    when check_violation then
      rejected := sqlerrm = 'forced_restore_failure';
  end;
  if not rejected then
    raise exception 'Phase 04D-2B test failed: forced post-checkpoint Draft failure did not abort restore';
  end if;
end;
$$;

reset role;

do $$
declare
  projection public.contents%rowtype;
  revision public.content_revisions%rowtype;
  checkpoint public.content_versions%rowtype;
  source_version public.content_versions%rowtype;
  second_revision public.content_revisions%rowtype;
  second_checkpoint public.content_versions%rowtype;
begin
  select candidate.*
  into projection
  from public.contents as candidate
  where candidate.id = '00000000-0000-4000-8000-000000005001';

  select candidate.*
  into revision
  from public.content_revisions as candidate
  where candidate.restore_operation_id = '00000000-0000-4000-8000-000000006101';

  select version.*
  into checkpoint
  from public.content_versions as version
  where version.restore_operation_id = '00000000-0000-4000-8000-000000006101';

  select version.*
  into source_version
  from public.content_versions as version
  where version.id = '00000000-0000-4000-8000-000000005101';

  if projection.lifecycle <> 'Archived'
     or projection.updated_at <> '2026-07-16 01:00:00+00'::timestamptz
     or projection.archived_at <> '2026-07-16 01:00:00+00'::timestamptz
     or projection.archived_by <> '00000000-0000-4000-8000-000000004f01'
     or projection.published_at <> '2026-07-15 01:00:00+00'::timestamptz
     or projection.slug <> 'phase-04d-2b-published-source'
     or projection.region <> 'Garden'
     or projection.detail_level <> 'short'
     or projection.growth_stage <> 'Dormant'
     or projection.title_en <> 'Current archived projection'
     or projection.summary_en <> 'Current archived summary'
     or projection.body_en_markdown <> 'Current archived body'
     or projection.primary_categories <> array['AI']
     or projection.cover_image_path <> 'contents/00000000-0000-4000-8000-000000005001/current.webp'
     or projection.cover_image_alt_en <> 'Current archived cover'
     or not projection.featured
     or projection.manual_order <> 4 then
    raise exception 'Phase 04D-2B test failed: restore overwrote the current Archived projection';
  end if;

  if revision.id is null
     or revision.content_id <> projection.id
     or revision.lifecycle <> 'Draft'
     or revision.slug <> projection.slug
     or revision.region <> projection.region
     or revision.content_type <> 'Seed'
     or revision.detail_level <> 'full'
     or revision.growth_stage <> 'Sprout'
     or revision.title_en <> 'Historical selected version'
     or revision.summary_en <> 'Historical selected version summary'
     or revision.body_en_markdown <> 'Historical selected version body'
     or revision.content_language <> 'en'
     or revision.primary_categories <> array['Coding']
     or cardinality(revision.tags) <> 2
     or not revision.tags @> array['Historical Tag', 'Restore Test']
     or revision.cover_image_path <> 'contents/00000000-0000-4000-8000-000000005001/historical.webp'
     or revision.cover_image_alt_en <> 'Historical selected cover'
     or revision.featured
     or revision.manual_order is not null
     or revision.source_version_id <> source_version.id
     or revision.base_content_updated_at <> '2026-07-16 01:00:00+00'::timestamptz
     or revision.restore_operation_id <> '00000000-0000-4000-8000-000000006101'
     or revision.restored_by <> '00000000-0000-4000-8000-000000004f01'
     or revision.restored_at is null
     or revision.created_by <> '00000000-0000-4000-8000-000000004f01'
     or revision.updated_by <> '00000000-0000-4000-8000-000000004f01'
     or revision.lock_version <> 1 then
    raise exception 'Phase 04D-2B test failed: restored Draft fields or provenance are incorrect';
  end if;

  if checkpoint.id is null
     or checkpoint.content_id <> projection.id
     or checkpoint.checkpoint_reason <> 'PreRestore'
     or checkpoint.restore_operation_id <> revision.restore_operation_id
     or checkpoint.restore_source_version_id <> source_version.id
     or checkpoint.restore_revision_id <> revision.id
     or checkpoint.restore_archived_token <> '2026-07-16 01:00:00+00'::timestamptz
     or checkpoint.created_by <> revision.restored_by
     or checkpoint.created_at <> revision.restored_at
     or checkpoint.snapshot #>> '{projection,id}' <> projection.id::text
     or checkpoint.snapshot #>> '{projection,lifecycle}' <> 'Archived'
     or checkpoint.snapshot #>> '{projection,slug}' <> projection.slug
     or checkpoint.snapshot #>> '{projection,region}' <> projection.region::text
     or checkpoint.snapshot #>> '{projection,detailLevel}' <> 'short'
     or checkpoint.snapshot #>> '{projection,growthStage}' <> 'Dormant'
     or checkpoint.snapshot #>> '{projection,titleEn}' <> 'Current archived projection'
     or checkpoint.snapshot #>> '{projection,summaryEn}' <> 'Current archived summary'
     or checkpoint.snapshot #>> '{projection,bodyEnMarkdown}' <> 'Current archived body'
     or checkpoint.snapshot #>> '{projection,primaryCategories,0}' <> 'AI'
     or checkpoint.snapshot #>> '{projection,cover,path}' <> projection.cover_image_path
     or checkpoint.snapshot #>> '{projection,archivedBy}' <> projection.archived_by::text then
    raise exception 'Phase 04D-2B test failed: PreRestore checkpoint or durable receipt is incomplete';
  end if;

  if source_version.checkpoint_reason <> 'Published'
     or source_version.snapshot #>> '{projection,titleEn}' <> 'Historical selected version'
     or source_version.snapshot #>> '{projection,lifecycle}' <> 'Published'
     or source_version.restore_operation_id is not null
     or source_version.restore_source_version_id is not null
     or source_version.restore_revision_id is not null
     or source_version.restore_archived_token is not null then
    raise exception 'Phase 04D-2B test failed: selected immutable source version changed';
  end if;

  if (select count(*) from public.content_versions as version
      where version.content_id = projection.id) <> 2
     or (select count(*) from public.content_versions as version
         where version.restore_operation_id = '00000000-0000-4000-8000-000000006101') <> 1
     or (select count(*) from public.content_revisions as candidate
         where candidate.content_id = projection.id) <> 1 then
    raise exception 'Phase 04D-2B test failed: restore retry created duplicate checkpoint or Draft rows';
  end if;

  select candidate.*
  into second_revision
  from public.content_revisions as candidate
  where candidate.restore_operation_id = '00000000-0000-4000-8000-000000006103';

  select version.*
  into second_checkpoint
  from public.content_versions as version
  where version.restore_operation_id = '00000000-0000-4000-8000-000000006103';

  if second_revision.content_id <> '00000000-0000-4000-8000-000000005002'
     or second_revision.source_version_id <> '00000000-0000-4000-8000-000000005102'
     or second_revision.lifecycle <> 'Draft'
     or second_revision.slug <> 'phase-04d-2b-archived-source'
     or second_revision.region <> 'Forest'
     or second_revision.detail_level <> 'full'
     or second_revision.growth_stage <> 'Seed'
     or second_revision.title_en <> 'Historical pre-archive version'
     or second_revision.primary_categories <> array['Stories & Memory']
     or second_revision.tags <> array['Archive Source']
     or second_revision.featured
     or second_revision.manual_order is not null
     or second_checkpoint.checkpoint_reason <> 'PreRestore'
     or second_checkpoint.restore_source_version_id <> second_revision.source_version_id
     or second_checkpoint.restore_revision_id <> second_revision.id
     or second_checkpoint.restore_archived_token <> '2026-07-16 02:00:00+00'::timestamptz then
    raise exception 'Phase 04D-2B test failed: valid Archived-reason source was not restored correctly';
  end if;

  if not exists (
    select 1
    from public.content_tags as binding
    where binding.content_id = projection.id
      and binding.tag_id = '00000000-0000-4000-8000-000000005201'
  )
  or (select count(*) from public.content_tags as binding
      where binding.content_id = projection.id) <> 1
  or not exists (
    select 1
    from public.content_relations as relation
    where relation.id = '00000000-0000-4000-8000-000000005202'
      and relation.source_content_id = projection.id
      and relation.target_content_id = '00000000-0000-4000-8000-000000005006'
      and relation.note_en = 'Current relation must remain untouched.'
  )
  or (select count(*) from public.content_relations as relation
      where relation.source_content_id = projection.id
         or relation.target_content_id = projection.id) <> 1
  or not exists (
    select 1
    from public.growth_notes as note
    where note.id = '00000000-0000-4000-8000-000000005203'
      and note.content_id = projection.id
      and note.note_en = 'Current Growth Note must remain untouched.'
  )
  or (select count(*) from public.growth_notes as note
      where note.content_id = projection.id) <> 1
  or exists (
    select 1
    from public.home_curation as curated
    where curated.content_id = projection.id
  ) then
    raise exception 'Phase 04D-2B test failed: restore changed or recreated excluded editorial associations';
  end if;

  if (select count(*) from storage.objects as object
      where object.bucket_id = 'cover-images'
        and object.name in (
          'contents/00000000-0000-4000-8000-000000005001/current.webp',
          'contents/00000000-0000-4000-8000-000000005001/historical.webp'
        )) <> 2 then
    raise exception 'Phase 04D-2B test failed: restore changed a preserved Storage reference';
  end if;

  if exists (
    select 1
    from public.content_versions as version
    where version.restore_operation_id in (
      '00000000-0000-4000-8000-000000006001',
      '00000000-0000-4000-8000-000000006002',
      '00000000-0000-4000-8000-000000006003',
      '00000000-0000-4000-8000-000000006004',
      '00000000-0000-4000-8000-000000006005',
      '00000000-0000-4000-8000-000000006006',
      '00000000-0000-4000-8000-000000006007',
      '00000000-0000-4000-8000-000000006008',
      '00000000-0000-4000-8000-000000006009',
      '00000000-0000-4000-8000-000000006010',
      '00000000-0000-4000-8000-000000006011',
      '00000000-0000-4000-8000-000000006012',
      '00000000-0000-4000-8000-000000006013',
      '00000000-0000-4000-8000-000000006014',
      '00000000-0000-4000-8000-000000006102',
      '00000000-0000-4000-8000-000000006104',
      '00000000-0000-4000-8000-000000006201'
    )
  ) then
    raise exception 'Phase 04D-2B test failed: rejected restore left a durable receipt';
  end if;

  if exists (
    select 1
    from public.content_revisions as candidate
    where candidate.content_id in (
      '00000000-0000-4000-8000-000000005003',
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005007',
      '00000000-0000-4000-8000-000000005008',
      '00000000-0000-4000-8000-000000005009'
    )
  ) then
    raise exception 'Phase 04D-2B test failed: rejected restore left a Draft revision';
  end if;

  if not exists (
    select 1
    from public.content_revisions as candidate
    where candidate.id = '00000000-0000-4000-8000-000000005204'
      and candidate.content_id = '00000000-0000-4000-8000-000000005004'
      and candidate.restore_operation_id is null
  ) then
    raise exception 'Phase 04D-2B test failed: workspace conflict changed the existing Draft';
  end if;

  if exists (
    select 1
    from public.content_versions as version
    where version.content_id = '00000000-0000-4000-8000-000000005009'
      and version.restore_operation_id is not null
  )
  or exists (
    select 1
    from public.content_revisions as candidate
    where candidate.content_id = '00000000-0000-4000-8000-000000005009'
  )
  or not exists (
    select 1
    from public.contents as candidate
    where candidate.id = '00000000-0000-4000-8000-000000005009'
      and candidate.lifecycle = 'Archived'
      and candidate.updated_at = '2026-07-16 09:00:00+00'::timestamptz
      and candidate.title_en = 'Forced failure rolls back'
  ) then
    raise exception 'Phase 04D-2B test failed: forced failure did not roll back the full restore transaction';
  end if;

  if exists (
    select 1
    from public.contents as candidate
    where candidate.id in (
      '00000000-0000-4000-8000-000000005002',
      '00000000-0000-4000-8000-000000005004',
      '00000000-0000-4000-8000-000000005005',
      '00000000-0000-4000-8000-000000005007',
      '00000000-0000-4000-8000-000000005008',
      '00000000-0000-4000-8000-000000005009'
    )
      and candidate.lifecycle <> 'Archived'
  )
  or not exists (
    select 1
    from public.contents as candidate
    where candidate.id = '00000000-0000-4000-8000-000000005003'
      and candidate.lifecycle = 'Published'
      and candidate.updated_at = '2026-07-16 03:00:00+00'::timestamptz
  ) then
    raise exception 'Phase 04D-2B test failed: restore changed a stable content lifecycle';
  end if;
end;
$$;

rollback;
