-- Run in the Supabase Preview SQL Editor after applying all migrations.
-- Fixtures are transaction-local and are always rolled back.
begin;

set local statement_timeout = '30s';

do $$
declare
  route_rpc_security_definer boolean;
  route_rpc_volatility "char";
  route_rpc_config text[];
begin
  select procedure.prosecdef, procedure.provolatile, procedure.proconfig
  into route_rpc_security_definer, route_rpc_volatility, route_rpc_config
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'resolve_public_content_route'
    and procedure.pronargs = 2;

  if not found
     or route_rpc_security_definer is distinct from true
     or route_rpc_volatility <> 's'
     or route_rpc_config is null
     or not ('search_path=pg_catalog, public' = any(route_rpc_config)) then
    raise exception 'Phase 04D-2C test failed: route RPC is not a fixed stable SECURITY DEFINER boundary';
  end if;

  if not pg_catalog.has_function_privilege(
       'anon',
       'public.resolve_public_content_route(public.garden_region,text)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'anon',
       'public.filter_unmigrated_public_routes(jsonb)',
       'EXECUTE'
     )
     or pg_catalog.has_table_privilege(
       'anon', 'public.route_redirects', 'SELECT'
     ) then
    raise exception 'Phase 04D-2C test failed: public grants are broader or narrower than intended';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('contents', 'content_relations')
      and relation.relrowsecurity
    group by namespace.nspname
    having count(*) = 2
  ) then
    raise exception 'Phase 04D-2C test failed: content RLS was weakened';
  end if;
end;
$$;

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
  published_at,
  archived_at
)
values
  (
    '00000000-0000-4000-8000-00000000d201',
    'phase-04d-2c-published',
    'phase-04d-2c-published',
    'Garden',
    'Seed',
    'full',
    'Published',
    'Growing',
    'Published route',
    'Published summary',
    'Published body',
    'en',
    array['Coding'],
    now(),
    null
  ),
  (
    '00000000-0000-4000-8000-00000000d202',
    'phase-04d-2c-archived',
    'phase-04d-2c-archived',
    'Garden',
    'Seed',
    'full',
    'Archived',
    'Dormant',
    'Archived route',
    'Private archived summary',
    'Private archived body',
    'en',
    array['Coding'],
    now() - interval '1 day',
    now()
  ),
  (
    '00000000-0000-4000-8000-00000000d203',
    'phase-04d-2c-draft',
    'phase-04d-2c-draft',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Private Draft title',
    'Private Draft summary',
    'Private Draft body',
    'en',
    array['Coding'],
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-00000000d204',
    'phase-04d-2c-review',
    'phase-04d-2c-review',
    'Forest',
    'Question',
    'short',
    'Review',
    'Sprout',
    'Private Review title',
    'Private Review summary',
    'Private Review body',
    'en',
    array['Humans & AI'],
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-00000000d205',
    'phase-04d-2c-published-target',
    'phase-04d-2c-published-target',
    'Forest',
    'Question',
    'short',
    'Published',
    'Sprout',
    'Published relation target',
    'Published target summary',
    'Published target body',
    'en',
    array['Humans & AI'],
    now(),
    null
  ),
  (
    '00000000-0000-4000-8000-00000000d206',
    'phase-04d-2c-archived-target',
    'phase-04d-2c-archived-target',
    'Ruins',
    'Trace',
    'short',
    'Archived',
    'Dormant',
    'Archived relation target',
    'Private target summary',
    'Private target body',
    'en',
    array['Drafts'],
    now() - interval '1 day',
    now()
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
    '00000000-0000-4000-8000-00000000d211',
    '00000000-0000-4000-8000-00000000d202',
    '00000000-0000-4000-8000-00000000d205',
    'grewInto',
    'This relation note must not appear in the resting payload.'
  ),
  (
    '00000000-0000-4000-8000-00000000d212',
    '00000000-0000-4000-8000-00000000d202',
    '00000000-0000-4000-8000-00000000d206',
    'relatedTo',
    null
  ),
  (
    '00000000-0000-4000-8000-00000000d213',
    '00000000-0000-4000-8000-00000000d201',
    '00000000-0000-4000-8000-00000000d205',
    'relatedTo',
    null
  ),
  (
    '00000000-0000-4000-8000-00000000d214',
    '00000000-0000-4000-8000-00000000d201',
    '00000000-0000-4000-8000-00000000d206',
    'relatedTo',
    null
  );

