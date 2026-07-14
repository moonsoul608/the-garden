# The Garden V2 Phase 02A Report

Task: `02A Core Database Schema`  
Report date: `2026-07-14`  
Repository: `D:\the-garden\the-garden-codex-docs\the-garden-codex-docs`

This report covers only the first Version 2 core database schema. The versioned migration was executed successfully through Supabase Dashboard SQL Editor against the intended non-Production Supabase project; Production was not modified. It does not implement RLS, Storage, authentication, content import, Garden Keeper, Supabase client changes, or public-page changes.

# 1. Schema Overview

The migration creates 9 PostgreSQL enum types, 13 core tables, one generic `updated_at` function, five technical timestamp triggers, and the required indexes. It is wrapped in one transaction and contains no seed data, personal content, or credentials.

| Table | Responsibility |
| --- | --- |
| `contents` | Canonical records for Garden, Forest, Lake, and Ruins content. |
| `content_versions` | Important JSONB content snapshots for checkpoint, publish, and restore workflows. |
| `growth_notes` | Bilingual Growth Stage notes and the source records for a future public Growth Timeline. |
| `content_relations` | Manual `grewFrom`, `grewInto`, and `relatedTo` links between existing content records. |
| `tags` | Stable, normalized free-tag records. |
| `content_tags` | Many-to-many bindings between content and tags. |
| `home_curation` | Canonical content references and ordering for Currently Growing and Recently Planted. |
| `site_copy` | Approved fixed-copy slots only. |
| `ai_settings` | Approved Greenhouse prompt-content settings only. |
| `visitor_notes` | Private visitor messages with read/unread state. |
| `analytics_daily` | UTC daily aggregate counts for the six approved anonymous analytics events. |
| `route_redirects` | Permanent path migrations and 410 Gone path tombstones. |
| `preview_tokens` | Hashed, expiring, revocable Draft/Review preview-token records. |

The migration enables `pg_trgm` for non-vector bilingual title/summary substring indexing. It does not add full-body, semantic, or vector search.

# 2. Table Details

## 2.1 `contents`

- Primary key: `id uuid`, generated with `gen_random_uuid()`.
- Migration identity: nullable, unique `legacy_id text` preserves the V1 source ID without making it the relational key.
- Route and classification fields: `slug`, `region`, `content_type`, `detail_level`, `lifecycle`, and `growth_stage`.
- Content fields: bilingual title, summary, and Markdown body fields plus `content_language`.
- Taxonomy: `primary_categories text[]`; free tags are normalized through `tags` and `content_tags` instead of duplicated in `contents`.
- Cover metadata: one storage path and Chinese/English alt fields. A non-Draft item with a cover must have at least one nonblank alt field.
- Presentation fields: `featured` and nullable, nonnegative `manual_order`.
- Timestamps: `created_at`, `updated_at`, nullable `published_at`, nullable `archived_at`, and nullable `last_tended_at`.
- Actor fields: nullable `created_by` and `updated_by` UUID values. Phase 02A deliberately does not add an `auth.users` foreign key.
- Unique constraints: `legacy_id` and `(region, slug)`. Multiple Draft rows may have a null slug; all non-Draft rows require a slug.
- Checks: a present slug must be lowercase kebab-case; at least one title is required; category arrays cannot contain null elements; cover path/alt consistency and manual-order bounds are enforced.
- Delete behavior: `contents` is the root record. Versions, Growth Notes, tag bindings, Home curation, and preview tokens cascade on permanent deletion; relations restrict deletion until explicitly cleaned up; redirect records retain the old path and set `content_id` to null.

`published_at`, `archived_at`, and `last_tended_at` remain nullable because the 19 V1 items do not have reliable historical dates. The later importer must not substitute Git, filesystem, or import timestamps for unknown content dates.

## 2.2 `content_versions`

