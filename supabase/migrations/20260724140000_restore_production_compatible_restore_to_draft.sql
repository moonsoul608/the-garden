begin;

-- The immutable PreRestore checkpoint is the durable restore receipt.  Keep
-- provenance out of content_revisions because Production intentionally uses
-- the Review-workflow audit trigger without restore-only revision columns.
alter table public.content_versions
  add column if not exists restore_operation_id uuid,
  add column if not exists restore_source_version_id uuid,
  add column if not exists restore_revision_id uuid,
  add column if not exists restore_archived_token timestamptz;

do $migration$
declare
  existing_definition text;
  expected_definition text :=
    'restore_operation_idisnullandrestore_source_version_idisnullandrestore_revision_idisnullandrestore_archived_tokenisnullorrestore_operation_idisnotnullandrestore_source_version_idisnotnullandrestore_revision_idisnotnullandrestore_archived_tokenisnotnullandcheckpoint_reason=''prerestore''';
begin
  select regexp_replace(
    regexp_replace(
      lower(pg_get_expr(constraint_record.conbin, constraint_record.conrelid)),
      '::[[:alnum:]_."]+',
      '',
      'g'
    ),
    '[[:space:]()]',
    '',
    'g'
  )
  into existing_definition
  from pg_constraint as constraint_record
  where constraint_record.conrelid = 'public.content_versions'::regclass
    and constraint_record.conname = 'content_versions_restore_receipt_all_or_none';

  if existing_definition is null then
    alter table public.content_versions
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
  elsif existing_definition <> expected_definition then
    raise exception
      'content_versions_restore_receipt_all_or_none has an incompatible definition';
  end if;
end;
$migration$;

do $migration$
declare
  index_record record;
begin
  select
    index_definition.indisunique,
    index_definition.indnkeyatts,
    index_definition.indnatts,
    attribute_record.attname,
    pg_get_expr(index_definition.indpred, index_definition.indrelid) as predicate,
    index_definition.indexprs is null as has_no_expressions,
    index_definition.indrelid = 'public.content_versions'::regclass as targets_content_versions
  into index_record
  from pg_class as index_class
  join pg_index as index_definition on index_definition.indexrelid = index_class.oid
  left join pg_attribute as attribute_record
    on attribute_record.attrelid = index_definition.indrelid
   and attribute_record.attnum = index_definition.indkey[0]
  where index_class.oid = to_regclass('public.content_versions_restore_receipt_idx');

  if not found then
    create unique index content_versions_restore_receipt_idx
      on public.content_versions (restore_operation_id)
      where restore_operation_id is not null;
  elsif not (
    index_record.targets_content_versions
    and index_record.indisunique
    and index_record.indnkeyatts = 1
    and index_record.indnatts = 1
    and index_record.attname = 'restore_operation_id'
    and index_record.predicate = '(restore_operation_id IS NOT NULL)'
    and index_record.has_no_expressions
  ) then
    raise exception
      'content_versions_restore_receipt_idx has an incompatible definition';
  end if;
end;
$migration$;

