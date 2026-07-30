begin;

-- Keep Admin draft saves on the same narrow database boundary as the other
-- editorial mutations. The RPC owns lifecycle and optimistic-lock checks while
-- the audit trigger continues to derive actor, timestamps, and lock_version.
create or replace function public.update_content_draft(
  p_content_id uuid,
  p_revision_id uuid,
  p_expected_lock_version bigint,
  p_draft jsonb
)
returns public.content_revisions
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  revision public.content_revisions;
begin
  if not private.is_garden_keeper() then
    raise insufficient_privilege using message = 'garden_keeper_required';
  end if;

  if p_expected_lock_version is null or p_expected_lock_version < 1 then
    raise invalid_parameter_value using message = 'invalid_concurrency_token';
  end if;

  select *
  into revision
  from public.content_revisions
  where content_id = p_content_id
    and id = p_revision_id
  for update;

  if not found then
    raise no_data_found using message = 'revision_not_found';
  end if;

  if revision.lifecycle <> 'Draft' then
    raise invalid_parameter_value using message = 'invalid_revision_state';
  end if;

  if revision.lock_version <> p_expected_lock_version then
    raise serialization_failure using message = 'revision_conflict';
  end if;

  update public.content_revisions
  set
    slug = nullif(p_draft ->> 'slug', ''),
    region = (p_draft ->> 'region')::public.garden_region,
    content_type = (p_draft ->> 'contentType')::public.content_type,
    detail_level = (p_draft ->> 'detailLevel')::public.detail_level,
    growth_stage = (p_draft ->> 'growthStage')::public.growth_stage,
    title_zh = nullif(p_draft ->> 'titleZh', ''),
    title_en = nullif(p_draft ->> 'titleEn', ''),
    summary_zh = nullif(p_draft ->> 'summaryZh', ''),
    summary_en = nullif(p_draft ->> 'summaryEn', ''),
    body_zh_markdown = nullif(p_draft ->> 'bodyZhMarkdown', ''),
    body_en_markdown = nullif(p_draft ->> 'bodyEnMarkdown', ''),
    content_language = (p_draft ->> 'contentLanguage')::public.content_language,
    primary_categories = coalesce(
      array(select jsonb_array_elements_text(p_draft -> 'primaryCategories')),
      '{}'::text[]
    ),
    tags = coalesce(
      array(select jsonb_array_elements_text(p_draft -> 'tags')),
      '{}'::text[]
    ),
    cover_image_path = nullif(p_draft ->> 'coverImagePath', ''),
    cover_image_alt_zh = nullif(p_draft ->> 'coverImageAltZh', ''),
    cover_image_alt_en = nullif(p_draft ->> 'coverImageAltEn', ''),
    featured = coalesce((p_draft ->> 'featured')::boolean, false),
    manual_order = (p_draft ->> 'manualOrder')::integer
  where content_id = p_content_id
    and id = p_revision_id
    and lifecycle = 'Draft'
    and lock_version = p_expected_lock_version
  returning * into revision;

  if not found then
    raise serialization_failure using message = 'revision_conflict';
  end if;

  return revision;
end;
$$;

comment on function public.update_content_draft(uuid, uuid, bigint, jsonb) is
  'Updates one active Draft revision after Keeper authorization, lifecycle validation, and optimistic-lock verification.';

revoke all on function public.update_content_draft(uuid, uuid, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_content_draft(uuid, uuid, bigint, jsonb)
  to authenticated;

commit;
