begin;

-- Restore provenance lives on the mutable Draft while the idempotency receipt
-- lives on the immutable PreRestore checkpoint so it survives Draft edits,
-- review, publication, or consumption.
alter table public.content_revisions
  add column restore_operation_id uuid,
  add column restored_by uuid,
  add column restored_at timestamptz,
  add constraint content_revisions_restore_provenance_all_or_none check (
    (
      restore_operation_id is null
      and restored_by is null
      and restored_at is null
    )
    or (
      restore_operation_id is not null
      and source_version_id is not null
      and restored_by is not null
      and restored_at is not null
    )
  );

comment on column public.content_revisions.restore_operation_id is
  'Client-generated idempotency key that created this restored Draft; immutable after insertion.';
comment on column public.content_revisions.restored_by is
  'Authenticated Garden Keeper who restored the selected immutable version.';
comment on column public.content_revisions.restored_at is
  'Server-generated time at which the selected version became a Draft.';

alter table public.content_versions
  add column restore_operation_id uuid,
  add column restore_source_version_id uuid,
  add column restore_revision_id uuid,
  add column restore_archived_token timestamptz,
  add constraint content_versions_restore_receipt_all_or_none check (
    (
      restore_operation_id is null
      and restore_source_version_id is null
      and restore_revision_id is null
      and restore_archived_token is null
    )
    or (
      restore_operation_id is not null
      and restore_source_version_id is not null
      and restore_revision_id is not null
      and restore_archived_token is not null
      and checkpoint_reason = 'PreRestore'
    )
  );

comment on column public.content_versions.restore_operation_id is
  'Durable idempotency key for the restore receipt stored by a PreRestore checkpoint.';
comment on column public.content_versions.restore_source_version_id is
  'Immutable version selected as the source of the restored Draft.';
comment on column public.content_versions.restore_revision_id is
  'Original restored Draft UUID retained after the mutable revision is later consumed.';
comment on column public.content_versions.restore_archived_token is
  'Archived projection updated_at token supplied by the original restore request.';

create unique index content_versions_restore_receipt_idx
  on public.content_versions (restore_operation_id)
  where restore_operation_id is not null;

-- Restore metadata is server-managed just like the existing revision audit and
-- review fields. Direct clients cannot forge it, and later Draft edits cannot
-- replace it.
create or replace function public.set_content_revision_audit_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  transition_time timestamptz := statement_timestamp();
  content_fields_changed boolean;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if tg_op = 'INSERT' then
    new.lifecycle = 'Draft';
    new.created_at = transition_time;
    new.created_by = actor_id;
    new.lock_version = 1;
    new.review_submitted_at = null;
    new.review_submitted_by = null;
    new.returned_to_draft_at = null;
    new.returned_to_draft_by = null;

    if new.restore_operation_id is null then
      new.restored_by = null;
      new.restored_at = null;
    else
      if new.source_version_id is null then
        raise invalid_parameter_value using message = 'restore_provenance_invalid';
      end if;
      new.restored_by = actor_id;
      new.restored_at = transition_time;
    end if;
  else
    content_fields_changed :=
      new.slug is distinct from old.slug
      or new.region is distinct from old.region
      or new.content_type is distinct from old.content_type
      or new.detail_level is distinct from old.detail_level
      or new.growth_stage is distinct from old.growth_stage
      or new.title_zh is distinct from old.title_zh
      or new.title_en is distinct from old.title_en
      or new.summary_zh is distinct from old.summary_zh
      or new.summary_en is distinct from old.summary_en
      or new.body_zh_markdown is distinct from old.body_zh_markdown
      or new.body_en_markdown is distinct from old.body_en_markdown
      or new.content_language is distinct from old.content_language
      or new.primary_categories is distinct from old.primary_categories
      or new.tags is distinct from old.tags
      or new.cover_image_path is distinct from old.cover_image_path
      or new.cover_image_alt_zh is distinct from old.cover_image_alt_zh
      or new.cover_image_alt_en is distinct from old.cover_image_alt_en
      or new.featured is distinct from old.featured
      or new.manual_order is distinct from old.manual_order;

    new.id = old.id;
    new.content_id = old.content_id;
    new.source_version_id = old.source_version_id;
    new.restore_operation_id = old.restore_operation_id;
    new.restored_by = old.restored_by;
    new.restored_at = old.restored_at;
    new.base_content_updated_at = old.base_content_updated_at;
    new.created_at = old.created_at;
    new.created_by = old.created_by;
    new.review_submitted_at = old.review_submitted_at;
    new.review_submitted_by = old.review_submitted_by;
    new.returned_to_draft_at = old.returned_to_draft_at;
    new.returned_to_draft_by = old.returned_to_draft_by;

    if old.lifecycle = 'Draft' and new.lifecycle = 'Draft' then
      null;
    elsif old.lifecycle = 'Draft' and new.lifecycle = 'Review' then
      if content_fields_changed then
        raise invalid_parameter_value using message = 'review_transition_must_not_edit';
      end if;
      new.review_submitted_at = transition_time;
      new.review_submitted_by = actor_id;
    elsif old.lifecycle = 'Review' and new.lifecycle = 'Draft' then
      if content_fields_changed then
        raise invalid_parameter_value using message = 'draft_return_must_not_edit';
      end if;
      new.returned_to_draft_at = transition_time;
      new.returned_to_draft_by = actor_id;
    elsif old.lifecycle = 'Review' and new.lifecycle = 'Review' then
      raise invalid_parameter_value using message = 'review_revision_read_only';
    else
      raise invalid_parameter_value using message = 'invalid_revision_transition';
    end if;

    new.lock_version = old.lock_version + 1;
  end if;

  new.updated_at = transition_time;
  new.updated_by = actor_id;
  return new;
