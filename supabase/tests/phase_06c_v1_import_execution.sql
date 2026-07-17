-- Run in the Supabase Preview SQL Editor after applying all migrations.
-- The forced-failure fixtures and any incidental writes are always rolled back.
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
    and procedure.proname = 'execute_v1_import'
    and procedure.pronargs = 1;

  if not found
     or rpc_security_definer is distinct from true
     or rpc_volatility <> 'v'
     or rpc_result <> 'jsonb'
     or rpc_config is null
     or not ('search_path=pg_catalog' = any(rpc_config)) then
    raise exception 'Phase 06C test failed: import RPC is not a fixed SECURITY DEFINER jsonb command';
  end if;

  if pg_catalog.has_function_privilege(
       'anon', 'public.execute_v1_import(jsonb)', 'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated', 'public.execute_v1_import(jsonb)', 'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role', 'public.execute_v1_import(jsonb)', 'EXECUTE'
     )
     or pg_catalog.has_table_privilege(
       'anon', 'public.v1_migration_imports', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.v1_migration_imports', 'SELECT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.v1_migration_imports', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.v1_migration_imports', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'service_role', 'public.v1_migration_imports', 'DELETE'
     ) then
    raise exception 'Phase 06C test failed: import execution or receipts are exposed beyond service_role';
  end if;
end;
$$;

create function pg_temp.phase_06c_reject_version_insert()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.checkpoint_reason = 'V1 import' then
    raise exception using message = 'phase_06c_forced_version_failure';
  end if;
  return new;
end;
$$;

create trigger phase_06c_reject_version_insert
before insert on public.content_versions
for each row execute function pg_temp.phase_06c_reject_version_insert();

do $$
declare
  current_destination jsonb;
  fixture_contents jsonb;
  payload jsonb;
  rejected boolean := false;
  failure_message text;
  fixture_count integer;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', destination.id,
        'legacy_id', destination.legacy_id,
        'slug', destination.slug,
        'region', destination.region,
        'content_type', destination.content_type,
        'detail_level', destination.detail_level,
        'lifecycle', destination.lifecycle,
        'growth_stage', destination.growth_stage,
        'title_zh', destination.title_zh,
        'title_en', destination.title_en,
        'summary_zh', destination.summary_zh,
        'summary_en', destination.summary_en,
        'body_zh_markdown', destination.body_zh_markdown,
        'body_en_markdown', destination.body_en_markdown,
        'content_language', destination.content_language,
        'primary_categories', to_jsonb(destination.primary_categories),
        'cover_image_path', destination.cover_image_path,
        'cover_image_alt_zh', destination.cover_image_alt_zh,
        'cover_image_alt_en', destination.cover_image_alt_en,
        'featured', destination.featured,
        'manual_order', destination.manual_order,
        'published_at', destination.published_at,
        'archived_at', destination.archived_at,
        'last_tended_at', destination.last_tended_at
      ) order by destination.id
    ),
    '[]'::jsonb
  )
  into current_destination
  from public.contents as destination;

  select jsonb_agg(
    jsonb_build_object(
      'legacyId', 'phase-06c-rollback-' || fixture.number,
      'slug', 'phase-06c-rollback-' || fixture.number,
      'region', 'Garden',
      'contentType', 'Seed',
      'detailLevel', 'short',
      'lifecycle', 'Published',
      'growthStage', 'Seed',
      'growthStageResolution', null,
      'titleZh', null,
      'titleEn', 'Rollback fixture ' || fixture.number,
      'summaryZh', null,
      'summaryEn', 'Must roll back.',
      'bodyZhMarkdown', null,
      'bodyEnMarkdown', 'Must roll back.',
      'contentLanguage', 'en',
      'primaryCategories', jsonb_build_array('Rollback'),
      'tags', '[]'::jsonb,
      'cover', null,
      'featured', false,
      'manualOrder', null,
      'publishedAt', null,
      'archivedAt', null,
      'lastTendedAt', null
    ) order by fixture.number
  )
  into fixture_contents
  from generate_series(1, 19) as fixture(number);

  payload := jsonb_build_object(
    'schemaVersion', 1,
    'kind', 'v1-import-execution',
    'importDigest', 'sha256:' || repeat('6', 64),
    'sourceDigest', 'sha256:' || repeat('7', 64),
    'destinationStateDigest', 'sha256:' || repeat('8', 64),
    'sourceVersion', jsonb_build_object(
      'source', 'v1-static-typescript',
      'schemaVersion', 1
    ),
    'expectedDestinationContents', current_destination,
    'contents', fixture_contents,
    'relations', '[]'::jsonb,
    'tags', '[]'::jsonb,
    'contentTags', '[]'::jsonb,
    'growthNotes', '[]'::jsonb,
    'warnings', '[]'::jsonb
  );

  begin
    perform public.execute_v1_import(payload);
  exception
    when others then
      rejected := sqlstate = 'P0001';
      failure_message := sqlerrm;
  end;

  if not rejected or failure_message <> 'phase_06c_forced_version_failure' then
    raise exception 'Phase 06C test failed: forced version failure was not observed';
  end if;

  select count(*)
  into fixture_count
  from public.contents
  where legacy_id like 'phase-06c-rollback-%';
  if fixture_count <> 0 then
    raise exception 'Phase 06C test failed: forced failure left partial contents';
  end if;

  if exists (
    select 1
    from public.v1_migration_imports
    where import_digest = 'sha256:' || repeat('6', 64)
  ) then
    raise exception 'Phase 06C test failed: forced failure left an import receipt';
  end if;
end;
$$;

rollback;
