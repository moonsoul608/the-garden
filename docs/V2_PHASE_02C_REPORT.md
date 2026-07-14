# The Garden V2 Phase 02C Report

Task: `02C Constraints`  
Report date: `2026-07-14`  
Repository: `D:\the-garden\the-garden-codex-docs\the-garden-codex-docs`

This report records verification of the Version 2 database constraints required by Phase 02C. Phase 02C was handled as a constraint-verification phase: it checked the schema created by Phase 02A and did not introduce content services, application behavior, or new database migrations.

# 1. Phase Purpose

The purpose of Phase 02C was to confirm that the existing Preview database rejects invalid Region, Content Type, Growth Stage, lifecycle, route, relation, and cover-metadata states required by `docs/V2_TODO.md` and `docs/V2_CONTENT.md`.

The Phase 02A migration already represented the required rules. Phase 02C therefore verified the committed migration definitions and their actual behavior in the Supabase-managed PostgreSQL database before deciding whether any schema correction was necessary.

# 2. Verification Scope

The verification covered only the nine Phase 02C checklist items:

- Region enum validation;
- Content Type enum validation;
- Growth Stage enum validation;
- lifecycle enum validation;
- unique `(region, slug)` enforcement;
- relation self-reference prevention;
- duplicate identical relation prevention;
- a maximum of one cover-image reference per content item;
- required cover alt text after Draft and before publication.

The repository sources reviewed for this verification were:

- `docs/V2_TODO.md`;
- `docs/V2_CONTENT.md`;
- the existing Version 2 phase reports;
- `supabase/migrations/20260714070845_phase_02a_core_database_schema.sql`.

No Production database operation was part of this phase.

# 3. Requirement-to-Implementation Traceability

| Phase 02C requirement | Existing database implementation | Verified behavior |
| --- | --- | --- |
| Region enum/validation | `public.garden_region` enum with `Garden`, `Forest`, `Lake`, and `Ruins` | Invalid Region values are rejected. |
| Content Type enum/validation | `public.content_type` enum with `Seed`, `Question`, `Reflection`, and `Trace` | Invalid Content Type values are rejected. |
| Growth Stage enum/validation | `public.growth_stage` enum with `Seed`, `Sprout`, `Growing`, `Bloom`, and `Dormant` | Invalid Growth Stage values are rejected. |
| lifecycle enum/validation | `public.content_lifecycle` enum with `Draft`, `Review`, `Published`, and `Archived` | Invalid lifecycle values are rejected. |
| Unique Region + slug | `contents_region_slug_key` unique constraint on `(region, slug)` | A duplicate slug in the same Region is rejected. |
| Relation self-reference prevention | `content_relations_not_self` check constraint | A relation whose source and target are the same content item is rejected. |
| Duplicate relation prevention | `content_relations_source_target_type_key` unique constraint on `(source_content_id, target_content_id, relation_type)` | An identical directed relation is rejected. |
| Maximum one cover image per item | One scalar `cover_image_path text` column on `public.contents` | Each content row can hold zero or one cover-image path; there is no multi-image field or cover collection. |
| Required alt text before publication | `contents_cover_alt_after_draft` check constraint, supported by cover path/alt consistency checks | Draft may retain a cover without alt text; Review and Published records with a cover but no alt text are rejected. |

# 4. Database Constraints Verified

The four required validation domains use native PostgreSQL enum types. Invalid text cannot be stored in their corresponding typed columns.

Route uniqueness is enforced within a Region rather than globally. The unique constraint permits the same slug in different Regions. Draft rows may have a null slug, while the separate `contents_slug_required_after_draft` check requires a slug for Review, Published, and Archived content.

Relation integrity is enforced in two complementary ways:

- `content_relations_not_self` prevents a content item from targeting itself;
- `content_relations_source_target_type_key` prevents repetition of the same directed source, target, and relation-type combination.

Cover cardinality is represented structurally by one nullable scalar `cover_image_path` on each content row. Cover alt consistency is enforced by the named cover checks. In particular, `contents_cover_alt_after_draft` permits incomplete cover metadata while an item is a Draft, then requires at least one nonblank alt field for later lifecycle states. Applying the requirement at Review is consistent with the Review checklist in `V2_CONTENT.md` and blocks publication without alt text.

# 5. Transactional Test Results

The verification script was executed manually through the Supabase Dashboard SQL Editor against the intended non-Production project. All fixtures were created inside one explicit transaction and the transaction was rolled back after the checks.

| Test | Result |
| --- | --- |
| Insert a valid Draft fixture | **PASS** — accepted. |
| Insert an invalid Region enum value | **PASS** — rejected. |
| Insert an invalid Content Type enum value | **PASS** — rejected. |
| Insert an invalid Growth Stage enum value | **PASS** — rejected. |
| Insert an invalid lifecycle enum value | **PASS** — rejected. |
| Insert a duplicate `(region, slug)` | **PASS** — rejected. |
| Insert a self-referencing relation | **PASS** — rejected. |
| Insert an identical duplicate relation | **PASS** — rejected. |
| Keep `cover_image_path` without alt text on a Draft | **PASS** — accepted. |
| Keep `cover_image_path` without alt text on a Review item | **PASS** — rejected. |
| Keep `cover_image_path` without alt text on a Published item | **PASS** — rejected. |
| Roll back verification fixtures | **PASS** — no test content or relation remained. |

No schema defect was found. The committed Phase 02A migration and the applied Preview database behaved consistently for every Phase 02C requirement.

# 6. Known Limitations and Deferred Work

- Runtime verification was performed manually through the Supabase Dashboard SQL Editor. No Supabase CLI was installed and no automated database-test harness was added to the repository.
- The database requires at least one nonblank alt field after Draft, but it does not prove that the populated field matches the content's primary language. Primary-language-specific alt validation remains an application and content-service responsibility in the later validation/publication work.
- RLS, database grants, public content visibility, Garden Keeper authorization, Storage read/write policies, Auth, and permission tests remain Phase 02D scope.
- Phase 2 overall acceptance is not complete. In particular, RLS tests and the Preview reset procedure remain unchecked in `docs/V2_TODO.md`.

# 7. Changes and Phase Status

Phase 02C requires documentation changes only:

- `docs/V2_TODO.md` marks the nine verified Phase 02C constraint items complete;
- `docs/V2_PHASE_02C_REPORT.md` records traceability and the completed Dashboard verification.

No existing migration, application source, Supabase configuration, Storage configuration, Auth configuration, RLS policy, permission rule, dependency, environment file, or later-phase implementation was changed.

**Overall Phase 02C status: complete. All nine required constraint behaviors were verified in the Preview database, all fixtures were rolled back, no schema defect was found, and no corrective migration is required.**