-- This is the canonical snapshot validator with the final Phase08
-- applicability rule: Lake Reflections may have a null growthStage; every
-- other region still requires a valid growth-stage enum label.
create or replace function private.restore_snapshot_is_valid(
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
    'id', 'slug', 'region', 'contentType', 'detailLevel', 'lifecycle',
    'contentLanguage'
  ] loop
    if not (projection ? field_name)
       or jsonb_typeof(projection -> field_name) <> 'string' then
      return false;
    end if;
  end loop;

  foreach field_name in array array[
    'titleZh', 'titleEn', 'summaryZh', 'summaryEn', 'bodyZhMarkdown',
    'bodyEnMarkdown'
  ] loop
    if not (projection ? field_name)
       or jsonb_typeof(projection -> field_name) not in ('string', 'null') then
      return false;
    end if;
  end loop;

  if not (projection ? 'growthStage')
     or not (projection ? 'primaryCategories')
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
     or projection ->> 'contentLanguage' not in ('zh', 'en', 'bilingual', 'mixed')
     or (
       p_current_region = 'Lake'
       and not (
         jsonb_typeof(projection -> 'growthStage') = 'null'
         or (
           jsonb_typeof(projection -> 'growthStage') = 'string'
           and projection ->> 'growthStage' in (
             'Seed', 'Sprout', 'Growing', 'Bloom', 'Dormant'
           )
         )
       )
     )
     or (
       p_current_region <> 'Lake'
       and (
         jsonb_typeof(projection -> 'growthStage') <> 'string'
         or projection ->> 'growthStage' not in (
           'Seed', 'Sprout', 'Growing', 'Bloom', 'Dormant'
         )
       )
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
       from jsonb_array_elements(projection -> 'primaryCategories') as category(value)
       where jsonb_typeof(category.value) <> 'string'
          or nullif(btrim(category.value #>> '{}'), '') is null
     )
     or exists (
       select 1
       from jsonb_array_elements_text(projection -> 'primaryCategories') as category(value)
       where (p_current_region = 'Garden' and category.value not in (
                'Psychology', 'AI', 'Coding', 'Design & Making'
              ))
          or (p_current_region = 'Forest' and category.value not in (
                'Mind & Behavior', 'Humans & AI', 'Design & Experience',
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
       or tag.value ->> 'normalizedName' <> lower(btrim(tag.value ->> 'normalizedName'))
       or not (tag.value ? 'displayName')
       or jsonb_typeof(tag.value -> 'displayName') <> 'string'
       or nullif(btrim(tag.value ->> 'displayName'), '') is null
  )
  or (
    select count(*) <> count(distinct lower(btrim(tag.value ->> 'displayName')))
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
       or cover ->> 'path' !~ ('^contents/' || p_content_id::text || '/[^/]+$')
       or (source_language = 'zh' and nullif(btrim(coalesce(cover ->> 'altZh', '')), '') is null)
       or (source_language = 'en' and nullif(btrim(coalesce(cover ->> 'altEn', '')), '') is null)
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

revoke all on function private.restore_snapshot_is_valid(
  uuid,
  text,
  public.garden_region,
  jsonb
) from public, anon, authenticated;

create or replace function public.restore_version_to_draft(
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

  select candidate.* into content
  from public.contents as candidate
  where candidate.id = p_content_id
  for update;

  if not found then
    raise no_data_found using message = 'content_not_found';
  end if;

  select checkpoint.* into receipt_checkpoint
  from public.content_versions as checkpoint
  where checkpoint.restore_operation_id = p_operation_id;

  if found then
    if receipt_checkpoint.content_id <> p_content_id
       or receipt_checkpoint.restore_source_version_id <> p_source_version_id
       or receipt_checkpoint.restore_archived_token is distinct from p_expected_archived_token then
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

  select revision.* into active_revision
  from public.content_revisions as revision
  where revision.content_id = p_content_id
  for update;
  if found then
    raise object_not_in_prerequisite_state using message = 'active_editorial_workspace';
  end if;

  select version.* into source_version
  from public.content_versions as version
  where version.id = p_source_version_id
  for key share;
  if not found
     or source_version.content_id <> p_content_id
     or source_version.checkpoint_reason not in ('Published', 'Archived') then
    raise invalid_parameter_value using message = 'restore_version_invalid';
  end if;
  if (source_version.checkpoint_reason = 'Published'
      and (not (source_version.snapshot ? 'publication')
        or jsonb_typeof(source_version.snapshot -> 'publication') <> 'object'))
     or (source_version.checkpoint_reason = 'Archived'
      and (not (source_version.snapshot ? 'archive')
        or jsonb_typeof(source_version.snapshot -> 'archive') <> 'object'))
     or not private.restore_snapshot_is_valid(
       p_content_id, content.slug, content.region, source_version.snapshot
     ) then
    raise invalid_parameter_value using message = 'restore_snapshot_invalid';
  end if;

  source_projection := source_version.snapshot -> 'projection';
  source_cover := source_projection -> 'cover';
  select coalesce(array_agg(category.value order by category.ordinality), '{}')
  into source_categories
  from jsonb_array_elements_text(source_projection -> 'primaryCategories')
    with ordinality as category(value, ordinality);
  select coalesce(array_agg(tag.value ->> 'displayName' order by tag.ordinality), '{}')
  into source_tags
  from jsonb_array_elements(source_version.snapshot -> 'tags')
    with ordinality as tag(value, ordinality);

  perform note.id from public.growth_notes as note
  where note.content_id = p_content_id for update;
  perform relation.id from public.content_relations as relation
  where relation.source_content_id = p_content_id
     or relation.target_content_id = p_content_id for update;
  perform binding.tag_id from public.content_tags as binding
  where binding.content_id = p_content_id for update;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', tag.id, 'normalizedName', tag.normalized_name,
    'displayName', tag.display_name
  ) order by tag.normalized_name, tag.id), '[]'::jsonb)
  into tags_snapshot
  from public.content_tags as binding
  join public.tags as tag on tag.id = binding.tag_id
  where binding.content_id = p_content_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', relation.id, 'sourceContentId', relation.source_content_id,
    'targetContentId', relation.target_content_id, 'relationType', relation.relation_type,
    'noteZh', relation.note_zh, 'noteEn', relation.note_en,
    'createdAt', relation.created_at
  ) order by relation.created_at, relation.id), '[]'::jsonb)
  into relations_snapshot
  from public.content_relations as relation
  where relation.source_content_id = p_content_id
     or relation.target_content_id = p_content_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', note.id, 'contentId', note.content_id, 'fromStage', note.from_stage,
    'toStage', note.to_stage, 'noteZh', note.note_zh, 'noteEn', note.note_en,
    'occurredAt', note.occurred_at, 'isPublic', note.is_public,
    'createdAt', note.created_at
  ) order by note.occurred_at, note.id), '[]'::jsonb)
  into growth_notes_snapshot
  from public.growth_notes as note
  where note.content_id = p_content_id;

  current_cover_snapshot := case when content.cover_image_path is null then null
    else jsonb_build_object('path', content.cover_image_path,
      'altZh', content.cover_image_alt_zh, 'altEn', content.cover_image_alt_en)
  end;
  current_projection_snapshot := jsonb_build_object(
    'id', content.id, 'legacyId', content.legacy_id, 'slug', content.slug,
    'region', content.region, 'contentType', content.content_type,
    'detailLevel', content.detail_level, 'lifecycle', content.lifecycle,
    'growthStage', content.growth_stage, 'titleZh', content.title_zh,
    'titleEn', content.title_en, 'summaryZh', content.summary_zh,
    'summaryEn', content.summary_en, 'bodyZhMarkdown', content.body_zh_markdown,
    'bodyEnMarkdown', content.body_en_markdown, 'contentLanguage', content.content_language,
    'primaryCategories', to_jsonb(content.primary_categories), 'cover', current_cover_snapshot,
    'featured', content.featured, 'manualOrder', content.manual_order,
    'createdAt', content.created_at, 'updatedAt', content.updated_at,
    'publishedAt', content.published_at, 'archivedAt', content.archived_at,
    'lastTendedAt', content.last_tended_at, 'createdBy', content.created_by,
    'updatedBy', content.updated_by, 'archivedBy', content.archived_by
  );

  begin
    insert into public.content_versions (
      id, content_id, snapshot, checkpoint_reason, checkpoint_note, created_at,
      created_by, restore_operation_id, restore_source_version_id,
      restore_revision_id, restore_archived_token
    ) values (
      pre_restore_version_id, p_content_id,
      jsonb_build_object(
        'projection', current_projection_snapshot, 'tags', tags_snapshot,
        'relations', relations_snapshot, 'growthNotes', growth_notes_snapshot,
        'cover', current_cover_snapshot, 'restore', jsonb_build_object(
          'operationId', p_operation_id, 'sourceVersionId', p_source_version_id,
          'revisionId', restored_revision_id,
          'expectedArchivedToken', p_expected_archived_token, 'lockVersion', 1,
          'restoredAt', restore_time, 'restoredBy', actor_id
        )
      ),
      'PreRestore', null, restore_time, actor_id, p_operation_id,
      p_source_version_id, restored_revision_id, p_expected_archived_token
    ) returning * into receipt_checkpoint;
  exception when unique_violation then
    raise serialization_failure using message = 'restore_operation_conflict';
  end;

  insert into public.content_revisions (
    id, content_id, lifecycle, slug, region, content_type, detail_level,
    growth_stage, title_zh, title_en, summary_zh, summary_en, body_zh_markdown,
    body_en_markdown, content_language, primary_categories, tags, cover_image_path,
    cover_image_alt_zh, cover_image_alt_en, featured, manual_order,
    source_version_id, base_content_updated_at, created_by, updated_by
  ) values (
    restored_revision_id, p_content_id, 'Draft', content.slug, content.region,
    (source_projection ->> 'contentType')::public.content_type,
    (source_projection ->> 'detailLevel')::public.detail_level,
    case when source_projection ->> 'growthStage' is null then null
      else (source_projection ->> 'growthStage')::public.growth_stage end,
    source_projection ->> 'titleZh', source_projection ->> 'titleEn',
    source_projection ->> 'summaryZh', source_projection ->> 'summaryEn',
    source_projection ->> 'bodyZhMarkdown', source_projection ->> 'bodyEnMarkdown',
    (source_projection ->> 'contentLanguage')::public.content_language,
    source_categories, source_tags,
    case when jsonb_typeof(source_cover) = 'object' then source_cover ->> 'path' else null end,
    case when jsonb_typeof(source_cover) = 'object' then source_cover ->> 'altZh' else null end,
    case when jsonb_typeof(source_cover) = 'object' then source_cover ->> 'altEn' else null end,
    false, null, p_source_version_id, content.updated_at, actor_id, actor_id
  ) returning * into restored_revision;

  return jsonb_build_object(
    'contentId', receipt_checkpoint.content_id,
    'sourceVersionId', receipt_checkpoint.restore_source_version_id,
    'revisionId', restored_revision.id,
    'operationId', receipt_checkpoint.restore_operation_id,
    'preRestoreVersionId', receipt_checkpoint.id,
    'lockVersion', restored_revision.lock_version,
    'restoredAt', receipt_checkpoint.created_at,
    'restoredBy', receipt_checkpoint.created_by
  );
end;
$$;

revoke all on function public.restore_version_to_draft(uuid, uuid, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.restore_version_to_draft(uuid, uuid, timestamptz, uuid)
  to authenticated;

commit;
