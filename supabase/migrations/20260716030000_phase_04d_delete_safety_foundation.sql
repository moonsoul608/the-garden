begin;

-- Historical checkpoints outlive permanent projection deletion. The original
-- CASCADE would erase immutable publication/archive/restore history, so the
-- UUID remains as durable provenance without a live-projection foreign key.
alter table public.content_versions
  drop constraint content_versions_content_id_fkey;

comment on column public.content_versions.content_id is
  'Original content UUID. Immutable checkpoints retain this value after the live contents projection is permanently deleted.';

-- Reuse route_redirects for terminal 410 records while retaining deletion
-- provenance after its live content_id foreign key is cleared by ON DELETE.
alter table public.route_redirects
  add column tombstone_original_content_id uuid,
  add column tombstone_operation_id uuid,
  add column tombstoned_at timestamptz,
  add constraint route_redirects_tombstone_metadata_all_or_none check (
    (
      tombstone_original_content_id is null
      and tombstone_operation_id is null
      and tombstoned_at is null
    )
    or (
      tombstone_original_content_id is not null
      and tombstone_operation_id is not null
      and tombstoned_at is not null
      and status_code = 410
      and new_path is null
    )
  );

comment on column public.route_redirects.tombstone_original_content_id is
  'Original content UUID retained by a terminal route record after contents deletion.';
comment on column public.route_redirects.tombstone_operation_id is
  'Deletion operation that converted or created this terminal route record.';
comment on column public.route_redirects.tombstoned_at is
  'Server-derived time at which this route became terminal.';

create index route_redirects_tombstone_content_idx
  on public.route_redirects (tombstone_original_content_id)
  where tombstone_original_content_id is not null;

create index route_redirects_tombstone_operation_idx
  on public.route_redirects (tombstone_operation_id)
  where tombstone_operation_id is not null;

-- Operational receipts contain counts and route-operation results only. They
-- intentionally contain no body, snapshot, Growth Note, title, or cover data.
create table public.content_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  original_content_id uuid not null unique,
  operation_id uuid not null unique,
  actor_id uuid not null,
  deleted_at timestamptz not null,
  expected_archived_token timestamptz not null,
  impact_digest text not null,
  impact_counts jsonb not null,
  tombstone_result jsonb not null,
  constraint content_deletion_receipts_impact_digest_format check (
    impact_digest ~ '^[0-9a-f]{32}$'
  ),
  constraint content_deletion_receipts_impact_counts_object check (
    jsonb_typeof(impact_counts) = 'object'
  ),
  constraint content_deletion_receipts_tombstone_result_object check (
    jsonb_typeof(tombstone_result) = 'object'
  )
);

comment on table public.content_deletion_receipts is
  'Append-only operational trace for terminal content deletion; never stores editorial content or cover metadata.';

revoke all on table public.content_deletion_receipts
  from public, anon, authenticated;
grant select on table public.content_deletion_receipts to authenticated;

alter table public.content_deletion_receipts enable row level security;

create policy content_deletion_receipts_garden_keeper_read
on public.content_deletion_receipts
for select
to authenticated
using ((select private.is_garden_keeper()));

create function private.reject_content_deletion_receipt_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise object_not_in_prerequisite_state
    using message = 'deletion_receipt_immutable';
end;
$$;

revoke all on function private.reject_content_deletion_receipt_mutation()
  from public, anon, authenticated;

create trigger content_deletion_receipts_append_only
before update or delete on public.content_deletion_receipts
for each row execute function private.reject_content_deletion_receipt_mutation();

