begin;

-- Narrow forward-only Phase 04D repair: restore only the durable publication
-- receipt fields and the authenticated atomic publication command.
alter table public.content_versions
  add column if not exists source_revision_id uuid,
  add column if not exists source_lock_version bigint;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'content_versions_source_pair'
      and conrelid = 'public.content_versions'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'content_versions_source_pair'
        and conrelid = 'public.content_versions'::regclass
        and contype = 'c'
        and regexp_replace(
          lower(pg_get_constraintdef(oid)),
          '[\\s()]',
          '',
          'g'
        ) = 'checksource_revision_idisnullandsource_lock_versionisnullorsource_revision_idisnotnullandsource_lock_versionisnotnull'
    ) then
      raise exception 'phase_04d_repair_constraint_contract_mismatch: content_versions_source_pair';
    end if;
  else
    alter table public.content_versions
      add constraint content_versions_source_pair check (
        (source_revision_id is null and source_lock_version is null)
        or (source_revision_id is not null and source_lock_version is not null)
      );
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'content_versions_source_lock_positive'
      and conrelid = 'public.content_versions'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'content_versions_source_lock_positive'
        and conrelid = 'public.content_versions'::regclass
        and contype = 'c'
        and regexp_replace(
          lower(pg_get_constraintdef(oid)),
          '[\\s()]',
          '',
          'g'
        ) = 'checksource_lock_versionisnullorsource_lock_version>0'
    ) then
      raise exception 'phase_04d_repair_constraint_contract_mismatch: content_versions_source_lock_positive';
    end if;
  else
    alter table public.content_versions
      add constraint content_versions_source_lock_positive check (
        source_lock_version is null or source_lock_version > 0
      );
  end if;
end;
$$;

-- The RPC's durable retry receipt requires one checkpoint per consumed Review.
create unique index if not exists content_versions_publication_receipt_idx
  on public.content_versions (source_revision_id)
  where source_revision_id is not null;

