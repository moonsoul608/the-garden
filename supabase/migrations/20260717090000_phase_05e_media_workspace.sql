begin;

-- Cover media visibility is exposed through one allow-listed Keeper DTO.
-- Internal ledger rows, Storage credentials, and purge evidence remain private.
create function public.list_keeper_media_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  result jsonb;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if not private.is_garden_keeper() then
    raise insufficient_privilege using message = 'garden_keeper_required';
  end if;

  with identities as (
    select object.bucket_id as bucket, object.name as object_path
    from storage.objects as object
    where object.bucket_id = 'cover-images'

    union

    select reference.bucket, reference.object_path
    from public.storage_object_references as reference
    where reference.bucket = 'cover-images'

    union

    select lifecycle.bucket, lifecycle.object_path
    from public.storage_object_lifecycles as lifecycle
    where lifecycle.bucket = 'cover-images'
  ), reference_summary as (
    select
      reference.bucket,
      reference.object_path,
      count(*)::integer as reference_count,
      count(distinct reference.content_id)
        filter (where reference.content_id is not null)::integer
        as referenced_content_count,
      count(*) filter (
        where reference.reference_owner_type = 'ContentProjection'
      )::integer as projection_reference_count,
      count(*) filter (
        where reference.reference_owner_type = 'ContentRevision'
      )::integer as revision_reference_count,
      count(*) filter (
        where reference.reference_owner_type = 'ContentVersion'
      )::integer as version_reference_count
    from public.storage_object_references as reference
    where reference.bucket = 'cover-images'
    group by reference.bucket, reference.object_path
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', identity.bucket,
        'objectPath', identity.object_path,
        'physicalObjectExists', object.id is not null,
        'mimeType', object.metadata ->> 'mimetype',
        'sizeBytes', case
          when (object.metadata ->> 'size') ~ '^[0-9]+$'
            then (object.metadata ->> 'size')::bigint
          else null
        end,
        'createdAt', object.created_at,
        'updatedAt', object.updated_at,
        'referenceCount', coalesce(summary.reference_count, 0),
        'referencedContentCount',
          coalesce(summary.referenced_content_count, 0),
        'projectionReferenceCount',
          coalesce(summary.projection_reference_count, 0),
        'revisionReferenceCount',
          coalesce(summary.revision_reference_count, 0),
        'versionReferenceCount',
          coalesce(summary.version_reference_count, 0),
        'lifecycleState', coalesce(
          lifecycle.lifecycle_state::text,
          case
            when coalesce(summary.reference_count, 0) > 0 then 'Referenced'
            else 'Unreferenced'
          end
        )
      )
      order by object.updated_at desc nulls last, identity.object_path
    ),
    '[]'::jsonb
  )
  into result
  from identities as identity
  left join storage.objects as object
    on object.bucket_id = identity.bucket
   and object.name = identity.object_path
  left join reference_summary as summary
    on summary.bucket = identity.bucket
   and summary.object_path = identity.object_path
  left join public.storage_object_lifecycles as lifecycle
    on lifecycle.bucket = identity.bucket
   and lifecycle.object_path = identity.object_path;

  return result;
end;
$$;

comment on function public.list_keeper_media_workspace() is
  'Keeper-only cover inventory and reference summary. It exposes no credentials, mutation, deletion, purge, or internal row identifiers.';

revoke all on function public.list_keeper_media_workspace()
  from public, anon, authenticated;
grant execute on function public.list_keeper_media_workspace()
  to authenticated;

commit;