- Primary key: generated UUID.
- Key fields: `content_id`, `snapshot jsonb`, required `checkpoint_reason`, optional `checkpoint_note`, `created_at`, and nullable `created_by`.
- Foreign key: `content_id -> contents.id ON DELETE CASCADE`.
- Checks: the snapshot must be a JSON object; checkpoint reason and any provided note must be nonblank.
- Index: `(content_id, created_at DESC)` supports recent-version listing.
- The table supports a latest-ten policy, but no automatic trimming trigger is implemented in this phase.

## 2.3 `growth_notes`

- Primary key: generated UUID.
- Key fields: `content_id`, nullable `from_stage`, required `to_stage`, `note_zh`, `note_en`, `occurred_at`, `is_public`, and `created_at`.
- Foreign key: `content_id -> contents.id ON DELETE CASCADE`.
- Checks: both stage fields use the fixed Growth Stage enum; at least one trimmed bilingual note must be present.
- Index: `(content_id, occurred_at DESC)` supports timeline and admin-history reads.
- The atomic rule that a content-stage update must create a Growth Note remains a later service-layer transaction; no cross-table business trigger was added.

## 2.4 `content_relations`

- Primary key: generated UUID.
- Key fields: source content, target content, relation type, optional bilingual note, and `created_at`.
- Foreign keys: both source and target reference `contents.id` with `ON DELETE RESTRICT`.
- Unique constraint: `(source_content_id, target_content_id, relation_type)` prevents identical duplicates.
- Checks: source and target must differ; provided note fields cannot be blank.
- Delete behavior: archive is only a lifecycle update and preserves relations. Permanent deletion is blocked until the later deletion workflow displays impact and explicitly removes affected relations.
- There is no external-URL column, so this table cannot represent an external relation.

## 2.5 `tags`

- Primary key: generated UUID.
- Key fields: unique `normalized_name`, `display_name`, and `created_at`.
- Checks: normalized names must be lowercase, trimmed, and nonblank; display names must be nonblank.
- Delete behavior: deleting a tag cascades only its `content_tags` bindings.

## 2.6 `content_tags`

- Primary key: `(content_id, tag_id)`, which also prevents duplicate bindings.
- Foreign keys: `content_id -> contents.id ON DELETE CASCADE` and `tag_id -> tags.id ON DELETE CASCADE`.
- Indexes: the primary key covers content-to-tag reads; a separate `tag_id` index supports tag-to-content reads.

## 2.7 `home_curation`

- Primary key and foreign key: `content_id -> contents.id ON DELETE CASCADE`.
- Key fields: `slot`, nonnegative `sort_order`, `created_at`, and `updated_at`.
- Because `content_id` is the table primary key, one content record cannot appear in both slots simultaneously.
- Unique constraint: `(slot, sort_order)` is deferrable, allowing a transaction to defer the constraint while swapping positions.
- The later write service must upsert by `content_id` or use an explicit reorder transaction; a deferrable unique constraint cannot be an `ON CONFLICT` arbiter.
- The 3–4 Currently Growing and maximum-2 Recently Planted limits remain application rules, as required.

## 2.8 `site_copy`

- Primary key: `(copy_key, locale)`.
- Key fields: `copy_key`, `locale`, `copy_group`, `copy_value`, `updated_at`, and nullable `updated_by`.
- Checks: locale is limited to `zh` or `en`; value must be nonblank; both the key and its matching group are allow-listed.
- The current allow-list maps the unambiguous approved Home, Region, Greenhouse, and Footer copy slots to 17 internal machine keys. It exposes no Region-name, route, layout, accessibility-label, security-warning, or technical-error setting.
- `V2_CONTENT.md` approves selected CTA editing but does not freeze the specific CTA machine keys. No generic CTA key is opened here; a later approved migration must add exact CTA keys after the content contract names them.
- Delete behavior: no foreign-key dependency. The migration does not seed or rewrite any visible copy.

## 2.9 `ai_settings`

