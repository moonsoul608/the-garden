begin;

create or replace function public.execute_v1_import(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  import_time timestamptz := statement_timestamp();
  existing_result jsonb;
  current_destination jsonb := '[]'::jsonb;
  content_item jsonb;
  tag_item jsonb;
  content_tag_item jsonb;
  relation_item jsonb;
  growth_note_item jsonb;
  content_row public.contents%rowtype;
  content_id uuid;
  tag_id uuid;
  relation_id uuid;
  growth_note_id uuid;
  version_id uuid;
  created_contents jsonb := '[]'::jsonb;
  created_versions jsonb := '[]'::jsonb;
  created_relations jsonb := '[]'::jsonb;
  created_growth_notes jsonb := '[]'::jsonb;
  created_tags jsonb := '[]'::jsonb;
  created_content_tags jsonb := '[]'::jsonb;
  tags_snapshot jsonb;
  relations_snapshot jsonb;
  growth_notes_snapshot jsonb;
  cover_snapshot jsonb;
  projection_snapshot jsonb;
  imported_content_count integer := 0;
  expected_content_count integer := 0;
  imported_version_count integer := 0;
  expected_relation_count integer := 0;
  imported_relation_count integer := 0;
  slug_unique boolean := false;
  slug_identity_valid boolean := false;
  regions_valid boolean := false;
  relation_integrity boolean := false;
  lifecycle_valid boolean := false;
  versions_valid boolean := false;
  verification_passed boolean := false;
  result jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise invalid_parameter_value using message = 'invalid_import_payload';
  end if;

  if p_payload->>'kind' is distinct from 'v1-import-execution'
     or p_payload->>'schemaVersion' is distinct from '1'
     or coalesce(
       p_payload->>'importDigest' ~ '^sha256:[a-f0-9]{64}$',
       false
     ) is not true
     or coalesce(
       p_payload->>'previewDigest' ~ '^sha256:[a-f0-9]{64}$',
       false
     ) is not true
     or coalesce(
       p_payload->>'resolutionDigest' ~ '^sha256:[a-f0-9]{64}$',
       false
     ) is not true
     or coalesce(
       p_payload->>'sourceDigest' ~ '^sha256:[a-f0-9]{64}$',
       false
     ) is not true
     or coalesce(
       p_payload->>'destinationStateDigest' ~ '^sha256:[a-f0-9]{64}$',
       false
     ) is not true
     or p_payload->'sourceVersion' is distinct from jsonb_build_object(
       'source', 'v1-static-typescript',
       'schemaVersion', 1
     ) then
    raise invalid_parameter_value using message = 'invalid_import_envelope';
  end if;

  if jsonb_typeof(p_payload->'expectedDestinationContents') is distinct from 'array'
     or jsonb_typeof(p_payload->'contents') is distinct from 'array'
     or jsonb_typeof(p_payload->'relations') is distinct from 'array'
     or jsonb_typeof(p_payload->'tags') is distinct from 'array'
     or jsonb_typeof(p_payload->'contentTags') is distinct from 'array'
     or jsonb_typeof(p_payload->'growthNotes') is distinct from 'array'
     or jsonb_typeof(p_payload->'warnings') is distinct from 'array' then
    raise invalid_parameter_value using message = 'invalid_import_collections';
  end if;

  -- One digest serializes here. The receipt check is deliberately before the
  -- stale-destination check so a completed import is safely replayable.
  perform pg_advisory_xact_lock(
    hashtextextended('public.execute_v1_import:' || (p_payload->>'importDigest'), 0)
  );

  select receipt.result
  into existing_result
  from public.v1_migration_imports as receipt
  where receipt.import_digest = p_payload->>'importDigest';

  if found then
    return existing_result || jsonb_build_object('idempotent', true);
  end if;

  expected_content_count := jsonb_array_length(p_payload->'contents');
  if expected_content_count <> 19 then
    raise check_violation using message = 'unexpected_content_count';
  end if;

  if (
    select count(*) <> count(distinct item->>'legacyId')
    from jsonb_array_elements(p_payload->'contents') as source(item)
  ) then
    raise unique_violation using message = 'duplicate_legacy_id';
  end if;

  if (
    select count(*) <> count(distinct concat_ws('/', item->>'region', item->>'slug'))
    from jsonb_array_elements(p_payload->'contents') as source(item)
  ) then
    raise unique_violation using message = 'duplicate_region_slug';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'contents') as source(item)
    where nullif(btrim(item->>'legacyId'), '') is null
       or nullif(btrim(item->>'slug'), '') is null
       or item->>'region' not in ('Garden', 'Forest', 'Lake', 'Ruins')
       or item->>'contentType' not in ('Seed', 'Question', 'Reflection', 'Trace')
       or item->>'detailLevel' not in ('full', 'short')
       or item->>'lifecycle' <> 'Published'
       or (
         item->>'growthStage' is null
         and not (
           item->>'region' = 'Lake'
           and item->>'contentType' = 'Reflection'
         )
       )
       or (
         item->>'growthStage' is not null
         and item->>'growthStage' not in ('Seed', 'Sprout', 'Growing', 'Bloom', 'Dormant')
       )
       or item->>'contentLanguage' not in ('zh', 'en', 'bilingual', 'mixed')
       or (
         nullif(btrim(item->>'titleZh'), '') is null
         and nullif(btrim(item->>'titleEn'), '') is null
       )
       or (
         nullif(btrim(item->>'summaryZh'), '') is null
         and nullif(btrim(item->>'summaryEn'), '') is null
       )
       or (
         nullif(btrim(item->>'bodyZhMarkdown'), '') is null
         and nullif(btrim(item->>'bodyEnMarkdown'), '') is null
       )
       or jsonb_typeof(item->'primaryCategories') is distinct from 'array'
       or jsonb_array_length(item->'primaryCategories') = 0
       or exists (
         select 1
         from jsonb_array_elements_text(item->'primaryCategories') as category(value)
         where nullif(btrim(category.value), '') is null
       )
       or (
         nullif(btrim(item->'cover'->>'path'), '') is not null
         and nullif(btrim(item->'cover'->>'altZh'), '') is null
         and nullif(btrim(item->'cover'->>'altEn'), '') is null
       )
  ) then
    raise check_violation using message = 'invalid_content_value';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'contents') as source(item)
    where item->>'legacyId' in (
      'reverse-1999',
      'jung-and-mandala',
      'the-garden',
      'love-love-love',
      'summer-ghost'
    )
      and not (
        item->>'region' = 'Lake'
        and item->>'contentType' = 'Reflection'
        and item->>'growthStage' is null
      )
      and (
        item->'growthStageResolution' is null
        or item->'growthStageResolution'->>'approvalStatus' <> 'Approved'
        or item->'growthStageResolution'->>'growthStage' <> item->>'growthStage'
        or nullif(btrim(item->'growthStageResolution'->>'resolutionSource'), '') is null
        or nullif(btrim(item->'growthStageResolution'->>'approvedBy'), '') is null
        or nullif(btrim(item->'growthStageResolution'->>'approvedAt'), '') is null
      )
  ) then
    raise check_violation using message = 'growth_stage_approval_required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'relations') as source(item)
    where item->>'relationType' not in ('grewInto')
       or item->>'sourceLegacyId' = item->>'targetLegacyId'
       or not exists (
         select 1
         from jsonb_array_elements(p_payload->'contents') as candidate(content)
         where candidate.content->>'legacyId' = source.item->>'sourceLegacyId'
       )
       or not exists (
         select 1
         from jsonb_array_elements(p_payload->'contents') as candidate(content)
         where candidate.content->>'legacyId' = source.item->>'targetLegacyId'
       )
  ) then
    raise foreign_key_violation using message = 'missing_relation_target';
  end if;

  if (
    select count(*) <> count(distinct concat_ws(
      ':',
      item->>'sourceLegacyId',
      item->>'targetLegacyId',
      item->>'relationType'
    ))
    from jsonb_array_elements(p_payload->'relations') as source(item)
  ) then
    raise unique_violation using message = 'duplicate_relation';
  end if;

  if (
    select count(*) <> count(distinct item->>'normalizedName')
    from jsonb_array_elements(p_payload->'tags') as source(item)
  ) then
    raise unique_violation using message = 'duplicate_tag';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'tags') as source(item)
    where nullif(btrim(item->>'normalizedName'), '') is null
       or item->>'normalizedName' <> lower(btrim(item->>'normalizedName'))
       or nullif(btrim(item->>'displayName'), '') is null
  ) then
    raise check_violation using message = 'invalid_tag';
  end if;

  if (
    select count(*) <> count(distinct concat_ws(
      ':',
      item->>'contentLegacyId',
      item->>'tagNormalizedName'
    ))
    from jsonb_array_elements(p_payload->'contentTags') as source(item)
  ) then
    raise unique_violation using message = 'duplicate_content_tag';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'contentTags') as source(item)
    where not exists (
      select 1
      from jsonb_array_elements(p_payload->'contents') as candidate(content)
      where candidate.content->>'legacyId' = source.item->>'contentLegacyId'
    )
    or not exists (
      select 1
      from jsonb_array_elements(p_payload->'tags') as candidate(tag)
      where candidate.tag->>'normalizedName' = source.item->>'tagNormalizedName'
    )
  ) then
    raise foreign_key_violation using message = 'invalid_content_tag_target';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload->'growthNotes') as source(item)
    where not exists (
      select 1
      from jsonb_array_elements(p_payload->'contents') as candidate(content)
      where candidate.content->>'legacyId' = source.item->>'contentLegacyId'
    )
      or item->>'toStage' not in ('Seed', 'Sprout', 'Growing', 'Bloom', 'Dormant')
      or (
        item->>'fromStage' is not null
        and item->>'fromStage' not in ('Seed', 'Sprout', 'Growing', 'Bloom', 'Dormant')
      )
      or (
        nullif(btrim(item->>'noteZh'), '') is null
        and nullif(btrim(item->>'noteEn'), '') is null
      )
      or nullif(item->>'occurredAt', '') is null
  ) then
    raise check_violation using message = 'invalid_growth_note';
  end if;

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
      )
      order by destination.id
    ),
    '[]'::jsonb
  )
  into current_destination
  from public.contents as destination;

  if current_destination is distinct from p_payload->'expectedDestinationContents' then
    raise serialization_failure using message = 'destination_state_changed';
  end if;

  if exists (
    select 1
    from public.contents as destination
    join jsonb_array_elements(p_payload->'contents') as source(item)
      on destination.legacy_id = source.item->>'legacyId'
      or (
        destination.region::text = source.item->>'region'
        and destination.slug = source.item->>'slug'
      )
  ) then
    raise unique_violation using message = 'existing_migration_identity_without_receipt';
  end if;

  if exists (
    select 1
    from public.tags as destination
    join jsonb_array_elements(p_payload->'tags') as source(item)
      on destination.normalized_name = source.item->>'normalizedName'
  ) then
    raise unique_violation using message = 'existing_tag_identity_without_receipt';
  end if;

  for content_item in
    select source.item
    from jsonb_array_elements(p_payload->'contents') with ordinality as source(item, position)
    order by source.position
  loop
    content_id := gen_random_uuid();
    insert into public.contents (
      id,
      legacy_id,
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
      published_at,
      archived_at,
      last_tended_at
    ) values (
      content_id,
      content_item->>'legacyId',
      content_item->>'slug',
      (content_item->>'region')::public.garden_region,
      (content_item->>'contentType')::public.content_type,
      (content_item->>'detailLevel')::public.detail_level,
      (content_item->>'lifecycle')::public.content_lifecycle,
      (content_item->>'growthStage')::public.growth_stage,
      content_item->>'titleZh',
      content_item->>'titleEn',
      content_item->>'summaryZh',
      content_item->>'summaryEn',
      content_item->>'bodyZhMarkdown',
      content_item->>'bodyEnMarkdown',
      (content_item->>'contentLanguage')::public.content_language,
      coalesce(
        array(
          select jsonb_array_elements_text(content_item->'primaryCategories')
        ),
        '{}'::text[]
      ),
      content_item->'cover'->>'path',
      content_item->'cover'->>'altZh',
      content_item->'cover'->>'altEn',
      coalesce((content_item->>'featured')::boolean, false),
      (content_item->>'manualOrder')::integer,
      (content_item->>'publishedAt')::timestamptz,
      (content_item->>'archivedAt')::timestamptz,
      (content_item->>'lastTendedAt')::timestamptz
    );
    created_contents := created_contents || jsonb_build_array(content_item->>'legacyId');
  end loop;

  for tag_item in
    select source.item
    from jsonb_array_elements(p_payload->'tags') with ordinality as source(item, position)
    order by source.position
  loop
    insert into public.tags (normalized_name, display_name)
    values (tag_item->>'normalizedName', tag_item->>'displayName')
    returning id into tag_id;
    created_tags := created_tags || jsonb_build_array(tag_item->>'normalizedName');
  end loop;

  for content_tag_item in
    select source.item
    from jsonb_array_elements(p_payload->'contentTags') with ordinality as source(item, position)
    order by source.position
  loop
    insert into public.content_tags (content_id, tag_id)
    select content.id, tag.id
    from public.contents as content
    cross join public.tags as tag
    where content.legacy_id = content_tag_item->>'contentLegacyId'
      and tag.normalized_name = content_tag_item->>'tagNormalizedName';
    if not found then
      raise foreign_key_violation using message = 'invalid_content_tag_target';
    end if;
    created_content_tags := created_content_tags || jsonb_build_array(
      concat_ws(
        ':',
        content_tag_item->>'contentLegacyId',
        content_tag_item->>'tagNormalizedName'
      )
    );
  end loop;

  for relation_item in
    select source.item
    from jsonb_array_elements(p_payload->'relations') with ordinality as source(item, position)
    order by source.position
  loop
    relation_id := gen_random_uuid();
    insert into public.content_relations (
      id,
      source_content_id,
      target_content_id,
      relation_type,
      note_zh,
      note_en
    )
    select
      relation_id,
      source_content.id,
      target_content.id,
      (relation_item->>'relationType')::public.relation_type,
      relation_item->>'noteZh',
      relation_item->>'noteEn'
    from public.contents as source_content
    cross join public.contents as target_content
    where source_content.legacy_id = relation_item->>'sourceLegacyId'
      and target_content.legacy_id = relation_item->>'targetLegacyId';
    if not found then
      raise foreign_key_violation using message = 'missing_relation_target';
    end if;
    created_relations := created_relations || jsonb_build_array(
      concat_ws(
        ':',
        relation_item->>'sourceLegacyId',
        relation_item->>'targetLegacyId',
        relation_item->>'relationType'
      )
    );
  end loop;

  for growth_note_item in
    select source.item
    from jsonb_array_elements(p_payload->'growthNotes') with ordinality as source(item, position)
    order by source.position
  loop
    growth_note_id := gen_random_uuid();
    insert into public.growth_notes (
      id,
      content_id,
      from_stage,
      to_stage,
      note_zh,
      note_en,
      occurred_at,
      is_public
    )
    select
      growth_note_id,
      content.id,
      (growth_note_item->>'fromStage')::public.growth_stage,
      (growth_note_item->>'toStage')::public.growth_stage,
      growth_note_item->>'noteZh',
      growth_note_item->>'noteEn',
      (growth_note_item->>'occurredAt')::timestamptz,
      coalesce((growth_note_item->>'isPublic')::boolean, false)
    from public.contents as content
    where content.legacy_id = growth_note_item->>'contentLegacyId';
    if not found then
      raise foreign_key_violation using message = 'invalid_growth_note_target';
    end if;
    created_growth_notes := created_growth_notes || jsonb_build_array(growth_note_id::text);
  end loop;

  for content_item in
    select source.item
    from jsonb_array_elements(p_payload->'contents') with ordinality as source(item, position)
    order by source.position
  loop
    select destination.*
    into content_row
    from public.contents as destination
    where destination.legacy_id = content_item->>'legacyId';

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'normalizedName', tag.normalized_name,
          'displayName', tag.display_name
        )
        order by tag.normalized_name
      ),
      '[]'::jsonb
    )
    into tags_snapshot
    from public.content_tags as link
    join public.tags as tag on tag.id = link.tag_id
    where link.content_id = content_row.id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'sourceContentId', relation.source_content_id,
          'targetContentId', relation.target_content_id,
          'relationType', relation.relation_type,
          'noteZh', relation.note_zh,
          'noteEn', relation.note_en
        )
        order by relation.id
      ),
      '[]'::jsonb
    )
    into relations_snapshot
    from public.content_relations as relation
    where relation.source_content_id = content_row.id
       or relation.target_content_id = content_row.id;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'fromStage', note.from_stage,
          'toStage', note.to_stage,
          'noteZh', note.note_zh,
          'noteEn', note.note_en,
          'occurredAt', note.occurred_at,
          'isPublic', note.is_public
        )
        order by note.occurred_at, note.id
      ),
      '[]'::jsonb
    )
    into growth_notes_snapshot
    from public.growth_notes as note
    where note.content_id = content_row.id;

    cover_snapshot := case
      when content_row.cover_image_path is null then null
      else jsonb_build_object(
        'path', content_row.cover_image_path,
        'altZh', content_row.cover_image_alt_zh,
        'altEn', content_row.cover_image_alt_en
      )
    end;

    projection_snapshot := jsonb_build_object(
      'id', content_row.id,
      'legacyId', content_row.legacy_id,
      'slug', content_row.slug,
      'region', content_row.region,
      'contentType', content_row.content_type,
      'detailLevel', content_row.detail_level,
      'lifecycle', content_row.lifecycle,
      'growthStage', content_row.growth_stage,
      'titleZh', content_row.title_zh,
      'titleEn', content_row.title_en,
      'summaryZh', content_row.summary_zh,
      'summaryEn', content_row.summary_en,
      'bodyZhMarkdown', content_row.body_zh_markdown,
      'bodyEnMarkdown', content_row.body_en_markdown,
      'contentLanguage', content_row.content_language,
      'primaryCategories', to_jsonb(content_row.primary_categories),
      'cover', cover_snapshot,
      'featured', content_row.featured,
      'manualOrder', content_row.manual_order,
      'createdAt', content_row.created_at,
      'updatedAt', content_row.updated_at,
      'publishedAt', content_row.published_at,
      'archivedAt', content_row.archived_at,
      'lastTendedAt', content_row.last_tended_at,
      'createdBy', content_row.created_by,
      'updatedBy', content_row.updated_by
    );

    version_id := gen_random_uuid();
    insert into public.content_versions (
      id,
      content_id,
      snapshot,
      checkpoint_reason,
      checkpoint_note,
      created_at,
      created_by
    ) values (
      version_id,
      content_row.id,
      jsonb_build_object(
        'projection', projection_snapshot,
        'tags', tags_snapshot,
        'relations', relations_snapshot,
        'growthNotes', growth_notes_snapshot,
        'cover', cover_snapshot,
        'migration', jsonb_build_object(
          'source', 'v1-static-typescript',
          'sourceVersion', 1,
          'legacyId', content_row.legacy_id,
          'importDigest', p_payload->>'importDigest',
          'sourceDigest', p_payload->>'sourceDigest',
          'growthStageResolution', content_item->'growthStageResolution'
        )
      ),
      'V1 import',
      'Initial immutable V1 migration checkpoint.',
      import_time,
      null
    );
    created_versions := created_versions || jsonb_build_array(version_id::text);
  end loop;

  select count(*)
  into imported_content_count
  from public.contents as destination
  where destination.legacy_id in (
    select source.item->>'legacyId'
    from jsonb_array_elements(p_payload->'contents') as source(item)
  );

  select not exists (
    select destination.region, destination.slug
    from public.contents as destination
    where destination.slug is not null
    group by destination.region, destination.slug
    having count(*) > 1
  ) into slug_unique;

  select not exists (
    select 1
    from jsonb_array_elements(p_payload->'contents') as source(item)
    left join public.contents as destination
      on destination.legacy_id = source.item->>'legacyId'
    where destination.id is null
       or destination.slug is distinct from source.item->>'slug'
  ) into slug_identity_valid;

  select not exists (
    select 1
    from jsonb_array_elements(p_payload->'contents') as source(item)
    left join public.contents as destination
      on destination.legacy_id = source.item->>'legacyId'
    where destination.id is null
       or destination.region::text is distinct from source.item->>'region'
  ) into regions_valid;

  expected_relation_count := jsonb_array_length(p_payload->'relations');
  select count(*)
  into imported_relation_count
  from jsonb_array_elements(p_payload->'relations') as source(item)
  join public.contents as source_content
    on source_content.legacy_id = source.item->>'sourceLegacyId'
  join public.contents as target_content
    on target_content.legacy_id = source.item->>'targetLegacyId'
  join public.content_relations as relation
    on relation.source_content_id = source_content.id
   and relation.target_content_id = target_content.id
   and relation.relation_type::text = source.item->>'relationType';
  relation_integrity := imported_relation_count = expected_relation_count;

  select not exists (
    select 1
    from public.contents as destination
    where destination.legacy_id in (
      select source.item->>'legacyId'
      from jsonb_array_elements(p_payload->'contents') as source(item)
    )
      and destination.lifecycle <> 'Published'
  ) into lifecycle_valid;

  select count(*)
  into imported_version_count
  from public.content_versions as version
  join public.contents as destination on destination.id = version.content_id
  where destination.legacy_id in (
    select source.item->>'legacyId'
    from jsonb_array_elements(p_payload->'contents') as source(item)
  )
    and version.checkpoint_reason = 'V1 import'
    and version.snapshot->'migration'->>'importDigest' = p_payload->>'importDigest';

  select not exists (
    select 1
    from jsonb_array_elements(p_payload->'contents') as source(item)
    left join public.contents as destination
      on destination.legacy_id = source.item->>'legacyId'
    left join public.content_versions as version
      on version.content_id = destination.id
     and version.checkpoint_reason = 'V1 import'
     and version.snapshot->'migration'->>'importDigest' = p_payload->>'importDigest'
    group by source.item->>'legacyId'
    having count(version.id) <> 1
  ) into versions_valid;

  verification_passed :=
    imported_content_count = expected_content_count
    and imported_version_count = expected_content_count
    and slug_unique
    and slug_identity_valid
    and regions_valid
    and relation_integrity
    and lifecycle_valid
    and versions_valid;

  if not verification_passed then
    raise check_violation using message = 'post_import_verification_failed';
  end if;

  result := jsonb_build_object(
    'schemaVersion', 1,
    'kind', 'v1-import-result',
    'status', 'SUCCESS',
    'snapshotDigest', p_payload->>'importDigest',
    'importDigest', p_payload->>'importDigest',
    'previewDigest', p_payload->>'previewDigest',
    'resolutionDigest', p_payload->>'resolutionDigest',
    'importedAt', import_time,
    'importedCount', imported_content_count,
    'sourceVersion', p_payload->'sourceVersion',
    'idempotent', false,
    'created', jsonb_build_object(
      'contents', created_contents,
      'versions', created_versions,
      'relations', created_relations,
      'growthNotes', created_growth_notes,
      'tags', created_tags,
      'contentTags', created_content_tags
    ),
    'skippedRecords', '[]'::jsonb,
    'warnings', p_payload->'warnings',
    'verification', jsonb_build_object(
      'contentCount', imported_content_count,
      'expectedContentCount', expected_content_count,
      'slugUnique', slug_unique,
      'slugIdentityValid', slug_identity_valid,
      'regionsValid', regions_valid,
      'relationIntegrity', relation_integrity,
      'lifecycleValid', lifecycle_valid,
      'versionsValid', versions_valid,
      'passed', verification_passed
    )
  );

  insert into public.v1_migration_imports (
    import_digest,
    source_digest,
    destination_state_digest,
    source_version,
    result,
    imported_at
  ) values (
    p_payload->>'importDigest',
    p_payload->>'sourceDigest',
    p_payload->>'destinationStateDigest',
    p_payload->'sourceVersion',
    result,
    import_time
  );

  return result;
end;
$$;

comment on function public.execute_v1_import(jsonb) is
  'Service-role-only, digest-approved, atomic and idempotent V1 import with immutable initial versions and post-write verification.';

revoke all on function public.execute_v1_import(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.execute_v1_import(jsonb) to service_role;

commit;