end;
$$;

comment on function public.set_content_revision_audit_fields() is
  'Derives revision audit, review, and restore provenance while preserving immutable workspace metadata.';

-- The ordinary clone command remains available for Published content only.
-- Archived content must select an immutable version through the restore RPC.
create or replace function public.start_content_draft_revision(p_content_id uuid)
returns public.content_revisions
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  content record;
  source_version_id uuid;
  revision public.content_revisions;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select
    id,
    slug,
    region,
    content_type,
    detail_level,
    lifecycle,
    growth_stage,
    title_zh,
    title_en,
    summary_zh,
    summary_en,
    body_zh_markdown,
    body_en_markdown,
    content_language,
    primary_categories,
    cover_image_path,
    cover_image_alt_zh,
    cover_image_alt_en,
    featured,
    manual_order,
    updated_at
  into content
  from public.contents
  where id = p_content_id;

  if not found then
    raise no_data_found using message = 'content_not_found';
  end if;

  if content.lifecycle <> 'Published' then
    raise invalid_parameter_value using message = 'invalid_revision_source';
  end if;

  select version.id
  into source_version_id
  from public.content_versions as version
  where version.content_id = content.id
  order by version.created_at desc, version.id desc
  limit 1;

  insert into public.content_revisions (
    content_id,
    lifecycle,
    slug,
    region,
    content_type,
    detail_level,
    growth_stage,
    title_zh,
    title_en,
    summary_zh,
    summary_en,
    body_zh_markdown,
    body_en_markdown,
    content_language,
    primary_categories,
    tags,
    cover_image_path,
    cover_image_alt_zh,
    cover_image_alt_en,
    featured,
    manual_order,
    source_version_id,
    base_content_updated_at,
    created_by,
    updated_by
  ) values (
    content.id,
    'Draft',
    content.slug,
    content.region,
    content.content_type,
    content.detail_level,
    content.growth_stage,
    content.title_zh,
    content.title_en,
    content.summary_zh,
    content.summary_en,
    content.body_zh_markdown,
    content.body_en_markdown,
    content.content_language,
    content.primary_categories,
    coalesce(
      (
        select array_agg(tag.display_name order by tag.display_name)
        from public.content_tags as binding
        join public.tags as tag on tag.id = binding.tag_id
        where binding.content_id = content.id
      ),
      '{}'::text[]
    ),
    content.cover_image_path,
    content.cover_image_alt_zh,
    content.cover_image_alt_en,
    content.featured,
    content.manual_order,
    source_version_id,
    content.updated_at,
    actor_id,
    actor_id
  )
  returning * into revision;

  return revision;
end;
$$;

comment on function public.start_content_draft_revision(uuid) is
  'Starts a private Draft from a Published projection only; Archived content must use restore_version_to_draft.';