- Primary key: `setting_key`.
- Key fields: `setting_value`, `updated_at`, and nullable `updated_by`.
- The allow-list contains only `system_instruction`, `tone_guidance`, `structured_output_guidance`, `example_input`, `example_output`, and `recommendation_wording`.
- Values must be nonblank text. There is no field for an API key, secret, provider URL, model, timeout, validation policy, or security control.
- Application validation must still prevent a user from placing secret material inside a free-text prompt value; a database text check cannot prove the provenance of arbitrary prose.

## 2.10 `visitor_notes`

- Primary key: generated UUID.
- Key fields: optional `name`, required `message`, `is_read` defaulting to false, and `created_at`.
- Checks: the message must be nonblank; a provided name must be nonblank.
- Index: `(is_read, created_at DESC)` supports the moderation inbox.
- There is no email, visitor account, reply, like, public-comment, or identity field.

## 2.11 `analytics_daily`

- Primary key: `(event_type, event_date)`.
- Key fields: approved event enum, UTC calendar date, nonnegative aggregate count, `created_at`, and `updated_at`.
- The primary key is also the required event-type/date index.
- There is no visitor, account, email, IP, session, path, referrer, user-agent, browsing-trail, or cross-site identifier field.
- The table has no content foreign key and therefore has no content-delete side effect.

## 2.12 `route_redirects`

- Primary key: generated UUID.
- Key fields: unique `old_path`, nullable `new_path`, status code defaulting to 308, nullable `content_id`, and `created_at`.
- Foreign key: `content_id -> contents.id ON DELETE SET NULL`, preserving the route record after content deletion.
- Checks: paths must be trimmed local absolute paths, cannot begin with `//`, and cannot contain a query string or fragment. A redirect destination cannot equal its source.
- Status behavior: 301 and 308 require `new_path`; 410 requires `new_path` to be null and acts as a Gone tombstone.
- The old-path unique constraint provides the required lookup index.

## 2.13 `preview_tokens`

- Primary key: generated UUID.
- Key fields: `content_id`, unique `token_hash`, `expires_at`, nullable `revoked_at`, `created_at`, and nullable `created_by`.
- Foreign key: `content_id -> contents.id ON DELETE CASCADE`.
- Checks: only a trimmed hash of at least 32 characters may be stored; expiry must follow creation; revocation, when present, cannot precede creation.
- Indexes: the unique hash index supports token lookup; `(content_id, expires_at DESC)` supports content-level token administration.
- The schema contains no plaintext-token column. Secure token generation and hash verification remain application responsibilities.

# 3. Enum and Constraint Decisions

The migration uses native PostgreSQL enums to freeze the approved case-sensitive values:

| Enum | Values |
| --- | --- |
| `garden_region` | `Garden`, `Forest`, `Lake`, `Ruins` |
| `content_type` | `Seed`, `Question`, `Reflection`, `Trace` |
| `detail_level` | `full`, `short` |
| `content_lifecycle` | `Draft`, `Review`, `Published`, `Archived` |
| `growth_stage` | `Seed`, `Sprout`, `Growing`, `Bloom`, `Dormant` |
| `content_language` | `zh`, `en`, `bilingual`, `mixed` |
| `relation_type` | `grewFrom`, `grewInto`, `relatedTo` |
| `home_slot` | `currentlyGrowing`, `recentlyPlanted` |
| `analytics_event_type` | `page_view`, `region_view`, `content_view`, `greenhouse_use`, `note_submit`, `share_click` |

Lifecycle and Growth Stage remain independent. `Deleted` is not an enum value because deletion is a terminal action, not an editable lifecycle.

Named `CHECK` and `UNIQUE` constraints enforce row-level and same-table integrity: nonblank bilingual requirements, route uniqueness, relation safety, approved setting keys, cover metadata consistency, daily aggregate uniqueness, and preview-token timing. Region-to-Content-Type mapping is not constrained because the content specification calls it recommended rather than mandatory.