-- Build the public confirmation contract and its digest from current server
-- state. Internal version IDs and Storage paths participate in the digest but
-- are deliberately omitted from the returned preview.
create function private.analyze_archived_content_deletion(p_content_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  content public.contents%rowtype;
  canonical_route text;
  historical_routes jsonb := '[]'::jsonb;
  redirect_references jsonb := '[]'::jsonb;
  version_ids jsonb := '[]'::jsonb;
  revision_status jsonb;
  inbound_relations jsonb := '[]'::jsonb;
  outbound_relations jsonb := '[]'::jsonb;
  storage_references jsonb := '[]'::jsonb;
  invalidation_surfaces jsonb :=
    '["route","metadata","sitemap","search"]'::jsonb;
  preview jsonb;
  fingerprint jsonb;
begin
  select candidate.*
  into content
  from public.contents as candidate
  where candidate.id = p_content_id;

  if not found then
    raise no_data_found using message = 'content_not_found';
  end if;

  if content.lifecycle <> 'Archived'
     or content.archived_at is null
     or content.archived_by is null then
    raise invalid_parameter_value using message = 'delete_lifecycle_conflict';
  end if;

  canonical_route :=
    '/' || lower(content.region::text) || '/' || content.slug;

  select coalesce(
    jsonb_agg(to_jsonb(redirect.old_path) order by redirect.old_path),
    '[]'::jsonb
  )
  into historical_routes
  from public.route_redirects as redirect
  where redirect.content_id = p_content_id
    and redirect.old_path <> canonical_route;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'routePath', redirect.old_path,
        'destinationPath', redirect.new_path,
        'statusCode', redirect.status_code
      )
      order by redirect.old_path, redirect.id
    ),
    '[]'::jsonb
  )
  into redirect_references
  from public.route_redirects as redirect
  where redirect.content_id = p_content_id;

  select coalesce(
    jsonb_agg(to_jsonb(version.id) order by version.created_at, version.id),
    '[]'::jsonb
  )
  into version_ids
  from public.content_versions as version
  where version.content_id = p_content_id;

  select jsonb_build_object(
    'active', true,
    'revisionId', revision.id,
    'lifecycle', revision.lifecycle,
    'lockVersion', revision.lock_version
  )
  into revision_status
  from public.content_revisions as revision
  where revision.content_id = p_content_id;

  if revision_status is null then
    revision_status := jsonb_build_object(
      'active', false,
      'revisionId', null,
      'lifecycle', null,
      'lockVersion', null
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'relationId', relation.id,
        'relatedContentId', relation.source_content_id,
        'relationType', relation.relation_type
      )
      order by relation.created_at, relation.id
    ),
    '[]'::jsonb
  )
  into inbound_relations
  from public.content_relations as relation
  where relation.target_content_id = p_content_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'relationId', relation.id,
        'relatedContentId', relation.target_content_id,
        'relationType', relation.relation_type
      )
      order by relation.created_at, relation.id
    ),
    '[]'::jsonb
  )
  into outbound_relations
  from public.content_relations as relation
  where relation.source_content_id = p_content_id;

  select coalesce(
    jsonb_agg(
      storage_reference
      order by storage_reference ->> 'source', storage_reference ->> 'id'
    ),
    '[]'::jsonb
  )
  into storage_references
  from (
    select jsonb_build_object(
      'source', 'projection',
      'id', content.id,
      'path', content.cover_image_path
    ) as storage_reference
    where content.cover_image_path is not null

    union all

    select jsonb_build_object(
      'source', 'version',
      'id', version.id,
      'path', coalesce(
        nullif(version.snapshot #>> '{cover,path}', ''),
        nullif(version.snapshot #>> '{projection,cover,path}', '')
      )
    ) as storage_reference
    from public.content_versions as version
    where version.content_id = p_content_id
      and coalesce(
        nullif(version.snapshot #>> '{cover,path}', ''),
        nullif(version.snapshot #>> '{projection,cover,path}', '')
      ) is not null
  ) as references_with_paths;

  preview := jsonb_build_object(
    'contentId', content.id,
    'lifecycle', content.lifecycle,
    'expectedArchivedToken', content.updated_at,
    'canonicalRoute', canonical_route,
    'historicalRoutes', historical_routes,
    'redirectReferences', redirect_references,
    'versionCount', jsonb_array_length(version_ids),
    'revisionStatus', revision_status,
    'inboundRelations', inbound_relations,
    'outboundRelations', outbound_relations,
    'storageReferenceCount', jsonb_array_length(storage_references),
    'affectedInvalidationSurfaces', invalidation_surfaces
  );

  fingerprint := preview || jsonb_build_object(
    '_versionIds', version_ids,
    '_storageReferences', storage_references
  );

  return preview || jsonb_build_object(
    'impactDigest', md5(fingerprint::text)
  );
end;
$$;

comment on function private.analyze_archived_content_deletion(uuid) is
  'Builds a deterministic deletion-impact preview and digest without exposing editorial content or Storage paths.';

revoke all on function private.analyze_archived_content_deletion(uuid)
  from public, anon, authenticated;

create function public.preview_archived_content_deletion(p_content_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if not private.is_garden_keeper() then
    raise insufficient_privilege using message = 'garden_keeper_required';
  end if;

  if p_content_id is null then
    raise no_data_found using message = 'content_not_found';
  end if;

  return private.analyze_archived_content_deletion(p_content_id);
end;
$$;

comment on function public.preview_archived_content_deletion(uuid) is
  'Returns the Keeper-only server-generated impact contract and confirmation digest for one Archived content identity.';

revoke all on function public.preview_archived_content_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.preview_archived_content_deletion(uuid)
  to authenticated;

create function private.content_deletion_receipt_json(
  p_receipt public.content_deletion_receipts,
  p_status text
)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'status', p_status,
    'contentId', p_receipt.original_content_id,
    'operationId', p_receipt.operation_id,
    'deletedAt', p_receipt.deleted_at,
    'deletedBy', p_receipt.actor_id,
    'impactCounts', p_receipt.impact_counts,
    'tombstoneResult', p_receipt.tombstone_result
  );
$$;

revoke all on function private.content_deletion_receipt_json(
  public.content_deletion_receipts,
  text
) from public, anon, authenticated;

create function public.delete_archived_content(
  p_content_id uuid,
  p_expected_archived_token timestamptz,
  p_impact_digest text,
  p_operation_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  deletion_time timestamptz := statement_timestamp();
  content public.contents%rowtype;
  existing_receipt public.content_deletion_receipts%rowtype;
  deletion_receipt public.content_deletion_receipts%rowtype;
  canonical_route text;
  canonical_record public.route_redirects%rowtype;
  impact jsonb;
  impact_counts jsonb;
  tombstone_result jsonb;
  requested_tombstone_count integer := 0;
  converted_tombstone_count integer := 0;
  inserted_tombstone_count integer := 0;
  created_tombstone_count integer := 0;
  removed_relation_count integer := 0;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if not private.is_garden_keeper() then
    raise insufficient_privilege using message = 'garden_keeper_required';
  end if;

  if p_content_id is null then
    raise no_data_found using message = 'content_not_found';
  end if;

  if p_operation_id is null then
    raise invalid_parameter_value using message = 'invalid_operation_id';
  end if;

  select receipt.*
  into existing_receipt
  from public.content_deletion_receipts as receipt
  where receipt.operation_id = p_operation_id;

  if found then
    if existing_receipt.original_content_id <> p_content_id then
      raise serialization_failure using message = 'delete_operation_conflict';
    end if;

    return private.content_deletion_receipt_json(existing_receipt, 'deleted');
  end if;

  select receipt.*
  into existing_receipt
  from public.content_deletion_receipts as receipt
  where receipt.original_content_id = p_content_id;

  if found then
    return private.content_deletion_receipt_json(
      existing_receipt,
      'already_completed'
    );
  end if;

  if p_expected_archived_token is null then
    raise invalid_parameter_value using message = 'invalid_concurrency_token';
  end if;

  if p_impact_digest is null
     or p_impact_digest !~ '^[0-9a-f]{32}$' then
    raise invalid_parameter_value using message = 'impact_digest_invalid';
  end if;

  select candidate.*
  into content
  from public.contents as candidate
  where candidate.id = p_content_id
  for update;

  if not found then
    -- A concurrent deletion may have committed while this command waited for
    -- the stable identity lock. Re-read receipts before declaring not found.
    select receipt.*
    into existing_receipt
    from public.content_deletion_receipts as receipt
    where receipt.operation_id = p_operation_id
       or receipt.original_content_id = p_content_id
    order by (receipt.operation_id = p_operation_id) desc
    limit 1;

    if found then
      if existing_receipt.operation_id = p_operation_id
         and existing_receipt.original_content_id <> p_content_id then
        raise serialization_failure using message = 'delete_operation_conflict';
      end if;

      return private.content_deletion_receipt_json(
        existing_receipt,
        case
          when existing_receipt.operation_id = p_operation_id
            then 'deleted'
          else 'already_completed'
        end
      );
    end if;

    raise no_data_found using message = 'content_not_found';
  end if;

  if content.lifecycle <> 'Archived'
     or content.archived_at is null
     or content.archived_by is null then
    raise invalid_parameter_value using message = 'delete_lifecycle_conflict';
  end if;

  perform revision.id
  from public.content_revisions as revision
  where revision.content_id = p_content_id
  for update;

  if found then
    raise object_not_in_prerequisite_state
      using message = 'active_editorial_workspace';
  end if;

  if content.updated_at is distinct from p_expected_archived_token then
    raise serialization_failure using message = 'delete_conflict';
  end if;

  canonical_route :=
    '/' || lower(content.region::text) || '/' || content.slug;

  -- Lock every dependency represented by the digest before recomputing it.
  perform version.id
  from public.content_versions as version
  where version.content_id = p_content_id
  for share;

  perform relation.id
  from public.content_relations as relation
  where relation.source_content_id = p_content_id
     or relation.target_content_id = p_content_id
  for update;

  perform redirect.id
  from public.route_redirects as redirect
  where redirect.content_id = p_content_id
     or redirect.old_path = canonical_route
  for update;

  impact := private.analyze_archived_content_deletion(p_content_id);

  if impact ->> 'impactDigest' <> p_impact_digest then
    raise serialization_failure using message = 'impact_digest_mismatch';
  end if;

  select redirect.*
  into canonical_record
  from public.route_redirects as redirect
  where redirect.old_path = canonical_route;

  if found
     and coalesce(
       canonical_record.tombstone_original_content_id,
       canonical_record.content_id
     ) is distinct from p_content_id then
    raise unique_violation using message = 'route_tombstone_conflict';
  end if;

  if exists (
    select 1
    from public.contents as other_content
    join public.route_redirects as historical
      on historical.content_id = p_content_id
     and historical.old_path =
       '/' || lower(other_content.region::text) || '/' || other_content.slug
    where other_content.id <> p_content_id
  ) then
    raise unique_violation using message = 'route_tombstone_conflict';
  end if;

  select count(*)
  into requested_tombstone_count
  from (
    select canonical_route as route_path
    union
    select redirect.old_path
    from public.route_redirects as redirect
    where redirect.content_id = p_content_id
  ) as requested_routes;

  update public.route_redirects as redirect
  set
    new_path = null,
    status_code = 410,
    tombstone_original_content_id = p_content_id,
    tombstone_operation_id = p_operation_id,
    tombstoned_at = deletion_time
  where redirect.content_id = p_content_id;

  get diagnostics converted_tombstone_count = row_count;

  if canonical_record.id is null then
    insert into public.route_redirects (
      old_path,
      new_path,
      status_code,
      content_id,
      created_at,
      tombstone_original_content_id,
      tombstone_operation_id,
      tombstoned_at
    ) values (
      canonical_route,
      null,
      410,
      p_content_id,
      deletion_time,
      p_content_id,
      p_operation_id,
      deletion_time
    );
    inserted_tombstone_count := 1;
  else
    update public.route_redirects as redirect
    set
      new_path = null,
      status_code = 410,
      tombstone_original_content_id = p_content_id,
      tombstone_operation_id = p_operation_id,
      tombstoned_at = deletion_time
    where redirect.id = canonical_record.id;
  end if;

  select count(*)
  into created_tombstone_count
  from public.route_redirects as redirect
  where redirect.tombstone_original_content_id = p_content_id
    and redirect.tombstone_operation_id = p_operation_id;

  if created_tombstone_count <> requested_tombstone_count then
    raise serialization_failure using message = 'route_tombstone_incomplete';
  end if;

  delete from public.content_relations as relation
  where relation.source_content_id = p_content_id
     or relation.target_content_id = p_content_id;

  get diagnostics removed_relation_count = row_count;

  if removed_relation_count <>
     jsonb_array_length(impact -> 'inboundRelations') +
     jsonb_array_length(impact -> 'outboundRelations') then
    raise serialization_failure using message = 'relation_cleanup_conflict';
  end if;

  impact_counts := jsonb_build_object(
    'canonicalRouteCount', 1,
    'historicalRouteCount', jsonb_array_length(impact -> 'historicalRoutes'),
    'redirectReferenceCount', jsonb_array_length(impact -> 'redirectReferences'),
    'versionCount', (impact ->> 'versionCount')::integer,
    'revisionCount', case
      when (impact #>> '{revisionStatus,active}')::boolean then 1
      else 0
    end,
    'inboundRelationCount', jsonb_array_length(impact -> 'inboundRelations'),
    'outboundRelationCount', jsonb_array_length(impact -> 'outboundRelations'),
    'storageReferenceCount', (impact ->> 'storageReferenceCount')::integer,
    'invalidationSurfaceCount',
      jsonb_array_length(impact -> 'affectedInvalidationSurfaces')
  );

  tombstone_result := jsonb_build_object(
    'requestedCount', requested_tombstone_count,
    'createdCount', created_tombstone_count,
    'insertedCount', inserted_tombstone_count,
    'convertedCount', converted_tombstone_count
  );

  begin
    insert into public.content_deletion_receipts (
      original_content_id,
      operation_id,
      actor_id,
      deleted_at,
      expected_archived_token,
      impact_digest,
      impact_counts,
      tombstone_result
    ) values (
      p_content_id,
      p_operation_id,
      actor_id,
      deletion_time,
      p_expected_archived_token,
      p_impact_digest,
      impact_counts,
      tombstone_result
    )
    returning * into deletion_receipt;
  exception
    when unique_violation then
      raise serialization_failure using message = 'delete_operation_conflict';
  end;

  delete from public.contents as projection
  where projection.id = p_content_id;

  if not found then
    raise serialization_failure using message = 'delete_conflict';
  end if;

  return private.content_deletion_receipt_json(deletion_receipt, 'deleted');
end;
$$;

comment on function public.delete_archived_content(
  uuid,
  timestamptz,
  text,
  uuid
) is
  'Atomically validates one Archived projection against a server impact digest, creates terminal route records, removes live relations, appends a receipt, and deletes only the live projection and its cascading dependents.';

revoke all on function public.delete_archived_content(
  uuid,
  timestamptz,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.delete_archived_content(
  uuid,
  timestamptz,
  text,
  uuid
) to authenticated;

-- Keep every direct destructive route closed even if an older project had
-- already applied the broad Phase 02D grants.
revoke delete on table public.contents from authenticated;
revoke delete on table public.route_redirects from authenticated;
revoke insert, update, delete on table public.content_versions
  from authenticated;

commit;
