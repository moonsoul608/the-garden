begin;

-- pg_trgm provides non-vector substring indexes for the bilingual title and
-- summary search fields required by Garden Index.
create extension if not exists pg_trgm with schema extensions;

-- Supabase installs managed extensions in `extensions`; including `public`
-- also keeps the opclass resolvable if an existing Preview project installed
-- pg_trgm there before this migration.
set local search_path = public, extensions;

create type public.garden_region as enum (
  'Garden',
  'Forest',
  'Lake',
  'Ruins'
);

create type public.content_type as enum (
  'Seed',
  'Question',
  'Reflection',
  'Trace'
);

create type public.detail_level as enum (
  'full',
  'short'
);

create type public.content_lifecycle as enum (
  'Draft',
  'Review',
  'Published',
  'Archived'
);

create type public.growth_stage as enum (
  'Seed',
  'Sprout',
  'Growing',
  'Bloom',
  'Dormant'
);

create type public.content_language as enum (
  'zh',
  'en',
  'bilingual',
  'mixed'
);

create type public.relation_type as enum (
  'grewFrom',
  'grewInto',
  'relatedTo'
);

create type public.home_slot as enum (
  'currentlyGrowing',
  'recentlyPlanted'
);

create type public.analytics_event_type as enum (
  'page_view',
  'region_view',
  'content_view',
  'greenhouse_use',
  'note_submit',
  'share_click'
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  slug text,
  region public.garden_region not null,
  content_type public.content_type not null,
  detail_level public.detail_level not null,
  lifecycle public.content_lifecycle not null default 'Draft',
  growth_stage public.growth_stage not null,
  title_zh text,
  title_en text,
  summary_zh text,
  summary_en text,
  body_zh_markdown text,
  body_en_markdown text,
  content_language public.content_language not null,
  primary_categories text[] not null default '{}'::text[],
  cover_image_path text,
  cover_image_alt_zh text,
  cover_image_alt_en text,
  featured boolean not null default false,
  manual_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  last_tended_at timestamptz,
  created_by uuid,
  updated_by uuid,
  constraint contents_region_slug_key unique (region, slug),
  constraint contents_legacy_id_not_blank check (
    legacy_id is null
    or (legacy_id = btrim(legacy_id) and legacy_id <> '')
  ),
  constraint contents_slug_not_blank check (
    slug is null
    or (
      slug = btrim(slug)
      and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    )
  ),
  constraint contents_slug_required_after_draft check (
    lifecycle = 'Draft'
    or slug is not null
  ),
  constraint contents_title_present check (
    num_nonnulls(
      nullif(btrim(title_zh), ''),
      nullif(btrim(title_en), '')
    ) >= 1
  ),
  constraint contents_primary_categories_no_nulls check (
    array_position(primary_categories, null) is null
  ),
  constraint contents_cover_path_not_blank check (
    cover_image_path is null
    or (cover_image_path = btrim(cover_image_path) and cover_image_path <> '')
  ),
  constraint contents_cover_alt_not_blank check (
    (cover_image_alt_zh is null or btrim(cover_image_alt_zh) <> '')
    and (cover_image_alt_en is null or btrim(cover_image_alt_en) <> '')
  ),
  constraint contents_cover_alt_requires_path check (
    cover_image_path is not null
    or (cover_image_alt_zh is null and cover_image_alt_en is null)
  ),
  constraint contents_cover_alt_after_draft check (
    cover_image_path is null
    or lifecycle = 'Draft'
    or num_nonnulls(
      nullif(btrim(cover_image_alt_zh), ''),
      nullif(btrim(cover_image_alt_en), '')
    ) >= 1
  ),
  constraint contents_manual_order_nonnegative check (
    manual_order is null
    or manual_order >= 0
  )
);

comment on column public.contents.legacy_id is
  'Stable V1 source identifier used by the later idempotent import.';
comment on column public.contents.created_by is
  'Nullable Supabase Auth user UUID; no auth foreign key is added in Phase 02A.';
comment on column public.contents.updated_by is
  'Nullable Supabase Auth user UUID; no auth foreign key is added in Phase 02A.';

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  snapshot jsonb not null,
  checkpoint_reason text not null,
  checkpoint_note text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint content_versions_content_id_fkey
    foreign key (content_id)
    references public.contents (id)
    on delete cascade,
  constraint content_versions_snapshot_object check (
    jsonb_typeof(snapshot) = 'object'
  ),
  constraint content_versions_checkpoint_reason_not_blank check (
    btrim(checkpoint_reason) <> ''
  ),
  constraint content_versions_checkpoint_note_not_blank check (
    checkpoint_note is null
    or btrim(checkpoint_note) <> ''
  )
);

