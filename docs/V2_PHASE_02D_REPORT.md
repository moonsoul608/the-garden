# The Garden V2 Phase 02D Report

Task: `02D-1 Database Security Foundation`  
Report date: `2026-07-14`  
Environment verified: Supabase Preview only

This report records the completed database portion of Phase 02D. The versioned security migration was applied through the Supabase Preview Dashboard SQL Editor, and the permission test suite completed successfully with all fixtures rolled back. Production was not modified.

# 1. Phase 02D-1 Purpose

Phase 02D-1 establishes the database authorization boundary required before database-backed public pages or Garden Keeper administration are introduced.

The work provides:

- deny-by-default Garden Keeper authorization infrastructure;
- least-privilege database grants;
- Row Level Security on every Phase 02A application table;
- Published-only public reads;
- protection for Draft, Review, Archived, moderation, analytics, configuration, redirect, version, and preview-token data;
- reproducible permission tests against Preview.

This subtask does not configure an Auth provider, bind a real Garden Keeper, add application authorization, or implement Storage policies.

# 2. Security Model

The database prepares the two effective Version 2 roles defined by the master specification:

| Effective actor | Database behavior after Phase 02D-1 |
| --- | --- |
| Public visitor (`anon`) | May read approved public data only when its owning content is Published. Has no application-table write access. |
| Authenticated non-Keeper | Retains the same public read access as a visitor but cannot use any Garden Keeper policy. |
| Future Garden Keeper | Administrative policies exist, but access requires an authenticated user present in the private allow-list. The allow-list is empty in this phase. |
| Privileged migration operation | Remains an explicitly server-controlled database operation and is not exposed through public client credentials. |

Broad default privileges for the `anon` and `authenticated` API roles were revoked before narrower grants were added. Public `contents` and `site_copy` reads use column-level grants so internal actor UUIDs and migration-only identity fields are not exposed from otherwise public rows.

Public read policies cover only the approved public graph:

- `contents`: rows whose lifecycle is `Published`;
- `growth_notes`: public notes whose parent content is Published;
- `content_relations`: relations whose source and target are both Published;
- `tags` and `content_tags`: tags and bindings connected to Published content;
- `home_curation`: entries whose content is Published;
- `site_copy`: approved fixed-copy rows, without the internal `updated_by` field.

No public policy exposes Archived content. A later resting-state implementation must use an explicitly safe projection rather than making archived bodies queryable.

# 3. Tables Protected by RLS

Row Level Security is enabled on all 13 Phase 02A application tables:

1. `contents`
2. `content_versions`
3. `growth_notes`
4. `content_relations`
5. `tags`
6. `content_tags`
7. `home_curation`
8. `site_copy`
9. `ai_settings`
10. `visitor_notes`
11. `analytics_daily`
12. `route_redirects`
13. `preview_tokens`

The following data remains unavailable to anonymous visitors and unapproved authenticated users:

- Draft, Review, and Archived content rows;
- private Growth Notes and relations involving non-Published content;
- version history;
- AI settings;
- visitor-note contents;
- analytics aggregates;
- redirect records;
- preview-token hashes.

Anonymous `visitor_notes` insertion is intentionally not granted. It remains deferred to Phase 10 together with validation, sanitization, rate limiting, and spam protection.

# 4. Garden Keeper Authorization Foundation

The migration creates the private table:

```text
private.garden_keeper_identities
```

It is designed to hold the future Supabase Auth user UUID, GitHub provider, immutable GitHub provider account ID, and an optional readable username. The table contains no rows in Phase 02D-1.

The migration also creates:

```text
private.is_garden_keeper()
```

The helper:

- is a narrowly scoped `SECURITY DEFINER` function;
- has a fixed `pg_catalog, private` search path;
- checks the current `auth.uid()` against the private allow-list;
- returns false when no matching identity exists;
- is used by every Garden Keeper RLS policy;
- does not expose the allow-list table to public API roles.

The `private` schema and allow-list table grant no direct access to `PUBLIC`, `anon`, or `authenticated`. The helper is callable only as required by the stored policy expressions. With the allow-list empty, all administrative policies remain safely deny-by-default.

# 5. Policy Verification Results

| Requirement | Preview result |
| --- | --- |
| RLS enabled on all 13 application tables | **PASS** |
| Anonymous access limited to Published public content | **PASS** |
| Draft and Review hidden from public queries | **PASS** |
| Archived bodies hidden from public queries | **PASS** |
| Private Growth Notes and unpublished relationships hidden | **PASS** |
| Versions, AI settings, notes, analytics, redirects, and preview tokens protected | **PASS** |
| Anonymous visitor-note insertion disabled | **PASS** |
| Unapproved authenticated user denied Keeper writes | **PASS** |
| Unapproved authenticated user denied private operational reads | **PASS** |
| Garden Keeper helper rejects an identity absent from the allow-list | **PASS** |
| Authorization internals inaccessible to public API roles | **PASS** |

No Storage policy or `storage.objects` change was part of this verification.

# 6. Test Evidence

The following versioned files were applied and tested in Preview:

- `supabase/migrations/20260714191020_phase_02d_rls_permissions.sql`
- `supabase/tests/phase_02d_rls_permissions.sql`

The permission test used transaction-scoped fixtures representing Published, Draft, Review, and Archived content together with related public and private records.

Verified behavior included:

- catalog inspection confirmed `relrowsecurity` for all 13 required tables;
- anonymous queries returned only the two Published content fixtures;
- anonymous queries could not read Draft, Review, Archived, versions, AI settings, visitor notes, analytics, redirects, or preview tokens;
- public Growth Note, relation, tag, tag-binding, and Home-curation policies excluded records connected to non-Published content;
- anonymous access to internal actor columns was rejected;
- anonymous and unapproved authenticated visitor-note inserts were rejected;
- an unapproved authenticated user could not insert or update content;
- the secure helper returned false for a user absent from the allow-list;
- private-schema and allow-list privileges remained unavailable to API roles.

The test file ended with an explicit rollback. All content, relation, tag, copy, configuration, note, analytics, redirect, and preview-token fixtures were removed. No test record remained in Preview.

# 7. Deferred Work

The following work remains intentionally incomplete:

- Phase 02D-2 Storage policies for Published cover reads and Garden Keeper upload, replace, and delete;
- anonymous visitor-note insertion and abuse protection in Phase 10;
- Supabase Auth provider configuration;
- GitHub OAuth;
- binding the approved Garden Keeper identity to the immutable GitHub provider account ID;
- authentication callbacks, session refresh, logout, and unauthorized states;
- application-side authorization and validation;
- Garden Keeper `/admin` routes and UI;
- end-to-end authenticated Garden Keeper testing;
- Production migration and verification.

# 8. Phase Status

**Phase 02D-1 Database Security Foundation is complete in Preview.** The migration and RLS tests were applied successfully, all fixtures were rolled back, the allow-list remains empty, and Production was not modified.

Phase 02D as a whole remains incomplete until the separate Storage policy subtask is implemented and verified. Phase 2 full acceptance also remains incomplete.
