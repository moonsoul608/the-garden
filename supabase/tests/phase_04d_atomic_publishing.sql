-- Run this file in the Supabase Preview SQL Editor after applying all
-- migrations. Auth, content, association, and receipt fixtures are rolled back.
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
    and procedure.proname = 'publish_review_revision'
    and procedure.pronargs = 3;

  if not found
     or rpc_security_definer is distinct from true
     or rpc_volatility <> 'v'
     or rpc_result <> 'jsonb'
     or rpc_config is null
     or not ('search_path=pg_catalog' = any(rpc_config)) then
    raise exception 'Phase 04D test failed: publish RPC is not a fixed SECURITY DEFINER jsonb command';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'public.publish_review_revision(uuid,uuid,bigint)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'authenticated',
       'public.publish_review_revision(uuid,uuid,bigint)',
       'EXECUTE'
     ) then
    raise exception 'Phase 04D test failed: publish RPC grants are broader or narrower than intended';
  end if;

  if pg_catalog.has_table_privilege(
       'authenticated', 'public.contents', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.contents', 'DELETE'
     )
     or not pg_catalog.has_table_privilege(
       'authenticated', 'public.contents', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_versions', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_revisions', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.tags', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.tags', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.tags', 'DELETE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_tags', 'INSERT'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_tags', 'UPDATE'
     )
     or pg_catalog.has_table_privilege(
       'authenticated', 'public.content_tags', 'DELETE'
     ) then
    raise exception 'Phase 04D test failed: direct projection, version, Review-consumption, or tag writes remain exposed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'content_versions'
      and indexname = 'content_versions_publication_receipt_idx'
      and indexdef ilike 'create unique index%'
  ) then
    raise exception 'Phase 04D test failed: durable publication receipt index is missing';
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
    '00000000-0000-4000-8000-000000004d01',
    'authenticated',
    'authenticated',
    'keeper-04d@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-keeper"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004d02',
    'authenticated',
    'authenticated',
    'non-keeper-04d@example.invalid',
    '',
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"user_name":"phase-04d-non-keeper"}'::jsonb,
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
    '00000000-0000-4000-8000-000000004d11',
    'github-phase-04d-keeper',
    '00000000-0000-4000-8000-000000004d01',
    '{"sub":"github-phase-04d-keeper","user_name":"phase-04d-keeper"}'::jsonb,
    'github',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000004d12',
    'github-phase-04d-non-keeper',
    '00000000-0000-4000-8000-000000004d02',
    '{"sub":"github-phase-04d-non-keeper","user_name":"phase-04d-non-keeper"}'::jsonb,
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
  'github-phase-04d-keeper',
  'phase-04d-keeper'
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
  created_at,
  updated_at,
  published_at
)
values
  (
    '00000000-0000-4000-8000-000000004e01',
    'phase-04d-stable-legacy-id',
    'phase-04d-initial-draft',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Initial private projection',
    null,
    null,
    'en',
    '{}'::text[],
    '2026-07-15 00:00:00+00',
    '2026-07-15 00:00:00+00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000004e02',
    null,
    'phase-04d-relation-target',
    'Forest',
    'Question',
    'short',
    'Published',
    'Seed',
    'Published relation target',
    null,
    null,
    'en',
    '{}'::text[],
    '2026-07-15 00:00:00+00',
    '2026-07-15 00:00:00+00',
    '2026-07-15 00:00:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000004e03',
    null,
    'phase-04d-draft-rejected',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Draft must not publish',
    null,
    null,
    'en',
    '{}'::text[],
    '2026-07-15 00:00:00+00',
    '2026-07-15 00:00:00+00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000004e04',
    null,
    'phase-04d-cover-failure',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Cover failure projection',
    null,
    null,
    'en',
    '{}'::text[],
    '2026-07-15 00:00:00+00',
    '2026-07-15 00:00:00+00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000004e05',
    null,
    'phase-04d-stale-projection',
    'Garden',
    'Seed',
    'short',
    'Published',
    'Seed',
    'Projection changed since Draft began',
    null,
    null,
    'en',
    array['Psychology'],
    '2026-07-15 00:00:00+00',
    '2026-07-15 02:00:00+00',
    '2026-07-15 00:30:00+00'
  ),
  (
    '00000000-0000-4000-8000-000000004e06',
    null,
    'phase-04d-preserve-null-published-at',
    'Garden',
    'Seed',
    'short',
    'Published',
    'Seed',
    'Existing Published projection',
    'Existing Published summary',
    'Existing Published body',
    'en',
    array['Psychology'],
    '2026-07-15 00:00:00+00',
    '2026-07-15 03:00:00+00',
    null
  ),
  (
    '00000000-0000-4000-8000-000000004e07',
    null,
    'phase-04d-forced-rollback',
    'Garden',
    'Seed',
    'short',
    'Draft',
    'Seed',
    'Rollback original projection',
    null,
    null,
    'en',
    '{}'::text[],
    '2026-07-15 00:00:00+00',
    '2026-07-15 00:00:00+00',
    null
  );

