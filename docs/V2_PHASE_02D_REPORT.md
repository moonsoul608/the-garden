# The Garden V2 Phase 02D Report

Task: `02D Security & Access`
Subtasks: `02D-1 Database Security Foundation`, `02D-2 Storage Policies`
Report date: `2026-07-14`
Environment verified: Supabase Preview only

This report records the completed Phase 02D database and Storage security foundation. Both versioned migrations were applied through the Supabase Preview Dashboard SQL Editor, both permission test suites passed, and all test fixtures were rolled back. Production was not modified.

# 1. Full Phase 02D Scope

Phase 02D establishes the authorization boundary required before database-backed public content, Garden Keeper authentication, or content-management workflows are introduced.

Completed work includes:

- a private, deny-by-default Garden Keeper identity allow-list;
- a secure Garden Keeper authorization helper;
- least-privilege database grants;
- Row Level Security on all 13 Phase 02A application tables;
- Published-only public database reads;
- protection for Draft, Review, Archived, moderation, analytics, configuration, redirect, version, and preview-token data;
- policy-controlled public access to Published cover images while keeping the bucket private;
- Garden Keeper-only cover read, upload, update, and delete policies;
- reproducible database and Storage permission tests in Preview.

Anonymous `visitor_notes` insertion remains deliberately disabled. Auth provider configuration, GitHub OAuth, identity binding, admin routes, and application authorization remain later-phase work.

# 2. Security Model

Phase 02D prepares the two effective Version 2 roles defined by the master specification:

| Effective actor | Database access | Cover-image access |
| --- | --- | --- |
| Public visitor (`anon`) | Reads only approved public data connected to Published content. Has no application-table writes. | Reads only an object exactly referenced by a Published `contents` row. Cannot upload, update, or delete. |
| Authenticated non-Keeper | Retains visitor-level public reads but cannot use Garden Keeper policies. | Retains Published-cover reads only. Cannot upload, update, delete, or read private covers. |
| Future Garden Keeper | Administrative policies require an authenticated user present in the private allow-list. | May read private covers and insert, update, or delete objects in `cover-images`, subject to bucket and path checks. |
| Privileged migration operation | Remains an explicitly server-controlled operation and is not exposed through public client credentials. | May perform controlled migration work through privileged infrastructure, outside ordinary visitor or Keeper requests. |

Broad default application-table privileges for `PUBLIC`, `anon`, and `authenticated` were revoked before narrower grants were added. Public `contents` and `site_copy` reads use column-level grants so internal actor UUIDs and migration-only identity fields are not exposed from otherwise public rows.

The `cover-images` bucket remains private. Published delivery is authorized per object by `storage.objects` RLS policies; the bucket was not made public, and signed URLs are not the primary Published-cover delivery mechanism.

# 3. Database Security Foundation and RLS Architecture

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

Public database policies expose only the approved public graph:

- `contents`: rows whose lifecycle is `Published`;
- `growth_notes`: public notes whose parent content is Published;
- `content_relations`: relations whose source and target are both Published;
- `tags` and `content_tags`: tags and bindings connected to Published content;
- `home_curation`: entries whose content is Published;
- `site_copy`: approved fixed-copy rows without the internal `updated_by` field.

The following remain unavailable to anonymous visitors and unapproved authenticated users:

- Draft, Review, and Archived content rows and bodies;
- private Growth Notes and relations involving non-Published content;
- version history;
- AI settings;
- visitor-note contents;
- analytics aggregates;
- redirect records;
- preview-token hashes.

Every application table also has a Garden Keeper policy using the shared authorization helper. With no bound Keeper identity, those administrative policies remain deny-by-default.

Anonymous `visitor_notes` insertion was not granted. It remains deferred until Phase 10 can add application validation, sanitization, rate limiting, and spam protection.

# 4. Garden Keeper Authorization Foundation

Phase 02D-1 created the private table:

```text
private.garden_keeper_identities
```

It is designed to hold the future Supabase Auth user UUID, GitHub provider, immutable GitHub provider account ID, and an optional readable username. No real Garden Keeper identity was added in Phase 02D.

Phase 02D-1 also created:

```text
private.is_garden_keeper()
```

The helper:

- is a narrowly scoped `SECURITY DEFINER` function;
- has a fixed `pg_catalog, private` search path;
- checks the current `auth.uid()` against the private allow-list;
- returns false when no matching identity exists;
- is used by database and Storage Garden Keeper policies;
- does not expose the allow-list table to public API roles.

The `private` schema and allow-list table grant no direct access to `PUBLIC`, `anon`, or `authenticated`. A transaction-only synthetic identity was used solely to verify the positive Storage Keeper path; it was rolled back and did not bind a real account.

# 5. Storage Policy Architecture

The existing Storage foundation remains unchanged:

- bucket: `cover-images`;
- visibility: private;
- maximum object size: 5 MiB;
- accepted MIME types: JPEG, PNG, and WebP;
- object-name convention: `contents/{content-id}/{unique-file-name}`.

