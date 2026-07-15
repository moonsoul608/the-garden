begin;

-- Mutable Draft/Review work is isolated from the stable content identity and
-- current Published projection. One active workspace revision is allowed per
-- content item; publication will consume it in a later phase.
create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  lifecycle public.content_lifecycle not null default 'Draft',
  slug text,
  region public.garden_region not null,
  content_type public.content_type not null,
  detail_level public.detail_level not null,
  growth_stage public.growth_stage not null,
  title_zh text,
  title_en text,
  summary_zh text,
  summary_en text,
  body_zh_markdown text,
  body_en_markdown text,
  content_language public.content_language not null,
  primary_categories text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  cover_image_path text,
  cover_image_alt_zh text,
  cover_image_alt_en text,
  featured boolean not null default false,
  manual_order integer,
  base_content_updated_at timestamptz,
  lock_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  updated_by uuid not null,
  constraint content_revisions_content_id_fkey
    foreign key (content_id)
    references public.contents (id)
    on delete cascade,
  constraint content_revisions_one_workspace_key unique (content_id),
  constraint content_revisions_workspace_lifecycle check (
    lifecycle in ('Draft', 'Review')
  ),
  constraint content_revisions_slug_not_blank check (
    slug is null
    or (
      slug = btrim(slug)
      and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  ),
  constraint content_revisions_title_present check (
    num_nonnulls(
      nullif(btrim(title_zh), ''),
      nullif(btrim(title_en), '')
    ) >= 1
  ),
  constraint content_revisions_primary_categories_no_nulls check (
    array_position(primary_categories, null) is null
  ),
  constraint content_revisions_tags_no_nulls check (
    array_position(tags, null) is null
  ),
  constraint content_revisions_cover_path_not_blank check (
    cover_image_path is null
    or (cover_image_path = btrim(cover_image_path) and cover_image_path <> '')
  ),
  constraint content_revisions_cover_alt_not_blank check (
    (cover_image_alt_zh is null or btrim(cover_image_alt_zh) <> '')
    and (cover_image_alt_en is null or btrim(cover_image_alt_en) <> '')
  ),
  constraint content_revisions_cover_alt_requires_path check (
    cover_image_path is not null
    or (cover_image_alt_zh is null and cover_image_alt_en is null)
  ),
  constraint content_revisions_cover_alt_in_review check (
    cover_image_path is null
    or lifecycle = 'Draft'
    or num_nonnulls(
      nullif(btrim(cover_image_alt_zh), ''),
      nullif(btrim(cover_image_alt_en), '')
    ) >= 1
  ),
  constraint content_revisions_manual_order_nonnegative check (
    manual_order is null
    or manual_order >= 0
  ),
  constraint content_revisions_lock_version_positive check (
    lock_version > 0
  )
);

comment on table public.content_revisions is
  'Mutable Draft/Review workspace; autosave updates this table and never content_versions.';
comment on column public.content_revisions.base_content_updated_at is
  'Published projection timestamp captured when a revision starts, for later promotion conflict checks.';
comment on column public.content_revisions.lock_version is
  'Server-managed optimistic concurrency token incremented on every update.';

create index content_revisions_lifecycle_updated_idx
  on public.content_revisions (lifecycle, updated_at desc);

-- Actor identity, timestamps, and optimistic concurrency metadata are always
-- derived by the database session and never accepted from mutation input.
create function public.set_content_revision_audit_fields()
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

revoke all on function public.set_content_revision_audit_fields()
  from public, anon, authenticated;

create trigger content_revisions_set_audit_fields
before insert or update on public.content_revisions
for each row execute function public.set_content_revision_audit_fields();