`created_by` and `updated_by` are nullable UUIDs without Auth foreign keys. This permits an honest V1 import before an authenticated Garden Keeper identity exists and avoids implementing Authentication early.

`public.set_updated_at()` is a generic, non-`SECURITY DEFINER` function attached only to `contents`, `home_curation`, `site_copy`, `ai_settings`, and `analytics_daily`. It changes only `updated_at`. There are no automatic publish, archive, Growth Stage, relation, version-trimming, Featured, Home-limit, or `last_tended_at` business triggers.

The following rules intentionally remain outside basic schema constraints:

- Review/Published summary, body, category, and lifecycle-transition validation;
- `published_at` requirements for newly published records, while preserving nullable unknown V1 dates;
- first-publication slug freezing and cross-table prevention of deleted-slug reuse;
- exact fixed taxonomy allow-lists, category normalization, and duplicate-category prevention;
- atomic Growth Stage update plus Growth Note creation;
- latest-ten version trimming;
- maximum three Featured items per Region;
- Home slot quantity limits;
- exact selected CTA setting keys.

These require the later service/validation and deletion workflows. A 410 `route_redirects` tombstone provides the storage structure for a deleted route, but ordinary same-table uniqueness cannot by itself enforce uniqueness across live `contents` and tombstone rows.

# 4. Index Strategy

| Index or constraint-backed index | Query purpose |
| --- | --- |
| `contents_region_lifecycle_idx` | Published/Archived collection reads within a Region. |
| `contents_region_slug_key` | Unique route lookup within a Region. |
| `contents_lifecycle_idx` | Admin and lifecycle filtering. |
| `contents_growth_stage_idx` | Growth Stage filtering. |
| `contents_last_tended_at_idx` | Recently tended ordering; partial on non-null values. |
| `contents_published_at_idx` | Recently published ordering; partial on non-null values. |
| `contents_featured_idx` | Featured Region ordering; partial on `featured = true`. |
| `contents_bilingual_search_trgm_idx` | Non-vector substring search across combined Chinese/English title and summary text. |
| `contents_primary_categories_idx` | GIN category membership/filter queries. |
| `content_versions_content_created_idx` | Recent versions for one content item. |
| `growth_notes_content_occurred_idx` | Growth history for one content item. |
| `content_relations_source_target_type_key` | Duplicate prevention and source-relation lookup. |
| `content_relations_target_idx` | Reverse target-relation lookup and deletion impact review. |
| `content_tags` primary key | Content-to-tag lookup and duplicate prevention. |
| `content_tags_tag_id_idx` | Tag-to-content lookup. |
| `home_curation` primary/unique keys | Content uniqueness and stable slot ordering. |
| `site_copy_group_locale_idx` | Admin copy listing by group and locale. |
| `visitor_notes_read_created_idx` | Unread-first/recent moderation reads. |
| `analytics_daily` primary key | Event-type/date lookup and one aggregate per UTC day. |
| `route_redirects.old_path` unique index | Redirect/tombstone lookup. |
| `route_redirects_content_id_idx` | Redirect history for a content item. |
| `preview_tokens.token_hash` unique index | Secure preview lookup by hash. |
| `preview_tokens_content_expiry_idx` | Token administration by content and expiry. |

Primary keys and other unique constraints also create their normal implicit B-tree indexes, including `legacy_id` and normalized tag-name indexes. Foreign-key reverse indexes are added where the leftmost columns of an existing primary/unique index do not already cover the query.

The trigram index is on one exact four-field concatenation expression. The later content service must use that same expression for the index to be eligible, then confirm the query plan with `EXPLAIN` against Preview data. Trigram search also has limited selectivity for one- or two-character queries. No vector or full-body index is present.

# 5. Analytics Storage Decision

Phase 02A chooses a daily aggregate table rather than a raw anonymous event table.