-- Revision audit triggers derive actors, workflow timestamps, and lock tokens
-- from this request identity even while fixtures are inserted as the owner.
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004d01","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004d01',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

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
  cover_image_path,
  cover_image_alt_en,
  base_content_updated_at,
  created_by,
  updated_by
)
values
  (
    '00000000-0000-4000-8000-000000004f01',
    '00000000-0000-4000-8000-000000004e01',
    'Draft',
    'phase-04d-atomic-publish',
    'Garden',
    'Seed',
    'full',
    'Seed',
    'Atomic publication title',
    'Atomic publication summary',
    'Atomic publication body',
    'en',
    array['Psychology'],
    array['Atomic Publishing', 'shared tag'],
    null,
    null,
    null,
    '00000000-0000-4000-8000-000000004d01',
    '00000000-0000-4000-8000-000000004d01'
  ),
  (
    '00000000-0000-4000-8000-000000004f03',
    '00000000-0000-4000-8000-000000004e03',
    'Draft',
    'phase-04d-draft-rejected',
    'Garden',
    'Seed',
    'short',
    'Seed',
    'Draft rejection title',
    'Draft rejection summary',
    'Draft rejection body',
    'en',
    array['Psychology'],
    '{}'::text[],
    null,
    null,
    null,
    '00000000-0000-4000-8000-000000004d01',
    '00000000-0000-4000-8000-000000004d01'
  ),
  (
    '00000000-0000-4000-8000-000000004f04',
    '00000000-0000-4000-8000-000000004e04',
    'Draft',
    'phase-04d-cover-failure',
    'Garden',
    'Seed',
    'short',
    'Seed',
    'Cover failure title',
    'Cover failure summary',
    'Cover failure body',
    'en',
    array['Psychology'],
    '{}'::text[],
    'contents/00000000-0000-4000-8000-000000004e04/missing.webp',
    'Missing object must fail publication',
    null,
    '00000000-0000-4000-8000-000000004d01',
    '00000000-0000-4000-8000-000000004d01'
  ),
  (
    '00000000-0000-4000-8000-000000004f05',
    '00000000-0000-4000-8000-000000004e05',
    'Draft',
    'phase-04d-stale-projection',
    'Garden',
    'Seed',
    'short',
    'Seed',
    'Stale projection title',
    'Stale projection summary',
    'Stale projection body',
    'en',
    array['Psychology'],
    '{}'::text[],
    null,
    null,
    '2026-07-15 01:00:00+00',
    '00000000-0000-4000-8000-000000004d01',
    '00000000-0000-4000-8000-000000004d01'
  ),
  (
    '00000000-0000-4000-8000-000000004f06',
    '00000000-0000-4000-8000-000000004e06',
    'Draft',
    'phase-04d-preserve-null-published-at',
    'Garden',
    'Seed',
    'full',
    'Seed',
    'Republished title with original timestamp',
    'Republished summary',
    'Republished body',
    'en',
    array['Psychology'],
    '{}'::text[],
    null,
    null,
    '2026-07-15 03:00:00+00',
    '00000000-0000-4000-8000-000000004d01',
    '00000000-0000-4000-8000-000000004d01'
  ),
  (
    '00000000-0000-4000-8000-000000004f07',
    '00000000-0000-4000-8000-000000004e07',
    'Draft',
    'phase-04d-forced-rollback',
    'Garden',
    'Seed',
    'full',
    'Seed',
    'Rollback candidate must not survive',
    'Rollback candidate summary',
    'Rollback candidate body',
    'en',
    array['Psychology'],
    array['Rollback Only Tag'],
    null,
    null,
    null,
    '00000000-0000-4000-8000-000000004d01',
    '00000000-0000-4000-8000-000000004d01'
  );