insert into public.route_redirects (
  id,
  old_path,
  new_path,
  status_code
)
values (
  '00000000-0000-4000-8000-00000000d221',
  '/lake/phase-04d-2c-tombstone',
  null,
  410
);

set local role anon;

do $$
declare
  result jsonb;
  routes jsonb;
begin
  result := public.resolve_public_content_route(
    'Garden',
    'phase-04d-2c-published'
  );
  if result <> '{"disposition":"published"}'::jsonb then
    raise exception 'Phase 04D-2C test failed: Published route disposition is incorrect';
  end if;

  result := public.resolve_public_content_route(
    'Garden',
    'phase-04d-2c-archived'
  );
  if result ->> 'disposition' <> 'archived'
     or result #>> '{content,title}' <> 'Archived route'
     or result #>> '{content,region}' <> 'Garden'
     or result #>> '{content,growthStage}' <> 'Dormant'
     or result #>> '{content,lifecycle}' <> 'Archived'
     or result #>> '{content,restingState}' <> 'archived'
     or jsonb_array_length(result #> '{content,relations}') <> 1
     or result #>> '{content,relations,0,target,slug}' <> 'phase-04d-2c-published-target'
     or (result -> 'content') ?| array[
       'body',
       'bodyMarkdown',
       'summary',
       'growthTimeline',
       'archiveReason',
       'archivedBy',
       'cover'
     ]
     or (result #> '{content,relations,0}') ?| array['noteZh', 'noteEn'] then
    raise exception 'Phase 04D-2C test failed: Archived resting payload is unsafe or incomplete';
  end if;

  result := public.resolve_public_content_route(
    'Garden',
    'phase-04d-2c-draft'
  );
  if result <> '{"disposition":"not_found","legacyFallback":"forbidden"}'::jsonb then
    raise exception 'Phase 04D-2C test failed: Draft route was exposed or allowed to fall back';
  end if;

  result := public.resolve_public_content_route(
    'Forest',
    'phase-04d-2c-review'
  );
  if result <> '{"disposition":"not_found","legacyFallback":"forbidden"}'::jsonb then
    raise exception 'Phase 04D-2C test failed: Review route was exposed or allowed to fall back';
  end if;

  result := public.resolve_public_content_route(
    'Lake',
    'phase-04d-2c-unknown'
  );
  if result <> '{"disposition":"not_found","legacyFallback":"allowed"}'::jsonb then
    raise exception 'Phase 04D-2C test failed: genuinely unmigrated route cannot fall back';
  end if;

  result := public.resolve_public_content_route(
    'Lake',
    'phase-04d-2c-tombstone'
  );
  if result <> '{"disposition":"not_found","legacyFallback":"forbidden"}'::jsonb then
    raise exception 'Phase 04D-2C test failed: tombstoned identity can fall back';
  end if;

  routes := public.filter_unmigrated_public_routes(
    '[
      {"region":"Garden","slug":"phase-04d-2c-archived"},
      {"region":"Garden","slug":"phase-04d-2c-draft"},
      {"region":"Forest","slug":"phase-04d-2c-review"},
      {"region":"Lake","slug":"phase-04d-2c-tombstone"},
      {"region":"Lake","slug":"phase-04d-2c-unknown"}
    ]'::jsonb
  );
  if routes <> '["Lake/phase-04d-2c-unknown"]'::jsonb then
    raise exception 'Phase 04D-2C test failed: dual-read fallback filter is incorrect';
  end if;

  if (
    select count(*)
    from public.contents
    where id in (
      '00000000-0000-4000-8000-00000000d201',
      '00000000-0000-4000-8000-00000000d202',
      '00000000-0000-4000-8000-00000000d203',
      '00000000-0000-4000-8000-00000000d204',
      '00000000-0000-4000-8000-00000000d205',
      '00000000-0000-4000-8000-00000000d206'
    )
  ) <> 2 then
    raise exception 'Phase 04D-2C test failed: normal public content query includes non-Published rows';
  end if;

  if (
    select count(*)
    from public.content_relations
    where id in (
      '00000000-0000-4000-8000-00000000d211',
      '00000000-0000-4000-8000-00000000d212',
      '00000000-0000-4000-8000-00000000d213',
      '00000000-0000-4000-8000-00000000d214'
    )
  ) <> 1 then
    raise exception 'Phase 04D-2C test failed: public relations include an Archived source or target';
  end if;
end;
$$;

reset role;

rollback;
