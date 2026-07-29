begin;

create or replace function public.delete_archived_content(
  p_content_id uuid,
  p_expected_archived_token timestamptz default null,
  p_impact_digest text default null,
  p_operation_id uuid default null
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
  effective_archived_token timestamptz;
  effective_impact_digest text;
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

  if p_impact_digest is not null
     and p_impact_digest !~ '^[0-9a-f]{32}$' then
    raise invalid_parameter_value using message = 'impact_digest_invalid';
  end if;

  select candidate.*
  into content
  from public.contents as candidate
  where candidate.id = p_content_id
  for update;

  if not found then
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

  if p_expected_archived_token is not null
     and content.updated_at is distinct from p_expected_archived_token then
    raise serialization_failure using message = 'delete_conflict';
  end if;

  canonical_route :=
    '/' || lower(content.region::text) || '/' || content.slug;

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
  effective_archived_token := coalesce(
    p_expected_archived_token,
    (impact ->> 'expectedArchivedToken')::timestamptz
  );
  effective_impact_digest := coalesce(
    p_impact_digest,
    impact ->> 'impactDigest'
  );

  if p_impact_digest is not null
     and impact ->> 'impactDigest' <> p_impact_digest then
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
      effective_archived_token,
      effective_impact_digest,
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
  'Atomically validates and deletes one Archived projection. Optional preview confirmation values are honored when supplied; otherwise the server derives current impact inside the delete transaction.';

grant execute on function public.delete_archived_content(
  uuid,
  timestamptz,
  text,
  uuid
) to authenticated;

commit;