Each row stores only:

- one of the six approved event categories;
- a UTC date;
- an aggregate count;
- technical row timestamps.

This design never stores an event-level visitor record, so there is no raw-event retention window and no data with which to reconstruct a visitor's trail. It also deliberately provides only per-event-category totals; it does not provide per-page, per-Region, or per-content breakdowns. Any future change to that privacy boundary requires separate approval and a schema migration.

# 6. Migration Files

Added:

- `supabase/migrations/20260714070845_phase_02a_core_database_schema.sql`

The file follows the timestamped Supabase migration layout and applies its schema changes in one explicit transaction. It uses `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions` and a local `public, extensions` search path, matching the managed Supabase extension layout while also resolving an existing `public` installation.

The migration contains no real secret, V1 content row, copy seed, analytics data, RLS policy, Storage object, Auth setup, grant, or production connection. It is versioned and repeatably manageable through migration history; it is intentionally not written to make the same schema-creation file succeed when executed twice outside migration history.

# 7. Validation Results

Repository commands below were run from the inner repository root on `2026-07-14`. Supabase Dashboard verification was completed manually on the same date.

| Check | Command or method | Status | Actual result / limitation |
| --- | --- | --- | --- |
| Migration layout and static structure | PowerShell structural assertions and manual review | **PASS (static only)** | Filename matches the 14-digit Supabase pattern; exactly 13 tables, 9 enum types, 16 explicit indexes, and 5 `updated_at` triggers were found; parentheses balanced 202/202; required constraints/index markers and the forbidden-scope scan passed. This is not a PostgreSQL parser or database execution. |
| Supabase Dashboard migration execution | Supabase Dashboard SQL Editor, Table Editor, Enumerated Types, Indexes, and Triggers | **PASS** | The migration SQL executed successfully. All 13 core tables are visible in Table Editor; all 9 PostgreSQL enum types are visible in Enumerated Types; required indexes and the generic `updated_at` triggers were verified. Production was not modified, and no RLS, Storage, Auth, or later-phase feature was added. |
| Standard lint | `npm.cmd run lint` | **PARTIAL** | The unchanged command exits 1 because ESLint scans the pre-existing, Git-ignored `.chrome-cdp-audit` Chrome profile: 1,966 generated-file findings (14 errors, 1,952 warnings). No finding points to a Phase 02A file. |
| Focused project-source lint | `npm.cmd run lint -- --ignore-pattern ".chrome-cdp-audit/**"` | **PASS** | ESLint completed with `--max-warnings=0` and no output findings after excluding only the known generated Chrome profile. |
| TypeScript | `npm.cmd run typecheck` | **PASS** | `tsc --noEmit` completed successfully. |
| Production build | `npm.cmd run build` | **PASS** | The definitive run compiled successfully, checked types, and generated all 32 static pages. A restricted-sandbox attempt was terminated after its Next.js child process made no progress output; the equivalent allowed run passed. |
| Seed Gardener tests | `npm.cmd run test:seed-gardener` | **PASS** | 15 tests passed; 0 failed, skipped, cancelled, or todo. No real paid provider request was made. |
| Garden Index route smoke | `npm.cmd run test:smoke:garden-index` against local production server | **PASS** | Home and Garden Index returned 200, canonical routes remained distinct, and all 19 content links returned 200. |
| Browser/accessibility audit | `npm.cmd run test:phase5` against local production server | **PASS** | The definitive run reported 0 failures across 320, 390, 500, 768, 1024, and 1440 px checks, 16 representative pages, axe, keyboard flows, Greenhouse states, and reduced motion. The initial sandboxed Chrome launch exited with environment code `2147483651`; the allowed rerun passed. |

# 8. Changes Made