-- Keep the existing Keeper policy for ordinary Draft work and add a
-- restrictive INSERT guard. Restrictive policies are ANDed with every future
-- permissive INSERT policy, so no direct client path can construct an Archived
-- Draft or forge restore provenance.
create policy content_revisions_restore_insert_guard
on public.content_revisions
as restrictive
for insert
to authenticated
with check (
  restore_operation_id is null
  and restored_by is null
  and restored_at is null
  and exists (
    select 1
    from public.contents as parent_content
    where parent_content.id = content_id
      and parent_content.lifecycle in ('Draft', 'Published')
  )
);

-- Validate the immutable JSON shape before any enum cast or Draft insert. This
-- deliberately accepts only the two current restorable checkpoint families;
-- PreRestore checkpoints capture Archived state and are not restore sources.
create function private.restore_snapshot_is_valid(
  p_content_id uuid,
  p_current_slug text,
  p_current_region public.garden_region,
  p_snapshot jsonb
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  projection jsonb;
  cover jsonb;
  field_name text;
  source_content_type text;
  source_language text;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    return false;
  end if;

  if not (p_snapshot ? 'projection')
     or jsonb_typeof(p_snapshot -> 'projection') <> 'object'
     or not (p_snapshot ? 'tags')
     or jsonb_typeof(p_snapshot -> 'tags') <> 'array'
     or not (p_snapshot ? 'relations')
     or jsonb_typeof(p_snapshot -> 'relations') <> 'array'
     or not (p_snapshot ? 'growthNotes')
     or jsonb_typeof(p_snapshot -> 'growthNotes') <> 'array'
     or not (p_snapshot ? 'cover') then
    return false;
  end if;

  projection := p_snapshot -> 'projection';

  foreach field_name in array array[
    'id',
    'slug',
    'region',
    'contentType',
    'detailLevel',
    'lifecycle',
    'growthStage',
    'contentLanguage'
  ] loop
    if not (projection ? field_name)
       or jsonb_typeof(projection -> field_name) <> 'string' then
      return false;
    end if;
  end loop;

  foreach field_name in array array[
    'titleZh',
    'titleEn',
    'summaryZh',
    'summaryEn',
    'bodyZhMarkdown',
    'bodyEnMarkdown'
  ] loop
    if not (projection ? field_name)
       or jsonb_typeof(projection -> field_name) not in ('string', 'null') then
      return false;
    end if;
  end loop;

  if not (projection ? 'primaryCategories')
     or jsonb_typeof(projection -> 'primaryCategories') <> 'array'
     or not (projection ? 'cover')
     or jsonb_typeof(projection -> 'cover') not in ('object', 'null')
     or (p_snapshot -> 'cover') is distinct from (projection -> 'cover') then
    return false;
  end if;

  if projection ->> 'id' <> p_content_id::text
     or p_current_slug is null
     or p_current_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or projection ->> 'slug' <> p_current_slug
     or projection ->> 'region' <> p_current_region::text
     or projection ->> 'lifecycle' <> 'Published'
     or projection ->> 'detailLevel' not in ('full', 'short')
     or projection ->> 'growthStage' not in (
       'Seed', 'Sprout', 'Growing', 'Bloom', 'Dormant'
     )
     or projection ->> 'contentLanguage' not in (
       'zh', 'en', 'bilingual', 'mixed'
     ) then
    return false;
  end if;

  if nullif(btrim(coalesce(projection ->> 'titleZh', '')), '') is null
     and nullif(btrim(coalesce(projection ->> 'titleEn', '')), '') is null then
    return false;
  end if;

  if nullif(btrim(coalesce(projection ->> 'summaryZh', '')), '') is null
     and nullif(btrim(coalesce(projection ->> 'summaryEn', '')), '') is null then
    return false;
  end if;

  if nullif(btrim(coalesce(projection ->> 'bodyZhMarkdown', '')), '') is null
     and nullif(btrim(coalesce(projection ->> 'bodyEnMarkdown', '')), '') is null then
    return false;
  end if;

  source_content_type := projection ->> 'contentType';
  if (p_current_region = 'Garden' and source_content_type <> 'Seed')
     or (p_current_region = 'Forest' and source_content_type <> 'Question')
     or (p_current_region = 'Lake' and source_content_type <> 'Reflection')
     or (p_current_region = 'Ruins' and source_content_type <> 'Trace') then
    return false;
  end if;

  if jsonb_array_length(projection -> 'primaryCategories') = 0
     or exists (
       select 1
       from jsonb_array_elements(
         projection -> 'primaryCategories'
       ) as category(value)
       where jsonb_typeof(category.value) <> 'string'
          or nullif(btrim(category.value #>> '{}'), '') is null
     )
     or exists (
       select 1
       from jsonb_array_elements_text(
         projection -> 'primaryCategories'
       ) as category(value)
       where (p_current_region = 'Garden' and category.value not in (
                'Psychology', 'AI', 'Coding', 'Design & Making'
              ))
          or (p_current_region = 'Forest' and category.value not in (
                'Mind & Behavior',
                'Humans & AI',
                'Design & Experience',
                'Stories & Memory'
              ))
          or (p_current_region = 'Lake' and category.value not in (
                'Music', 'Games', 'Films', 'Books & Words', 'Internet'
              ))
          or (p_current_region = 'Ruins' and category.value not in (
                'Drafts', 'Attempts', 'Mistakes'
              ))
     ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'tags') as tag(value)
    where jsonb_typeof(tag.value) <> 'object'
       or not (tag.value ? 'id')
       or jsonb_typeof(tag.value -> 'id') <> 'string'
       or (tag.value ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not (tag.value ? 'normalizedName')
       or jsonb_typeof(tag.value -> 'normalizedName') <> 'string'
       or nullif(btrim(tag.value ->> 'normalizedName'), '') is null
       or tag.value ->> 'normalizedName' <>
          lower(btrim(tag.value ->> 'normalizedName'))
       or not (tag.value ? 'displayName')
       or jsonb_typeof(tag.value -> 'displayName') <> 'string'
       or nullif(btrim(tag.value ->> 'displayName'), '') is null
  )
  or (
    select count(*) <>
      count(distinct lower(btrim(tag.value ->> 'displayName')))
    from jsonb_array_elements(p_snapshot -> 'tags') as tag(value)
  ) then
    return false;
  end if;

  cover := projection -> 'cover';
  source_language := projection ->> 'contentLanguage';

  if jsonb_typeof(cover) = 'object' then
    if not (cover ? 'path')
       or jsonb_typeof(cover -> 'path') <> 'string'
       or not (cover ? 'altZh')
       or jsonb_typeof(cover -> 'altZh') not in ('string', 'null')
       or not (cover ? 'altEn')
       or jsonb_typeof(cover -> 'altEn') not in ('string', 'null')
       or cover ->> 'path' !~ (
         '^contents/' || p_content_id::text || '/[^/]+$'
       )
       or (
         source_language = 'zh'
         and nullif(btrim(coalesce(cover ->> 'altZh', '')), '') is null
       )
       or (
         source_language = 'en'
         and nullif(btrim(coalesce(cover ->> 'altEn', '')), '') is null
       )
       or (
         source_language in ('bilingual', 'mixed')
         and nullif(btrim(coalesce(cover ->> 'altZh', '')), '') is null
         and nullif(btrim(coalesce(cover ->> 'altEn', '')), '') is null
       ) then
      return false;
    end if;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

comment on function private.restore_snapshot_is_valid(uuid, text, public.garden_region, jsonb) is
  'Validates current immutable version JSON before restore casts or workspace writes.';

revoke all on function private.restore_snapshot_is_valid(
  uuid,
  text,
  public.garden_region,
  jsonb
) from public, anon, authenticated;

create function public.restore_version_to_draft(
  p_content_id uuid,
  p_source_version_id uuid,
  p_expected_archived_token timestamptz,
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
  restore_time timestamptz := statement_timestamp();
  content public.contents%rowtype;
  source_version public.content_versions%rowtype;
  receipt_checkpoint public.content_versions%rowtype;
  active_revision public.content_revisions%rowtype;
  restored_revision public.content_revisions%rowtype;
  pre_restore_version_id uuid := gen_random_uuid();
  restored_revision_id uuid := gen_random_uuid();
  source_projection jsonb;
  source_cover jsonb;
  source_categories text[];
  source_tags text[];
  tags_snapshot jsonb := '[]'::jsonb;
  relations_snapshot jsonb := '[]'::jsonb;
  growth_notes_snapshot jsonb := '[]'::jsonb;
  current_cover_snapshot jsonb;
  current_projection_snapshot jsonb;
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

  if p_source_version_id is null then
    raise invalid_parameter_value using message = 'restore_version_invalid';
  end if;

  if p_expected_archived_token is null then
    raise invalid_parameter_value using message = 'invalid_concurrency_token';
  end if;

  if p_operation_id is null then
    raise invalid_parameter_value using message = 'invalid_operation_id';
  end if;

  -- The stable identity lock serializes restore attempts and keeps the
  -- Archived projection unchanged throughout validation and checkpointing.
  select candidate.*
  into content
  from public.contents as candidate
  where candidate.id = p_content_id
  for update;

  if not found then
    raise no_data_found using message = 'content_not_found';
  end if;

  -- Retry recovery precedes lifecycle, version, token, and workspace checks.
  -- The immutable checkpoint retains the original receipt after the Draft is
  -- edited or consumed.
  select checkpoint.*
  into receipt_checkpoint
  from public.content_versions as checkpoint
  where checkpoint.restore_operation_id = p_operation_id;

  if found then
    if receipt_checkpoint.content_id <> p_content_id
       or receipt_checkpoint.restore_source_version_id <> p_source_version_id
       or receipt_checkpoint.restore_archived_token is distinct from
          p_expected_archived_token then
      raise serialization_failure using message = 'restore_operation_conflict';
    end if;

    return jsonb_build_object(
      'contentId', receipt_checkpoint.content_id,
      'sourceVersionId', receipt_checkpoint.restore_source_version_id,
      'revisionId', receipt_checkpoint.restore_revision_id,
      'operationId', receipt_checkpoint.restore_operation_id,
      'preRestoreVersionId', receipt_checkpoint.id,
      'lockVersion', 1,
      'restoredAt', receipt_checkpoint.created_at,
      'restoredBy', receipt_checkpoint.created_by
    );
  end if;

  if content.lifecycle <> 'Archived'
     or content.archived_at is null
     or content.archived_by is null then
    raise invalid_parameter_value using message = 'restore_lifecycle_conflict';
  end if;

  if content.updated_at is distinct from p_expected_archived_token then
    raise serialization_failure using message = 'restore_conflict';
  end if;

  select revision.*
  into active_revision
  from public.content_revisions as revision
  where revision.content_id = p_content_id
  for update;

  if found then
    if active_revision.restore_operation_id is not null then
      raise object_not_in_prerequisite_state
        using message = 'active_restore_conflict';
    end if;

    raise object_not_in_prerequisite_state
      using message = 'active_editorial_workspace';
  end if;

  select version.*
  into source_version
  from public.content_versions as version
  where version.id = p_source_version_id
  for key share;

  if not found
     or source_version.content_id <> p_content_id
     or source_version.checkpoint_reason not in ('Published', 'Archived') then
    raise invalid_parameter_value using message = 'restore_version_invalid';
  end if;

  if (source_version.checkpoint_reason = 'Published'
      and (
        not (source_version.snapshot ? 'publication')
        or jsonb_typeof(source_version.snapshot -> 'publication') <> 'object'
      ))
     or (source_version.checkpoint_reason = 'Archived'
      and (
        not (source_version.snapshot ? 'archive')
        or jsonb_typeof(source_version.snapshot -> 'archive') <> 'object'
      ))
     or not private.restore_snapshot_is_valid(
       p_content_id,
       content.slug,
       content.region,
       source_version.snapshot
     ) then
    raise invalid_parameter_value using message = 'restore_snapshot_invalid';
  end if;

  source_projection := source_version.snapshot -> 'projection';
  source_cover := source_projection -> 'cover';

  select coalesce(array_agg(category.value order by category.ordinality), '{}')
  into source_categories
  from jsonb_array_elements_text(
    source_projection -> 'primaryCategories'
  ) with ordinality as category(value, ordinality);

  select coalesce(
    array_agg(tag.value ->> 'displayName' order by tag.ordinality),
    '{}'
  )
  into source_tags
  from jsonb_array_elements(
    source_version.snapshot -> 'tags'
  ) with ordinality as tag(value, ordinality);

  -- Lock and capture current Archived associations for the checkpoint only.
  -- They are never copied into the restored Draft or otherwise modified.
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

  current_cover_snapshot := case
    when content.cover_image_path is null then null
    else jsonb_build_object(
      'path', content.cover_image_path,
      'altZh', content.cover_image_alt_zh,
      'altEn', content.cover_image_alt_en
    )
  end;

  current_projection_snapshot := jsonb_build_object(
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
    'cover', current_cover_snapshot,
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

  -- The immutable checkpoint is created first. The pre-generated revision UUID
  -- makes its receipt complete without updating the checkpoint later.
  begin
    insert into public.content_versions (
      id,
      content_id,
      snapshot,
      checkpoint_reason,
      checkpoint_note,
      created_at,
      created_by,
      restore_operation_id,
      restore_source_version_id,
      restore_revision_id,
      restore_archived_token
    ) values (
      pre_restore_version_id,
      p_content_id,
      jsonb_build_object(
        'projection', current_projection_snapshot,
        'tags', tags_snapshot,
        'relations', relations_snapshot,
        'growthNotes', growth_notes_snapshot,
        'cover', current_cover_snapshot,
        'restore', jsonb_build_object(
          'operationId', p_operation_id,
          'sourceVersionId', p_source_version_id,
          'revisionId', restored_revision_id,
          'expectedArchivedToken', p_expected_archived_token,
          'lockVersion', 1,
          'restoredAt', restore_time,
          'restoredBy', actor_id
        )
      ),
      'PreRestore',
      null,
      restore_time,
      actor_id,
      p_operation_id,
      p_source_version_id,
      restored_revision_id,
      p_expected_archived_token
    )
    returning * into receipt_checkpoint;
  exception
    when unique_violation then
      raise serialization_failure using message = 'restore_operation_conflict';
  end;

  insert into public.content_revisions (
    id,
    content_id,
    lifecycle,
    slug,
    region,
    content_type,
    detail_level,
    growth_stage,
    title_zh,
    title_en,
    summary_zh,
    summary_en,
    body_zh_markdown,
    body_en_markdown,
    content_language,
    primary_categories,
    tags,
    cover_image_path,
    cover_image_alt_zh,
    cover_image_alt_en,
    featured,
    manual_order,
    source_version_id,
    restore_operation_id,
    restored_by,
    restored_at,
    base_content_updated_at,
    created_by,
    updated_by
  ) values (
    restored_revision_id,
    p_content_id,
    'Draft',
    content.slug,
    content.region,
    (source_projection ->> 'contentType')::public.content_type,
    (source_projection ->> 'detailLevel')::public.detail_level,
    (source_projection ->> 'growthStage')::public.growth_stage,
    source_projection ->> 'titleZh',
    source_projection ->> 'titleEn',
    source_projection ->> 'summaryZh',
    source_projection ->> 'summaryEn',
    source_projection ->> 'bodyZhMarkdown',
    source_projection ->> 'bodyEnMarkdown',
    (source_projection ->> 'contentLanguage')::public.content_language,
    source_categories,
    source_tags,
    case when jsonb_typeof(source_cover) = 'object'
      then source_cover ->> 'path'
      else null
    end,
    case when jsonb_typeof(source_cover) = 'object'
      then source_cover ->> 'altZh'
      else null
    end,
    case when jsonb_typeof(source_cover) = 'object'
      then source_cover ->> 'altEn'
      else null
    end,
    false,
    null,
    p_source_version_id,
    p_operation_id,
    actor_id,
    restore_time,
    content.updated_at,
    actor_id,
    actor_id
  )
  returning * into restored_revision;

  return jsonb_build_object(
    'contentId', receipt_checkpoint.content_id,
    'sourceVersionId', receipt_checkpoint.restore_source_version_id,
    'revisionId', restored_revision.id,
    'operationId', receipt_checkpoint.restore_operation_id,
    'preRestoreVersionId', receipt_checkpoint.id,
    'lockVersion', restored_revision.lock_version,
    'restoredAt', restored_revision.restored_at,
    'restoredBy', restored_revision.restored_by
  );
end;
$$;

comment on function public.restore_version_to_draft(
  uuid,
  uuid,
  timestamptz,
  uuid
) is
  'Atomically checkpoints one Archived projection and restores approved fields from a selected immutable version into a new private Draft.';

revoke all on function public.restore_version_to_draft(
  uuid,
  uuid,
  timestamptz,
  uuid
) from public, anon, authenticated;
grant execute on function public.restore_version_to_draft(
  uuid,
  uuid,
  timestamptz,
  uuid
) to authenticated;

-- Keep immutable versions append-only and stable projections unavailable for
-- direct lifecycle changes after adding the restore command.
revoke update, delete on table public.contents from authenticated;
revoke insert, update, delete on table public.content_versions
  from authenticated;

commit;
