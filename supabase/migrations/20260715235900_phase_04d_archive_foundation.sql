begin;

-- Archive actor metadata belongs to the stable projection, while the operation
-- UUID belongs to the immutable checkpoint that doubles as the retry receipt.
alter table public.contents
  add column archived_by uuid;

comment on column public.contents.archived_by is
  'Authenticated Garden Keeper who performed the current archive transition; null before archive.';

alter table public.content_versions
  add column archive_operation_id uuid;

comment on column public.content_versions.archive_operation_id is
  'Client-generated idempotency key for an Archived checkpoint; null for checkpoints created by other workflows.';

create unique index content_versions_archive_receipt_idx
  on public.content_versions (archive_operation_id)
  where archive_operation_id is not null;

-- Atomic publishing already removed direct authenticated projection updates.
-- Repeat the revoke here so archive safety remains explicit and reproducible.
revoke update, delete on table public.contents from authenticated;
revoke insert, update, delete on table public.content_versions
  from authenticated;

create function public.archive_published_content(
  p_content_id uuid,
  p_expected_updated_at timestamptz,
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
  archive_time timestamptz := statement_timestamp();
  content public.contents%rowtype;
  archive_version public.content_versions%rowtype;
  version_id uuid := gen_random_uuid();
  tags_snapshot jsonb := '[]'::jsonb;
  relations_snapshot jsonb := '[]'::jsonb;
  growth_notes_snapshot jsonb := '[]'::jsonb;
  cover_snapshot jsonb;
  projection_snapshot jsonb;
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

  if p_expected_updated_at is null then
    raise invalid_parameter_value using message = 'invalid_concurrency_token';
  end if;

  if p_operation_id is null then
    raise invalid_parameter_value using message = 'invalid_operation_id';
  end if;

  -- Serialize every archive attempt for one stable identity. This also keeps
  -- association inserts that depend on this content identity out of the
  -- checkpoint window until the transition completes.
  select candidate.*
  into content
  from public.contents as candidate
  where candidate.id = p_content_id
  for update;

  if not found then
    raise no_data_found using message = 'content_not_found';
  end if;

  -- Retry recovery precedes lifecycle and concurrency checks because the
  -- original operation has already changed both values by design.
  select checkpoint.*
  into archive_version
  from public.content_versions as checkpoint
  where checkpoint.archive_operation_id = p_operation_id;

  if found then
    if archive_version.content_id <> p_content_id then
      raise serialization_failure using message = 'archive_operation_conflict';
    end if;

    return jsonb_build_object(
      'contentId', archive_version.content_id,
      'operationId', archive_version.archive_operation_id,
      'versionId', archive_version.id,
      'archivedAt', archive_version.created_at,
      'archivedBy', archive_version.created_by
    );
  end if;

  if content.lifecycle <> 'Published'
     or content.archived_at is not null
     or content.archived_by is not null then
    raise invalid_parameter_value using message = 'archive_lifecycle_conflict';
  end if;

  if content.updated_at is distinct from p_expected_updated_at then
    raise serialization_failure using message = 'archive_conflict';
  end if;

  -- The workspace is unique by content_id and limited to Draft/Review. Lock it
  -- before rejecting so a concurrent publication cannot consume it midway.
  perform revision.id
  from public.content_revisions as revision
  where revision.content_id = p_content_id
  for update;

  if found then
    raise object_not_in_prerequisite_state
      using message = 'active_editorial_workspace';
  end if;

  -- Lock every existing association included in the checkpoint. Archive never
  -- updates or deletes these rows or their referenced Storage object.
  perform note.id
  from public.growth_notes as note
  where note.content_id = p_content_id
  for update;

  perform relation.id
  from public.content_relations as relation
  where relation.source_content_id = p_content_id
     or relation.target_content_id = p_content_id
  for update;

  perform binding.tag_id
  from public.content_tags as binding
  where binding.content_id = p_content_id
  for update;

  perform curated.content_id
  from public.home_curation as curated
  where curated.content_id = p_content_id
  for update;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', tag.id,
        'normalizedName', tag.normalized_name,
        'displayName', tag.display_name
      )
      order by tag.normalized_name, tag.id
    ),
    '[]'::jsonb
  )
  into tags_snapshot
  from public.content_tags as binding
  join public.tags as tag on tag.id = binding.tag_id
  where binding.content_id = p_content_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', relation.id,
        'sourceContentId', relation.source_content_id,
        'targetContentId', relation.target_content_id,
        'relationType', relation.relation_type,
        'noteZh', relation.note_zh,
        'noteEn', relation.note_en,
        'createdAt', relation.created_at
      )
      order by relation.created_at, relation.id
    ),
    '[]'::jsonb
  )
  into relations_snapshot
  from public.content_relations as relation
  where relation.source_content_id = p_content_id
     or relation.target_content_id = p_content_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', note.id,
        'contentId', note.content_id,
        'fromStage', note.from_stage,
        'toStage', note.to_stage,
        'noteZh', note.note_zh,
        'noteEn', note.note_en,
        'occurredAt', note.occurred_at,
        'isPublic', note.is_public,
        'createdAt', note.created_at
      )
      order by note.occurred_at, note.id
    ),
    '[]'::jsonb
  )
  into growth_notes_snapshot
  from public.growth_notes as note
  where note.content_id = p_content_id;

  cover_snapshot := case
    when content.cover_image_path is null then null
    else jsonb_build_object(
      'path', content.cover_image_path,
      'altZh', content.cover_image_alt_zh,
      'altEn', content.cover_image_alt_en
    )
  end;

  projection_snapshot := jsonb_build_object(
    'id', content.id,
    'legacyId', content.legacy_id,
    'slug', content.slug,
    'region', content.region,
    'contentType', content.content_type,
    'detailLevel', content.detail_level,
    'lifecycle', content.lifecycle,
    'growthStage', content.growth_stage,
    'titleZh', content.title_zh,
    'titleEn', content.title_en,
    'summaryZh', content.summary_zh,
    'summaryEn', content.summary_en,
    'bodyZhMarkdown', content.body_zh_markdown,
    'bodyEnMarkdown', content.body_en_markdown,
    'contentLanguage', content.content_language,
    'primaryCategories', to_jsonb(content.primary_categories),
    'cover', cover_snapshot,
    'featured', content.featured,
    'manualOrder', content.manual_order,
    'createdAt', content.created_at,
    'updatedAt', content.updated_at,
    'publishedAt', content.published_at,
    'archivedAt', content.archived_at,
    'lastTendedAt', content.last_tended_at,
    'createdBy', content.created_by,
    'updatedBy', content.updated_by,
    'archivedBy', content.archived_by
  );

  begin
    insert into public.content_versions (
      id,
      content_id,
      snapshot,
      checkpoint_reason,
      checkpoint_note,
      created_at,
      created_by,
      archive_operation_id
    ) values (
      version_id,
      p_content_id,
      jsonb_build_object(
        'projection', projection_snapshot,
        'tags', tags_snapshot,
        'relations', relations_snapshot,
        'growthNotes', growth_notes_snapshot,
        'cover', cover_snapshot,
        'archive', jsonb_build_object(
          'operationId', p_operation_id,
          'archivedAt', archive_time,
          'archivedBy', actor_id
        )
      ),
      'Archived',
      null,
      archive_time,
      actor_id,
      p_operation_id
    )
    returning * into archive_version;
  exception
    when unique_violation then
      raise serialization_failure using message = 'archive_operation_conflict';
  end;

  update public.contents as projection
  set
    lifecycle = 'Archived',
    archived_at = archive_time,
    archived_by = actor_id,
    updated_at = archive_time,
    updated_by = actor_id
  where projection.id = p_content_id;

  delete from public.home_curation as curated
  where curated.content_id = p_content_id;

  return jsonb_build_object(
    'contentId', archive_version.content_id,
    'operationId', archive_version.archive_operation_id,
    'versionId', archive_version.id,
    'archivedAt', archive_version.created_at,
    'archivedBy', archive_version.created_by
  );
end;
$$;

comment on function public.archive_published_content(uuid, timestamptz, uuid) is
  'Atomically archives one Published projection, snapshots its pre-archive state and associations, removes Home curation, and returns an idempotent immutable receipt.';

revoke all on function public.archive_published_content(uuid, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.archive_published_content(uuid, timestamptz, uuid)
  to authenticated;

commit;