update public.content_revisions
set lifecycle = 'Review'
where id in (
  '00000000-0000-4000-8000-000000004f01',
  '00000000-0000-4000-8000-000000004f04',
  '00000000-0000-4000-8000-000000004f05',
  '00000000-0000-4000-8000-000000004f06',
  '00000000-0000-4000-8000-000000004f07'
);

insert into public.tags (id, normalized_name, display_name)
values
  (
    '00000000-0000-4000-8000-000000004101',
    'old-binding',
    'Old Binding'
  ),
  (
    '00000000-0000-4000-8000-000000004102',
    'shared tag',
    'Shared Tag'
  );

insert into public.content_tags (content_id, tag_id)
values
  (
    '00000000-0000-4000-8000-000000004e01',
    '00000000-0000-4000-8000-000000004101'
  ),
  (
    '00000000-0000-4000-8000-000000004e07',
    '00000000-0000-4000-8000-000000004101'
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
  '00000000-0000-4000-8000-000000004201',
  '00000000-0000-4000-8000-000000004e01',
  null,
  'Seed',
  'Initial publication Growth Note snapshot',
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
  '00000000-0000-4000-8000-000000004301',
  '00000000-0000-4000-8000-000000004e01',
  '00000000-0000-4000-8000-000000004e02',
  'relatedTo',
  'Atomic relation snapshot'
);

-- This transaction-local trigger forces a failure after the RPC has updated
-- the projection and synchronized tags, proving the entire function statement
-- rolls those writes back when the immutable checkpoint insert fails.
create function pg_temp.phase_04d_reject_version_insert()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.content_id = '00000000-0000-4000-8000-000000004e07'::uuid then
    raise exception using message = 'phase_04d_forced_version_failure';
  end if;
  return new;
end;
$$;

create trigger phase_04d_reject_version_insert
before insert on public.content_versions
for each row execute function pg_temp.phase_04d_reject_version_insert();

-- An authenticated user absent from the immutable Keeper allow-list cannot use
-- the SECURITY DEFINER command.
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004d02","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004d02',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  denied boolean := false;
  failure_message text;
begin
  begin
    perform public.publish_review_revision(
      '00000000-0000-4000-8000-000000004e01',
      '00000000-0000-4000-8000-000000004f01',
      2
    );
  exception
    when insufficient_privilege then
      denied := true;
      failure_message := sqlerrm;
  end;

  if not denied or failure_message <> 'garden_keeper_required' then
    raise exception 'Phase 04D test failed: non-Keeper publish was not denied safely';
  end if;
end;
$$;

reset role;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000004d01","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000004d01',
  true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

do $$
declare
  first_receipt jsonb;
  retry_receipt jsonb;
  republish_receipt jsonb;
  version_snapshot jsonb;
  failure_message text;
  rejected boolean;
  row_count_value integer;
  lifecycle_value public.content_lifecycle;
  lock_value bigint;
  published_at_value timestamptz;
  title_value text;