Phase 02D-2 added five policies on `storage.objects`, all scoped to `bucket_id = 'cover-images'`:

| Policy purpose | Rule |
| --- | --- |
| Public read | `anon` and `authenticated` may select an object only when its exact `name` is stored in `contents.cover_image_path` and that content lifecycle is `Published`. |
| Garden Keeper read | An authenticated allow-listed Keeper may read cover objects for administration, including non-Published covers. |
| Garden Keeper insert | Requires Keeper authorization, the `cover-images` bucket, the confirmed path convention, and an existing content UUID in the path. |
| Garden Keeper update | Requires Keeper authorization for both the existing row and resulting row; the resulting name must retain the confirmed path convention and reference existing content. |
| Garden Keeper delete | Requires Keeper authorization and is limited to the `cover-images` bucket. |

No policy applies these permissions to another bucket. No bucket row, visibility flag, file-size limit, MIME allow-list, content column, or application client was changed.

# 6. Storage Access Rules

Public cover access is derived from canonical content state:

- Published and exactly referenced cover: readable;
- unreferenced object: not publicly readable;
- Draft cover: not publicly readable;
- Review cover: not publicly readable;
- Archived cover: not publicly readable;
- object in another bucket: unaffected by these policies.

Write access is deny-by-default:

- anonymous upload, update, and delete are denied;
- authenticated users absent from the allow-list are denied;
- only an authenticated user accepted by `private.is_garden_keeper()` can use the Keeper policies;
- inserts and updates cannot escape the approved content-scoped object path.

# 7. Preview Verification and Test Results

The following versioned files were applied and tested in Preview:

- `supabase/migrations/20260714191020_phase_02d_rls_permissions.sql`
- `supabase/tests/phase_02d_rls_permissions.sql`
- `supabase/migrations/20260714194046_phase_02d_storage_policies.sql`
- `supabase/tests/phase_02d_storage_policies.sql`

## 7.1 Database permission verification

| Requirement | Result |
| --- | --- |
| RLS enabled on all 13 application tables | **PASS** |
| Anonymous access limited to Published public content | **PASS** |
| Draft, Review, and Archived bodies hidden | **PASS** |
| Private Growth Notes and unpublished relationships hidden | **PASS** |
| Versions, AI settings, notes, analytics, redirects, and preview tokens protected | **PASS** |
| Anonymous visitor-note insertion disabled | **PASS** |
| Unapproved authenticated user denied Keeper reads and writes | **PASS** |
| Helper rejects an identity absent from the allow-list | **PASS** |
| Authorization internals inaccessible to API roles | **PASS** |

## 7.2 Storage policy verification

| Requirement | Result |
| --- | --- |
| `cover-images` bucket remains private | **PASS** |
| Referenced Published cover publicly readable | **PASS** |
| Draft and other non-Published covers not publicly readable | **PASS** |
| Anonymous upload denied | **PASS** |
| Non-Keeper authenticated upload denied | **PASS** |
| Allow-listed Keeper private read succeeds | **PASS** |
| Allow-listed Keeper insert succeeds | **PASS** |
| Allow-listed Keeper update succeeds | **PASS** |
| Allow-listed Keeper delete succeeds | **PASS** |
| No bucket visibility change | **PASS** |

Production was not used for migration execution or testing.

# 8. Rollback Confirmation

Both SQL test suites ran inside explicit transactions and ended with `rollback`.

The database permission fixtures included Published, Draft, Review, and Archived content together with related versions, Growth Notes, relations, tags, copy, AI settings, visitor notes, analytics, redirects, and preview tokens.

The Storage policy fixtures included transaction-only Auth, Garden Keeper allow-list, content, and `storage.objects` rows. The synthetic Keeper existed only long enough to verify the positive authorization path.

All fixtures were removed by rollback. No test content, Auth user, allow-list identity, Storage object, note, analytics row, redirect, token, or configuration value remained in Preview.

# 9. Deferred Work

The following work remains intentionally incomplete:

- Supabase Auth provider configuration;
- GitHub OAuth;
- binding the approved Garden Keeper identity to the immutable GitHub provider account ID;
- authentication callbacks, session refresh, logout, and unauthorized states;
- Garden Keeper `/admin` routes and UI;
- application-side authorization and validation;
- anonymous `visitor_notes` interaction, sanitization, rate limiting, and spam protection;
- content creation, editing, lifecycle, versioning, preview, curation, upload, replacement, deletion, and cleanup workflows;
- end-to-end authenticated Garden Keeper application testing;
- Production migration and verification.

# 10. Phase Status

**Phase 02D Security & Access is complete in Preview within the confirmed database and Storage scope.** Database RLS and Storage policies were applied successfully, permission tests passed, all fixtures were rolled back, the real Garden Keeper allow-list remains empty, the bucket remains private, and Production was not modified.

Auth, Garden Keeper application work, visitor-note interaction, future content-management workflows, and full Phase 2 acceptance remain incomplete.