create or replace function public.publish_review_revision(
  p_content_id uuid,
  p_revision_id uuid,
  p_expected_lock_version bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  publication_time timestamptz := statement_timestamp();
  content public.contents%rowtype;
  revision public.content_revisions%rowtype;
  publication_version public.content_versions%rowtype;
  version_id uuid := gen_random_uuid();
  tags_snapshot jsonb := '[]'::jsonb;
  relations_snapshot jsonb := '[]'::jsonb;
  growth_notes_snapshot jsonb := '[]'::jsonb;
  cover_object_id uuid;
  cover_snapshot jsonb;
  projection_snapshot jsonb;
  publication_snapshot jsonb;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if not private.is_garden_keeper() then
    raise insufficient_privilege using message = 'garden_keeper_required';
  end if;

  if p_expected_lock_version is null or p_expected_lock_version <= 0 then
    raise invalid_parameter_value using message = 'invalid_concurrency_token';
  end if;

  if p_content_id is null then
    raise no_data_found using message = 'content_not_found';
  end if;

  if p_revision_id is null then
    raise no_data_found using message = 'revision_not_found';
  end if;

  -- Every publication attempt for one stable content identity serializes here.
  select candidate.*
  into content
  from public.contents as candidate
  where candidate.id = p_content_id
  for update;

  if not found then
    raise no_data_found using message = 'content_not_found';
  end if;

  -- A consumed Review is absent by design. Only an exact durable receipt may
  -- turn that absence into success; mismatched content or lock tokens conflict.
  select checkpoint.*
  into publication_version
  from public.content_versions as checkpoint
  where checkpoint.source_revision_id = p_revision_id;

  if found then
    if publication_version.content_id <> p_content_id
       or publication_version.source_lock_version <> p_expected_lock_version then
      raise serialization_failure using message = 'revision_conflict';
    end if;

    return jsonb_build_object(
      'contentId', publication_version.content_id,
      'revisionId', publication_version.source_revision_id,
      'versionId', publication_version.id,
      'sourceLockVersion', publication_version.source_lock_version,
      'publishedAt', publication_version.created_at,
      'publishedBy', publication_version.created_by
    );
  end if;

  -- content_id is unique on the workspace table, so this locks whichever
  -- active revision exists and lets a wrong revision ID become a conflict.
  select candidate.*
  into revision
  from public.content_revisions as candidate
  where candidate.content_id = p_content_id
  for update;

  if not found then
    if exists (
      select 1
      from public.content_revisions as other_revision
      where other_revision.id = p_revision_id
        and other_revision.content_id <> p_content_id
    ) then
      raise serialization_failure using message = 'revision_conflict';
    end if;

    if exists (
      select 1
      from public.content_versions as checkpoint
      where checkpoint.content_id = p_content_id
        and checkpoint.source_revision_id is not null
    ) then
      raise serialization_failure using message = 'revision_conflict';
    end if;

    raise no_data_found using message = 'revision_not_found';
  end if;

  if revision.id <> p_revision_id
     or revision.lock_version <> p_expected_lock_version then
    raise serialization_failure using message = 'revision_conflict';
  end if;

  if revision.lifecycle <> 'Review'
     or revision.review_submitted_at is null
     or revision.review_submitted_by is null then
    raise invalid_parameter_value using message = 'invalid_revision_state';
  end if;

  if content.lifecycle not in ('Draft', 'Published') then
    raise invalid_parameter_value using message = 'invalid_content_state';
  end if;

  if content.lifecycle = 'Draft' then
    if content.published_at is not null
       or content.archived_at is not null
       or revision.base_content_updated_at is not null
       or revision.source_version_id is not null then
      raise invalid_parameter_value using message = 'invalid_content_state';
    end if;
  else
    if content.archived_at is not null then
      raise invalid_parameter_value using message = 'invalid_content_state';
    end if;

    if revision.base_content_updated_at is null
       or revision.base_content_updated_at is distinct from content.updated_at then
      raise serialization_failure using message = 'revision_conflict';
    end if;

    if revision.slug is distinct from content.slug then
      raise invalid_parameter_value using message = 'immutable_slug';
    end if;

    if revision.region is distinct from content.region then
      raise invalid_parameter_value using message = 'immutable_region';
    end if;
  end if;

  if revision.slug is null
     or btrim(revision.slug) = ''
     or revision.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or num_nonnulls(
       nullif(btrim(revision.title_zh), ''),
       nullif(btrim(revision.title_en), '')
     ) = 0
     or num_nonnulls(
       nullif(btrim(revision.summary_zh), ''),
       nullif(btrim(revision.summary_en), '')
     ) = 0
     or num_nonnulls(
       nullif(btrim(revision.body_zh_markdown), ''),
       nullif(btrim(revision.body_en_markdown), '')
     ) = 0
     or cardinality(revision.primary_categories) = 0 then
    raise invalid_parameter_value using message = 'publication_validation_failed';
  end if;

  if not (
    (
      revision.region = 'Garden'
      and revision.content_type = 'Seed'
      and revision.primary_categories <@ array[
        'Psychology', 'AI', 'Coding', 'Design & Making'
      ]::text[]
    )
    or (
      revision.region = 'Forest'
      and revision.content_type = 'Question'
      and revision.primary_categories <@ array[
        'Mind & Behavior', 'Humans & AI', 'Design & Experience',
        'Stories & Memory'
      ]::text[]
    )
    or (
      revision.region = 'Lake'
      and revision.content_type = 'Reflection'
      and revision.primary_categories <@ array[
        'Music', 'Games', 'Films', 'Books & Words', 'Internet'
      ]::text[]
    )
    or (
      revision.region = 'Ruins'
      and revision.content_type = 'Trace'
      and revision.primary_categories <@ array[
        'Drafts', 'Attempts', 'Mistakes'
      ]::text[]
    )
  ) then
    raise invalid_parameter_value using message = 'publication_validation_failed';
  end if;

  if exists (
    select 1
    from unnest(revision.tags) as proposed_tag(display_name)
    where btrim(proposed_tag.display_name) = ''
  )
  or exists (
    select 1
    from unnest(revision.tags) as proposed_tag(display_name)
    group by lower(btrim(proposed_tag.display_name))
    having count(*) > 1
  ) then
    raise invalid_parameter_value using message = 'publication_validation_failed';
  end if;

  -- The unique constraint remains the race-safe fallback after this readable
  -- validation failure.
  if exists (
    select 1
    from public.contents as conflict
    where conflict.region = revision.region
      and conflict.slug = revision.slug
      and conflict.id <> p_content_id
  ) then
    raise unique_violation using message = 'slug_conflict';
  end if;

  -- Existing normalized associations are part of the same publication view.
  -- Row locks keep their validated values stable through snapshot creation.
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

  if content.lifecycle = 'Published'
     and revision.growth_stage is not null
     and revision.growth_stage is distinct from content.growth_stage
     and not exists (
       select 1
       from public.growth_notes as note
       where note.content_id = p_content_id
         and note.from_stage = content.growth_stage
         and note.to_stage = revision.growth_stage
         and num_nonnulls(
           nullif(btrim(note.note_zh), ''),
           nullif(btrim(note.note_en), '')
         ) >= 1
     ) then
    raise invalid_parameter_value using message = 'publication_validation_failed';
  end if;

  if exists (
    select 1
    from public.content_relations as relation
    left join public.contents as source_content
      on source_content.id = relation.source_content_id
    left join public.contents as target_content
      on target_content.id = relation.target_content_id
    where (
      relation.source_content_id = p_content_id
      or relation.target_content_id = p_content_id
    )
      and (
        source_content.id is null
        or target_content.id is null
        or relation.source_content_id = relation.target_content_id
        or (relation.note_zh is not null and btrim(relation.note_zh) = '')
        or (relation.note_en is not null and btrim(relation.note_en) = '')
      )
  )
  or exists (
    select 1
    from public.content_relations as relation
    where relation.source_content_id = p_content_id
       or relation.target_content_id = p_content_id
    group by
      relation.source_content_id,
      relation.target_content_id,
      relation.relation_type
    having count(*) > 1
  ) then
    raise invalid_parameter_value using message = 'publication_validation_failed';
  end if;

  if revision.cover_image_path is not null then
    if revision.cover_image_path !~ '^contents/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
       or split_part(revision.cover_image_path, '/', 2) <> p_content_id::text
       or (
         revision.content_language = 'zh'
         and nullif(btrim(revision.cover_image_alt_zh), '') is null
       )
       or (
         revision.content_language = 'en'
         and nullif(btrim(revision.cover_image_alt_en), '') is null
       )
       or (
         revision.content_language in ('bilingual', 'mixed')
         and num_nonnulls(
           nullif(btrim(revision.cover_image_alt_zh), ''),
           nullif(btrim(revision.cover_image_alt_en), '')
         ) = 0
       ) then
      raise invalid_parameter_value using message = 'publication_validation_failed';
    end if;

    select object.id
    into cover_object_id
    from storage.objects as object
    where object.bucket_id = 'cover-images'
      and object.name = revision.cover_image_path
    for key share;

    if not found then
      raise invalid_parameter_value using message = 'publication_validation_failed';
    end if;
  elsif revision.cover_image_alt_zh is not null
     or revision.cover_image_alt_en is not null then
    raise invalid_parameter_value using message = 'publication_validation_failed';
  end if;

  begin
    update public.contents as projection
    set
      slug = revision.slug,
      region = revision.region,
      content_type = revision.content_type,
      detail_level = revision.detail_level,
      lifecycle = 'Published',
      growth_stage = revision.growth_stage,
      title_zh = revision.title_zh,
      title_en = revision.title_en,
      summary_zh = revision.summary_zh,
      summary_en = revision.summary_en,
      body_zh_markdown = revision.body_zh_markdown,
      body_en_markdown = revision.body_en_markdown,
      content_language = revision.content_language,
      primary_categories = revision.primary_categories,
      cover_image_path = revision.cover_image_path,
      cover_image_alt_zh = revision.cover_image_alt_zh,
      cover_image_alt_en = revision.cover_image_alt_en,
      featured = revision.featured,
      manual_order = revision.manual_order,
      published_at = case
        when projection.lifecycle = 'Draft' then publication_time
        else projection.published_at
      end,
      updated_at = publication_time,
      updated_by = actor_id
    where projection.id = p_content_id
    returning projection.* into content;
  exception
    when unique_violation then
      raise unique_violation using message = 'slug_conflict';
  end;

  insert into public.tags (normalized_name, display_name)
  select
    lower(btrim(proposed_tag.display_name)),
    btrim(proposed_tag.display_name)
  from unnest(revision.tags) as proposed_tag(display_name)
  on conflict (normalized_name) do nothing;

  delete from public.content_tags as binding
  where binding.content_id = p_content_id;

  insert into public.content_tags (content_id, tag_id)
  select p_content_id, tag.id
  from unnest(revision.tags) as proposed_tag(display_name)
  join public.tags as tag
    on tag.normalized_name = lower(btrim(proposed_tag.display_name));

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
    'updatedBy', content.updated_by
  );

  publication_snapshot := jsonb_build_object(
    'publishedAt', publication_time,
    'publishedBy', actor_id,
    'sourceRevisionId', revision.id,
    'sourceLockVersion', revision.lock_version
  );

  insert into public.content_versions (
    id,
    content_id,
    snapshot,
    checkpoint_reason,
    checkpoint_note,
    created_at,
    created_by,
    source_revision_id,
    source_lock_version
  ) values (
    version_id,
    p_content_id,
    jsonb_build_object(
      'projection', projection_snapshot,
      'tags', tags_snapshot,
      'relations', relations_snapshot,
      'growthNotes', growth_notes_snapshot,
      'cover', cover_snapshot,
      'publication', publication_snapshot
    ),
    'Published',
    null,
    publication_time,
    actor_id,
    revision.id,
    revision.lock_version
  )
  returning * into publication_version;

  delete from public.content_revisions as consumed
  where consumed.id = revision.id
    and consumed.content_id = p_content_id
    and consumed.lifecycle = 'Review'
    and consumed.lock_version = p_expected_lock_version;

  if not found then
    raise serialization_failure using message = 'revision_conflict';
  end if;

  return jsonb_build_object(
    'contentId', publication_version.content_id,
    'revisionId', publication_version.source_revision_id,
    'versionId', publication_version.id,
    'sourceLockVersion', publication_version.source_lock_version,
    'publishedAt', publication_version.created_at,
    'publishedBy', publication_version.created_by
  );
end;
$$;


comment on function public.publish_review_revision(uuid, uuid, bigint) is
  'Atomically promotes one validated Review, synchronizes public tags, creates one immutable checkpoint, consumes the Review, and returns a durable idempotent receipt.';

revoke all on function public.publish_review_revision(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.publish_review_revision(uuid, uuid, bigint)
  to authenticated;

commit;