create table public.growth_notes (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  from_stage public.growth_stage,
  to_stage public.growth_stage not null,
  note_zh text,
  note_en text,
  occurred_at timestamptz not null default now(),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  constraint growth_notes_content_id_fkey
    foreign key (content_id)
    references public.contents (id)
    on delete cascade,
  constraint growth_notes_note_present check (
    num_nonnulls(
      nullif(btrim(note_zh), ''),
      nullif(btrim(note_en), '')
    ) >= 1
  )
);

create table public.content_relations (
  id uuid primary key default gen_random_uuid(),
  source_content_id uuid not null,
  target_content_id uuid not null,
  relation_type public.relation_type not null,
  note_zh text,
  note_en text,
  created_at timestamptz not null default now(),
  constraint content_relations_source_content_id_fkey
    foreign key (source_content_id)
    references public.contents (id)
    on delete restrict,
  constraint content_relations_target_content_id_fkey
    foreign key (target_content_id)
    references public.contents (id)
    on delete restrict,
  constraint content_relations_not_self check (
    source_content_id <> target_content_id
  ),
  constraint content_relations_source_target_type_key unique (
    source_content_id,
    target_content_id,
    relation_type
  ),
  constraint content_relations_note_not_blank check (
    (note_zh is null or btrim(note_zh) <> '')
    and (note_en is null or btrim(note_en) <> '')
  )
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null unique,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint tags_normalized_name_format check (
    normalized_name = lower(btrim(normalized_name))
    and normalized_name <> ''
  ),
  constraint tags_display_name_not_blank check (
    btrim(display_name) <> ''
  )
);

create table public.content_tags (
  content_id uuid not null,
  tag_id uuid not null,
  primary key (content_id, tag_id),
  constraint content_tags_content_id_fkey
    foreign key (content_id)
    references public.contents (id)
    on delete cascade,
  constraint content_tags_tag_id_fkey
    foreign key (tag_id)
    references public.tags (id)
    on delete cascade
);

create table public.home_curation (
  content_id uuid primary key,
  slot public.home_slot not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_curation_content_id_fkey
    foreign key (content_id)
    references public.contents (id)
    on delete cascade,
  constraint home_curation_sort_order_nonnegative check (
    sort_order >= 0
  ),
  constraint home_curation_slot_order_key
    unique (slot, sort_order)
    deferrable initially immediate
);

create table public.site_copy (
  copy_key text not null,
  locale text not null,
  copy_group text not null,
  copy_value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (copy_key, locale),
  constraint site_copy_locale_allowed check (
    locale in ('zh', 'en')
  ),
  constraint site_copy_value_not_blank check (
    btrim(copy_value) <> ''
  ),
  constraint site_copy_approved_key check (
    copy_key in (
      'home.welcome_body',
      'home.about_body',
      'home.currently_growing_description',
      'home.recently_planted_description',
      'home.closing_copy',
      'region.garden.introduction',
      'region.garden.ending',
      'region.forest.introduction',
      'region.forest.ending',
      'region.lake.introduction',
      'region.lake.ending',
      'region.ruins.introduction',
      'region.ruins.ending',
      'region.greenhouse.introduction',
      'region.greenhouse.ending',
      'footer.explanatory_line',
      'footer.leave_note_invitation'
    )
  ),
  constraint site_copy_key_group_match check (
    (
      copy_group = 'home'
      and copy_key in (
        'home.welcome_body',
        'home.about_body',
        'home.currently_growing_description',
        'home.recently_planted_description',
        'home.closing_copy'
      )
    )
    or (
      copy_group = 'regions'
      and copy_key in (
        'region.garden.introduction',
        'region.garden.ending',
        'region.forest.introduction',
        'region.forest.ending',
        'region.lake.introduction',
        'region.lake.ending',
        'region.ruins.introduction',
        'region.ruins.ending',
        'region.greenhouse.introduction',
        'region.greenhouse.ending'
      )
    )
    or (
      copy_group = 'footer'
      and copy_key in (
        'footer.explanatory_line',
        'footer.leave_note_invitation'
      )
    )
  )
);

comment on table public.site_copy is
  'Only the fixed-copy slots approved by V2_CONTENT are allowed; no content is seeded here.';

create table public.ai_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint ai_settings_approved_key check (
    setting_key in (
      'system_instruction',
      'tone_guidance',
      'structured_output_guidance',
      'example_input',
      'example_output',
      'recommendation_wording'
    )
  ),
  constraint ai_settings_value_not_blank check (
    btrim(setting_value) <> ''
  )
);

comment on table public.ai_settings is
  'Approved prompt content only; provider, model, URL, timeout, secrets, and security controls remain code-owned.';