- `supabase/migrations/20260714070845_phase_02a_core_database_schema.sql` — adds the complete Phase 02A core schema, enums, basic constraints, delete behavior, indexes, and generic `updated_at` mechanism.
- `docs/V2_TODO.md` — marks only the 13 Phase 2A core-table checklist items complete. Phase 2B, 2C, 2D, and later work remain unchecked.
- `docs/V2_PHASE_02A_REPORT.md` — records the schema design, validation evidence, limitations, and acceptance status.

No application source, Supabase client, environment file, content data, route, page, component, dependency, RLS policy, Storage configuration, or Auth configuration was changed.

# 9. Deferred Work

The following work was explicitly not performed:

- RLS policies, grants, public/admin access rules, and RLS tests;
- Storage buckets, cover upload validation, and Storage policies;
- GitHub Auth, Garden Keeper authorization, and actor foreign keys;
- import or seeding of the 19 V1 content items, taxonomy values, site copy, Home curation, or relations;
- V1 content migration tooling or execution;
- Garden Keeper pages, services, actions, or routes;
- public content service, public-page migration, Index/Search changes, redirects, or sitemap changes;
- Supabase client extensions or a privileged client;
- publication/lifecycle validation, reliable timestamp assignment, and archive/delete workflows;
- slug freezing after first publication, Region-change migration, redirect-loop checks, and cross-table deleted-route reservation;
- automatic latest-ten version retention and restore behavior;
- Featured and Home quantity limits;
- the atomic Growth Stage/Growth Note write workflow;
- exact selected CTA setting keys, which are not frozen in the current content specification;
- fixed primary-taxonomy allow-list validation and normalization;
- visitor-note sanitization, rate limiting, spam protection, deletion UI, and RLS;
- preview-token generation, hashing, verification, revocation endpoints, and preview route;
- analytics increment code, Garden Keeper analytics UI, and any finer analytics dimensions;
- Preview reset procedure, database-native migration lint, and Preview/Production isolation verification.

Some basic enum, self-relation, duplicate, route, and cover-integrity constraints were included because this task explicitly requires them. This does not mark the broader Phase 2C constraint work or Phase 2D security work complete.

# 10. Phase 02A Acceptance Status

| Acceptance item | Status | Evidence / limitation |
| --- | --- | --- |
| All 13 approved core tables represented | **PASS** | The migration defines exactly the required table set, using `analytics_daily` for the approved aggregate analytics choice. |
| Required fields, primary keys, foreign keys, and delete behavior | **PASS** | Every required field is represented; the migration executed successfully, and delete behavior is explicit through CASCADE, RESTRICT, or SET NULL as documented above. |
| Required enum values and basic constraints | **PASS** | Nine enum types match the approved values and were verified in Supabase Dashboard; named CHECK/UNIQUE constraints cover the requested row-level integrity rules. |
| Required indexes and non-vector bilingual search foundation | **PASS** | Required explicit and constraint-backed indexes were verified in Supabase Dashboard; `pg_trgm` is used and no vector index exists. |
| Anonymous analytics privacy boundary | **PASS** | `analytics_daily` stores only UTC event-category counts and technical timestamps. |
| Versioned Supabase migration created | **PASS** | One timestamped migration exists under `supabase/migrations/`. |
| Migration parsed/applied by Supabase PostgreSQL | **PASS** | Supabase Dashboard SQL Editor executed the migration successfully; the resulting tables, enums, indexes, and `updated_at` triggers were manually verified. |
| Project regressions | **PASS WITH KNOWN LINT LIMITATION** | Typecheck, build, all three existing test commands, and focused source lint pass. The standard lint command remains blocked by the pre-existing ignored Chrome profile. |
| No secret, real content, Production mutation, or future-phase implementation | **PASS** | Final scope scan found DDL only. Dashboard verification confirmed that Production was not modified and that no RLS, Storage, Auth, or later-phase feature was added. |

**Overall Phase 02A status: complete. The repository implementation and Supabase Dashboard migration execution have both been verified within the Phase 02A scope; Production remains unchanged.**