begin
  -- An exact Draft row cannot be promoted without the Review transition.
  rejected := false;
  begin
    perform public.publish_review_revision(
      '00000000-0000-4000-8000-000000004e03',
      '00000000-0000-4000-8000-000000004f03',
      1
    );
  exception
    when invalid_parameter_value then
      rejected := true;
      failure_message := sqlerrm;
  end;
  if not rejected or failure_message <> 'invalid_revision_state' then
    raise exception 'Phase 04D test failed: Draft publication was not rejected safely';
  end if;

  -- A Review based on an older Published projection is a serialization
  -- conflict; the Review remains available for an explicit return/rebase.
  rejected := false;
  failure_message := null;
  begin
    perform public.publish_review_revision(
      '00000000-0000-4000-8000-000000004e05',
      '00000000-0000-4000-8000-000000004f05',
      2
    );
  exception
    when serialization_failure then
      rejected := true;
      failure_message := sqlerrm;
  end;
  if not rejected or failure_message <> 'revision_conflict' then
    raise exception 'Phase 04D test failed: stale projection was not rejected as a conflict';
  end if;

  select candidate.lifecycle, candidate.lock_version
  into lifecycle_value, lock_value
  from public.content_revisions as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004f05';
  if lifecycle_value <> 'Review' or lock_value <> 2 then
    raise exception 'Phase 04D test failed: stale Review changed after rollback';
  end if;

  -- A correctly scoped cover reference still fails when the immutable object
  -- does not exist. No projection/version/Review partial state may survive.
  rejected := false;
  failure_message := null;
  begin
    perform public.publish_review_revision(
      '00000000-0000-4000-8000-000000004e04',
      '00000000-0000-4000-8000-000000004f04',
      2
    );
  exception
    when invalid_parameter_value then
      rejected := true;
      failure_message := sqlerrm;
  end;
  if not rejected or failure_message <> 'publication_validation_failed' then
    raise exception 'Phase 04D test failed: missing cover object did not fail safely';
  end if;

  select candidate.lifecycle, candidate.lock_version
  into lifecycle_value, lock_value
  from public.content_revisions as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004f04';
  if lifecycle_value <> 'Review' or lock_value <> 2 then
    raise exception 'Phase 04D test failed: failed publication consumed or changed its Review';
  end if;

  select count(*)
  into row_count_value
  from public.content_versions as checkpoint
  where checkpoint.content_id = '00000000-0000-4000-8000-000000004e04';
  if row_count_value <> 0 then
    raise exception 'Phase 04D test failed: failed publication created a version';
  end if;

  select candidate.lifecycle
  into lifecycle_value
  from public.contents as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004e04';
  if lifecycle_value <> 'Draft' then
    raise exception 'Phase 04D test failed: failed publication changed the projection';
  end if;

  -- Force the version insert to fail after projection and tag writes. The
  -- caught statement must leave the Review, projection, old binding, and tag
  -- catalog exactly as they were before the RPC call.
  rejected := false;
  failure_message := null;
  begin
    perform public.publish_review_revision(
      '00000000-0000-4000-8000-000000004e07',
      '00000000-0000-4000-8000-000000004f07',
      2
    );
  exception
    when others then
      rejected := sqlstate = 'P0001';
      failure_message := sqlerrm;
  end;
  if not rejected or failure_message <> 'phase_04d_forced_version_failure' then
    raise exception 'Phase 04D test failed: forced version failure was not observed';
  end if;

  select candidate.lifecycle, candidate.title_en
  into lifecycle_value, title_value
  from public.contents as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004e07';
  if lifecycle_value <> 'Draft'
     or title_value <> 'Rollback original projection' then
    raise exception 'Phase 04D test failed: version failure left a partial projection update';
  end if;

  select candidate.lifecycle, candidate.lock_version
  into lifecycle_value, lock_value
  from public.content_revisions as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004f07';
  if lifecycle_value <> 'Review' or lock_value <> 2 then
    raise exception 'Phase 04D test failed: version failure consumed or changed Review';
  end if;

  select count(*)
  into row_count_value
  from public.content_tags as binding
  join public.tags as tag on tag.id = binding.tag_id
  where binding.content_id = '00000000-0000-4000-8000-000000004e07'
    and tag.normalized_name = 'old-binding';
  if row_count_value <> 1
     or exists (
       select 1
       from public.tags as tag
       where tag.normalized_name = 'rollback only tag'
     ) then
    raise exception 'Phase 04D test failed: version failure left partial tag synchronization';
  end if;

  select count(*)
  into row_count_value
  from public.content_versions as checkpoint
  where checkpoint.content_id = '00000000-0000-4000-8000-000000004e07';
  if row_count_value <> 0 then
    raise exception 'Phase 04D test failed: rejected version insert left a checkpoint';
  end if;

  first_receipt := public.publish_review_revision(
    '00000000-0000-4000-8000-000000004e01',
    '00000000-0000-4000-8000-000000004f01',
    2
  );
  retry_receipt := public.publish_review_revision(
    '00000000-0000-4000-8000-000000004e01',
    '00000000-0000-4000-8000-000000004f01',
    2
  );

  if first_receipt is distinct from retry_receipt
     or first_receipt ->> 'contentId' <> '00000000-0000-4000-8000-000000004e01'
     or first_receipt ->> 'revisionId' <> '00000000-0000-4000-8000-000000004f01'
     or (first_receipt ->> 'sourceLockVersion')::bigint <> 2
     or first_receipt ->> 'publishedBy' <> '00000000-0000-4000-8000-000000004d01'
     or nullif(first_receipt ->> 'versionId', '') is null
     or nullif(first_receipt ->> 'publishedAt', '') is null then
    raise exception 'Phase 04D test failed: first publish and exact retry receipts differ';
  end if;

  select count(*)
  into row_count_value
  from public.content_versions as checkpoint
  where checkpoint.content_id = '00000000-0000-4000-8000-000000004e01';
  if row_count_value <> 1 then
    raise exception 'Phase 04D test failed: idempotent retry created % versions', row_count_value;
  end if;

  select checkpoint.snapshot
  into version_snapshot
  from public.content_versions as checkpoint
  where checkpoint.content_id = '00000000-0000-4000-8000-000000004e01';

  if version_snapshot #>> '{projection,titleEn}' <> 'Atomic publication title'
     or version_snapshot #>> '{projection,lifecycle}' <> 'Published'
     or version_snapshot #>> '{publication,sourceRevisionId}' <> '00000000-0000-4000-8000-000000004f01'
     or (version_snapshot #>> '{publication,sourceLockVersion}')::bigint <> 2
     or pg_catalog.jsonb_array_length(version_snapshot -> 'tags') <> 2
     or not (version_snapshot -> 'tags' @> '[{"normalizedName":"atomic publishing"}]'::jsonb)
     or not (version_snapshot -> 'tags' @> '[{"normalizedName":"shared tag","displayName":"Shared Tag"}]'::jsonb)
     or pg_catalog.jsonb_array_length(version_snapshot -> 'relations') <> 1
     or pg_catalog.jsonb_array_length(version_snapshot -> 'growthNotes') <> 1
     or version_snapshot -> 'cover' <> 'null'::jsonb then
    raise exception 'Phase 04D test failed: immutable publication snapshot is incomplete';
  end if;

  select count(*)
  into row_count_value
  from public.content_revisions as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004f01';
  if row_count_value <> 0 then
    raise exception 'Phase 04D test failed: successful publication did not consume Review';
  end if;

  -- Re-publication preserves the original projection timestamp exactly. The
  -- legacy-compatible null value must not be replaced by the checkpoint time.
  republish_receipt := public.publish_review_revision(
    '00000000-0000-4000-8000-000000004e06',
    '00000000-0000-4000-8000-000000004f06',
    2
  );
  if republish_receipt ->> 'revisionId' <> '00000000-0000-4000-8000-000000004f06' then
    raise exception 'Phase 04D test failed: valid Published re-publication returned the wrong receipt';
  end if;

  select candidate.published_at
  into published_at_value
  from public.contents as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004e06';
  if published_at_value is not null then
    raise exception 'Phase 04D test failed: re-publication replaced the original null published_at';
  end if;

  select checkpoint.snapshot
  into version_snapshot
  from public.content_versions as checkpoint
  where checkpoint.source_revision_id = '00000000-0000-4000-8000-000000004f06';
  if version_snapshot #> '{projection,publishedAt}' <> 'null'::jsonb
     or version_snapshot #>> '{projection,titleEn}' <> 'Republished title with original timestamp' then
    raise exception 'Phase 04D test failed: re-publication snapshot did not preserve published_at';
  end if;

  -- The same source revision with a different token, or another content's
  -- revision ID, must conflict rather than replay or report success.
  rejected := false;
  begin
    perform public.publish_review_revision(
      '00000000-0000-4000-8000-000000004e01',
      '00000000-0000-4000-8000-000000004f01',
      1
    );
  exception
    when serialization_failure then
      rejected := sqlerrm = 'revision_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D test failed: stale retry token was not a conflict';
  end if;

  rejected := false;
  begin
    perform public.publish_review_revision(
      '00000000-0000-4000-8000-000000004e01',
      '00000000-0000-4000-8000-000000004f03',
      1
    );
  exception
    when serialization_failure then
      rejected := sqlerrm = 'revision_conflict';
  end;
  if not rejected then
    raise exception 'Phase 04D test failed: wrong content revision was not a conflict';
  end if;

  -- Keeper table grants cannot bypass the narrow command for projection,
  -- Review consumption, or normalized Published tag mutations.
  rejected := false;
  begin
    update public.contents
    set title_en = 'Direct mutation must fail'
    where id = '00000000-0000-4000-8000-000000004e01';
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D test failed: Keeper directly updated Published content';
  end if;

  rejected := false;
  begin
    delete from public.contents
    where id = '00000000-0000-4000-8000-000000004e01';
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D test failed: Keeper directly deleted Published content';
  end if;

  rejected := false;
  begin
    insert into public.contents (
      id,
      slug,
      region,
      content_type,
      detail_level,
      lifecycle,
      growth_stage,
      title_en,
      content_language
    ) values (
      '00000000-0000-4000-8000-000000004e99',
      'phase-04d-direct-published-insert',
      'Garden',
      'Seed',
      'short',
      'Published',
      'Seed',
      'Direct Published insert must fail',
      'en'
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D test failed: Keeper directly inserted Published content';
  end if;

  rejected := false;
  begin
    delete from public.content_tags
    where content_id = '00000000-0000-4000-8000-000000004e01';
  exception
    when insufficient_privilege then
      rejected := true;
  end;
  if not rejected then
    raise exception 'Phase 04D test failed: Keeper directly changed Published tag bindings';
  end if;
end;
$$;

reset role;

-- Owner-level assertions can inspect actor and stable-identity columns that are
-- deliberately absent from the public contents column grant.
do $$
declare
  projection public.contents%rowtype;
  checkpoint public.content_versions%rowtype;
  binding_count integer;
begin
  select candidate.*
  into projection
  from public.contents as candidate
  where candidate.id = '00000000-0000-4000-8000-000000004e01';

  if projection.lifecycle <> 'Published'
     or projection.slug <> 'phase-04d-atomic-publish'
     or projection.title_en <> 'Atomic publication title'
     or projection.summary_en <> 'Atomic publication summary'
     or projection.body_en_markdown <> 'Atomic publication body'
     or projection.detail_level <> 'full'
     or projection.primary_categories <> array['Psychology']
     or projection.legacy_id <> 'phase-04d-stable-legacy-id'
     or projection.created_at <> '2026-07-15 00:00:00+00'::timestamptz
     or projection.published_at is null
     or projection.updated_by <> '00000000-0000-4000-8000-000000004d01' then
    raise exception 'Phase 04D test failed: Published projection was not copied atomically or stable fields changed';
  end if;

  select version.*
  into checkpoint
  from public.content_versions as version
  where version.source_revision_id = '00000000-0000-4000-8000-000000004f01';

  if checkpoint.content_id <> projection.id
     or checkpoint.source_lock_version <> 2
     or checkpoint.created_by <> '00000000-0000-4000-8000-000000004d01'
     or checkpoint.created_at <> projection.published_at then
    raise exception 'Phase 04D test failed: version receipt does not match the atomic projection';
  end if;

  select count(*)
  into binding_count
  from public.content_tags as binding
  join public.tags as tag on tag.id = binding.tag_id
  where binding.content_id = projection.id
    and tag.normalized_name in ('atomic publishing', 'shared tag');
  if binding_count <> 2 then
    raise exception 'Phase 04D test failed: normalized Published tag bindings were not synchronized';
  end if;

  if exists (
    select 1
    from public.content_tags as binding
    join public.tags as tag on tag.id = binding.tag_id
    where binding.content_id = projection.id
      and tag.normalized_name = 'old-binding'
  ) then
    raise exception 'Phase 04D test failed: stale Published tag binding survived synchronization';
  end if;

  if not exists (
    select 1
    from public.tags as tag
    where tag.normalized_name = 'shared tag'
      and tag.display_name = 'Shared Tag'
  ) then
    raise exception 'Phase 04D test failed: publishing changed shared global tag display metadata';
  end if;
end;
$$;

rollback;