create table public.visitor_notes (
  id uuid primary key default gen_random_uuid(),
  name text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint visitor_notes_name_not_blank check (
    name is null
    or btrim(name) <> ''
  ),
  constraint visitor_notes_message_not_blank check (
    btrim(message) <> ''
  )
);

create table public.analytics_daily (
  event_type public.analytics_event_type not null,
  event_date date not null default ((current_timestamp at time zone 'UTC')::date),
  event_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_type, event_date),
  constraint analytics_daily_event_count_nonnegative check (
    event_count >= 0
  )
);

comment on table public.analytics_daily is
  'UTC daily aggregate counts only; no visitor identity, IP address, path trail, session, or cross-site identifier.';

create table public.route_redirects (
  id uuid primary key default gen_random_uuid(),
  old_path text not null unique,
  new_path text,
  status_code smallint not null default 308,
  content_id uuid,
  created_at timestamptz not null default now(),
  constraint route_redirects_content_id_fkey
    foreign key (content_id)
    references public.contents (id)
    on delete set null,
  constraint route_redirects_old_path_format check (
    old_path = btrim(old_path)
    and old_path <> ''
    and left(old_path, 1) = '/'
    and left(old_path, 2) <> '//'
    and position('?' in old_path) = 0
    and position('#' in old_path) = 0
  ),
  constraint route_redirects_new_path_format check (
    new_path is null
    or (
      new_path = btrim(new_path)
      and new_path <> ''
      and left(new_path, 1) = '/'
      and left(new_path, 2) <> '//'
      and position('?' in new_path) = 0
      and position('#' in new_path) = 0
    )
  ),
  constraint route_redirects_destination_differs check (
    new_path is null
    or new_path <> old_path
  ),
  constraint route_redirects_status_and_destination check (
    (status_code in (301, 308) and new_path is not null)
    or (status_code = 410 and new_path is null)
  )
);

comment on column public.route_redirects.new_path is
  'Required for 301/308 redirects; null only for a 410 Gone path tombstone.';

create table public.preview_tokens (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint preview_tokens_content_id_fkey
    foreign key (content_id)
    references public.contents (id)
    on delete cascade,
  constraint preview_tokens_hash_not_blank check (
    token_hash = btrim(token_hash)
    and length(token_hash) >= 32
  ),
  constraint preview_tokens_expiry_after_creation check (
    expires_at > created_at
  ),
  constraint preview_tokens_revocation_after_creation check (
    revoked_at is null
    or revoked_at >= created_at
  )
);

create index contents_region_lifecycle_idx
  on public.contents (region, lifecycle);
create index contents_lifecycle_idx
  on public.contents (lifecycle);
create index contents_growth_stage_idx
  on public.contents (growth_stage);
create index contents_last_tended_at_idx
  on public.contents (last_tended_at desc)
  where last_tended_at is not null;
create index contents_published_at_idx
  on public.contents (published_at desc)
  where published_at is not null;
create index contents_featured_idx
  on public.contents (region, lifecycle, manual_order, last_tended_at desc)
  where featured;
create index contents_bilingual_search_trgm_idx
  on public.contents
  using gin ((
    coalesce(title_zh, '') || ' ' ||
    coalesce(title_en, '') || ' ' ||
    coalesce(summary_zh, '') || ' ' ||
    coalesce(summary_en, '')
  ) gin_trgm_ops);
create index contents_primary_categories_idx
  on public.contents
  using gin (primary_categories);

create index content_versions_content_created_idx
  on public.content_versions (content_id, created_at desc);

create index growth_notes_content_occurred_idx
  on public.growth_notes (content_id, occurred_at desc);

create index content_relations_target_idx
  on public.content_relations (target_content_id);

create index content_tags_tag_id_idx
  on public.content_tags (tag_id);

create index site_copy_group_locale_idx
  on public.site_copy (copy_group, locale);

create index visitor_notes_read_created_idx
  on public.visitor_notes (is_read, created_at desc);

create index route_redirects_content_id_idx
  on public.route_redirects (content_id)
  where content_id is not null;

create index preview_tokens_content_expiry_idx
  on public.preview_tokens (content_id, expires_at desc);

create trigger contents_set_updated_at
before update on public.contents
for each row execute function public.set_updated_at();

create trigger home_curation_set_updated_at
before update on public.home_curation
for each row execute function public.set_updated_at();

create trigger site_copy_set_updated_at
before update on public.site_copy
for each row execute function public.set_updated_at();

create trigger ai_settings_set_updated_at
before update on public.ai_settings
for each row execute function public.set_updated_at();

create trigger analytics_daily_set_updated_at
before update on public.analytics_daily
for each row execute function public.set_updated_at();

commit;