-- Draft identity and its first revision must be created atomically. The JSON
-- contract intentionally contains no actor or timestamp fields.
create function public.create_content_draft(p_draft jsonb)
returns public.content_revisions
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  content_id uuid;
  revision public.content_revisions;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  insert into public.contents (
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
    created_by,
    updated_by
  ) values (
    nullif(p_draft ->> 'slug', ''),
    (p_draft ->> 'region')::public.garden_region,
    (p_draft ->> 'contentType')::public.content_type,
    (p_draft ->> 'detailLevel')::public.detail_level,
    'Draft',
    (p_draft ->> 'growthStage')::public.growth_stage,
    nullif(p_draft ->> 'titleZh', ''),
    nullif(p_draft ->> 'titleEn', ''),
    nullif(p_draft ->> 'summaryZh', ''),
    nullif(p_draft ->> 'summaryEn', ''),
    nullif(p_draft ->> 'bodyZhMarkdown', ''),
    nullif(p_draft ->> 'bodyEnMarkdown', ''),
    (p_draft ->> 'contentLanguage')::public.content_language,
    array(
      select jsonb_array_elements_text(p_draft -> 'primaryCategories')
    ),
    nullif(p_draft ->> 'coverImagePath', ''),
    nullif(p_draft ->> 'coverImageAltZh', ''),
    nullif(p_draft ->> 'coverImageAltEn', ''),
    (p_draft ->> 'featured')::boolean,
    (p_draft ->> 'manualOrder')::integer,
    actor_id,
    actor_id
  )
  returning id into content_id;

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
    created_by,
    updated_by
  ) values (
    content_id,
    'Draft',
    nullif(p_draft ->> 'slug', ''),
    (p_draft ->> 'region')::public.garden_region,
    (p_draft ->> 'contentType')::public.content_type,
    (p_draft ->> 'detailLevel')::public.detail_level,
    (p_draft ->> 'growthStage')::public.growth_stage,
    nullif(p_draft ->> 'titleZh', ''),
    nullif(p_draft ->> 'titleEn', ''),
    nullif(p_draft ->> 'summaryZh', ''),
    nullif(p_draft ->> 'summaryEn', ''),
    nullif(p_draft ->> 'bodyZhMarkdown', ''),
    nullif(p_draft ->> 'bodyEnMarkdown', ''),
    (p_draft ->> 'contentLanguage')::public.content_language,
    array(
      select jsonb_array_elements_text(p_draft -> 'primaryCategories')
    ),
    array(
      select jsonb_array_elements_text(p_draft -> 'tags')
    ),
    nullif(p_draft ->> 'coverImagePath', ''),
    nullif(p_draft ->> 'coverImageAltZh', ''),
    nullif(p_draft ->> 'coverImageAltEn', ''),
    (p_draft ->> 'featured')::boolean,
    (p_draft ->> 'manualOrder')::integer,
    actor_id,
    actor_id
  )
  returning * into revision;

  return revision;
end;
$$;

comment on function public.create_content_draft(jsonb) is
  'Atomically creates a stable content identity and its initial private Draft revision.';

revoke all on function public.create_content_draft(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_content_draft(jsonb)
  to authenticated;

-- A new revision of Published or Archived content starts from the current
-- stable projection. It does not edit or hide that projection.
create function public.start_content_draft_revision(p_content_id uuid)
returns public.content_revisions
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  content record;
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
    content.updated_at,
    actor_id,
    actor_id
  )
  returning * into revision;

  return revision;
end;
$$;

comment on function public.start_content_draft_revision(uuid) is
  'Starts a private Draft from a Published or Archived projection without modifying the projection.';

revoke all on function public.start_content_draft_revision(uuid)
  from public, anon, authenticated;
grant execute on function public.start_content_draft_revision(uuid)
  to authenticated;

revoke all on table public.content_revisions
  from public, anon, authenticated;
grant select, insert, update, delete on table public.content_revisions
  to authenticated;

alter table public.content_revisions enable row level security;

create policy content_revisions_garden_keeper_all
on public.content_revisions
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

-- Publication checkpoints are append-only. Deleting an Archived content item
-- can still remove its versions through the existing cascading foreign key.
revoke update, delete on table public.content_versions from authenticated;

commit;
