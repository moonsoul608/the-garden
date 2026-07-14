begin;

-- Garden Keeper authorization is deliberately prepared before Auth is
-- configured. The table remains empty in Phase 02D, so every authenticated
-- user is denied administrative access until Phase 04A binds the approved
-- GitHub identity.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

alter default privileges in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;

create table private.garden_keeper_identities (
  user_id uuid primary key,
  provider text not null default 'github',
  provider_user_id text not null,
  username text,
  created_at timestamptz not null default now(),
  constraint garden_keeper_identities_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint garden_keeper_identities_provider_github check (
    provider = 'github'
  ),
  constraint garden_keeper_identities_provider_user_id_not_blank check (
    provider_user_id = btrim(provider_user_id)
    and provider_user_id <> ''
  ),
  constraint garden_keeper_identities_username_not_blank check (
    username is null
    or (username = btrim(username) and username <> '')
  ),
  constraint garden_keeper_identities_provider_identity_key
    unique (provider, provider_user_id)
);

comment on table private.garden_keeper_identities is
  'Server-managed allow-list for the single Garden Keeper; intentionally empty until Phase 04A GitHub Auth setup.';
comment on column private.garden_keeper_identities.provider_user_id is
  'Immutable GitHub provider account ID; username is retained only as a readable secondary check.';

revoke all on table private.garden_keeper_identities
  from public, anon, authenticated;

create function private.is_garden_keeper()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select exists (
    select 1
    from private.garden_keeper_identities as keeper
    where keeper.user_id = auth.uid()
      and keeper.provider = 'github'
  );
$$;

comment on function private.is_garden_keeper() is
  'Returns true only when the current Supabase Auth user is present in the private Garden Keeper allow-list.';

revoke all on function private.is_garden_keeper()
  from public, anon, authenticated;
grant execute on function private.is_garden_keeper()
  to anon, authenticated;

-- Remove Supabase's broad API-role defaults before granting only the access
-- required by the public read model and future authenticated Garden Keeper.
revoke all on table
  public.contents,
  public.content_versions,
  public.growth_notes,
  public.content_relations,
  public.tags,
  public.content_tags,
  public.home_curation,
  public.site_copy,
  public.ai_settings,
  public.visitor_notes,
  public.analytics_daily,
  public.route_redirects,
  public.preview_tokens
from public, anon, authenticated;

-- Public content reads use an explicit column allow-list so actor UUIDs and
-- migration-only identity are not exposed from otherwise Published rows.
grant select (
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
  created_at,
  updated_at,
  published_at,
  archived_at,
  last_tended_at
) on table public.contents to anon, authenticated;

grant select on table
  public.growth_notes,
  public.content_relations,
  public.tags,
  public.content_tags,
  public.home_curation
to anon, authenticated;

grant select (
  copy_key,
  locale,
  copy_group,
  copy_value,
  updated_at
) on table public.site_copy to anon, authenticated;

-- Admin-only tables are queryable by the authenticated database role, but
-- their RLS policies return rows only for a future allow-listed Keeper.
grant select on table
  public.content_versions,
  public.ai_settings,
  public.visitor_notes,
  public.analytics_daily,
  public.route_redirects,
  public.preview_tokens
to authenticated;

-- Prepare administrative writes. With an empty allow-list these grants alone
-- confer no access because every write also has a Garden Keeper RLS policy.
grant insert, update, delete on table
  public.contents,
  public.content_versions,
  public.growth_notes,
  public.content_relations,
  public.tags,
  public.content_tags,
  public.home_curation,
  public.site_copy,
  public.ai_settings,
  public.visitor_notes,
  public.analytics_daily,
  public.route_redirects,
  public.preview_tokens
to authenticated;

alter table public.contents enable row level security;
alter table public.content_versions enable row level security;
alter table public.growth_notes enable row level security;
alter table public.content_relations enable row level security;
alter table public.tags enable row level security;
alter table public.content_tags enable row level security;
alter table public.home_curation enable row level security;
alter table public.site_copy enable row level security;
alter table public.ai_settings enable row level security;
alter table public.visitor_notes enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.route_redirects enable row level security;
alter table public.preview_tokens enable row level security;

-- Visitor-facing rows. Authenticated users who are not the Garden Keeper keep
-- the same Published-content access as anonymous visitors.
create policy contents_public_read_published
on public.contents
for select
to anon, authenticated
using (lifecycle = 'Published');

create policy growth_notes_public_read_published
on public.growth_notes
for select
to anon, authenticated
using (
  is_public
  and exists (
    select 1
    from public.contents as content
    where content.id = growth_notes.content_id
      and content.lifecycle = 'Published'
  )
);

create policy content_relations_public_read_published
on public.content_relations
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.contents as source_content
    where source_content.id = content_relations.source_content_id
      and source_content.lifecycle = 'Published'
  )
  and exists (
    select 1
    from public.contents as target_content
    where target_content.id = content_relations.target_content_id
      and target_content.lifecycle = 'Published'
  )
);

create policy tags_public_read_published
on public.tags
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.content_tags as binding
    join public.contents as content on content.id = binding.content_id
    where binding.tag_id = tags.id
      and content.lifecycle = 'Published'
  )
);

create policy content_tags_public_read_published
on public.content_tags
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.contents as content
    where content.id = content_tags.content_id
      and content.lifecycle = 'Published'
  )
);

create policy home_curation_public_read_published
on public.home_curation
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.contents as content
    where content.id = home_curation.content_id
      and content.lifecycle = 'Published'
  )
);

create policy site_copy_public_read
on public.site_copy
for select
to anon, authenticated
using (true);

-- Future Garden Keeper access. These policies are deny-by-default while the
-- private allow-list is empty.
create policy contents_garden_keeper_all
on public.contents
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy content_versions_garden_keeper_all
on public.content_versions
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy growth_notes_garden_keeper_all
on public.growth_notes
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy content_relations_garden_keeper_all
on public.content_relations
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy tags_garden_keeper_all
on public.tags
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy content_tags_garden_keeper_all
on public.content_tags
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy home_curation_garden_keeper_all
on public.home_curation
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy site_copy_garden_keeper_all
on public.site_copy
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy ai_settings_garden_keeper_all
on public.ai_settings
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy visitor_notes_garden_keeper_all
on public.visitor_notes
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy analytics_daily_garden_keeper_all
on public.analytics_daily
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy route_redirects_garden_keeper_all
on public.route_redirects
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

create policy preview_tokens_garden_keeper_all
on public.preview_tokens
for all
to authenticated
using ((select private.is_garden_keeper()))
with check ((select private.is_garden_keeper()));

commit;
