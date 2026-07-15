begin;

-- Drafts cloned from an existing public/resting projection retain the exact
-- immutable checkpoint they came from. The timestamp remains the later
-- publication-conflict token; this UUID is provenance only.
alter table public.content_versions
  add constraint content_versions_id_content_id_key
  unique (id, content_id);

alter table public.content_revisions
  add column source_version_id uuid;

alter table public.content_revisions
  add constraint content_revisions_source_version_fkey
  foreign key (source_version_id, content_id)
  references public.content_versions (id, content_id)
  on delete restrict;

comment on column public.content_revisions.source_version_id is
  'Immutable checkpoint cloned by a Draft started from Published or Archived content; null for a newly created Draft or legacy projection without a checkpoint.';

-- Extend the existing audit guard so clients cannot replace revision
-- provenance while editing a Draft.
create or replace function public.set_content_revision_audit_fields()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if tg_op = 'INSERT' then
    new.created_at = statement_timestamp();
    new.created_by = actor_id;
    new.lock_version = 1;
  else
    new.id = old.id;
    new.content_id = old.content_id;
    new.source_version_id = old.source_version_id;
    new.base_content_updated_at = old.base_content_updated_at;
    new.created_at = old.created_at;
    new.created_by = old.created_by;
    new.lock_version = old.lock_version + 1;
  end if;

  new.updated_at = statement_timestamp();
  new.updated_by = actor_id;
  return new;
end;
$$;

-- Rebuild only the existing clone command. It still writes solely to the
-- mutable workspace and leaves contents/content_versions unchanged.
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

  if content.lifecycle not in ('Published', 'Archived') then
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
  'Starts a private Draft from a Published or Archived projection, retaining source-version provenance without modifying the projection or version history.';

commit;
