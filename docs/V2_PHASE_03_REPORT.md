# The Garden V2 Phase 03 Report

Task: `03C V1 Migration Tooling Foundation`  
Phase scope: `03A Domain Types & Validation`, `03B Content Service Architecture`, `03C Migration Tooling`  
Report date: `2026-07-15`  
Execution mode: deterministic local dry-run only

This report records the completed Phase 03 foundations for the Version 2 content domain, validation rules, content-service boundary, legacy compatibility layer, and deterministic V1 migration tooling. It does not record a content import. No Preview or Production database write was attempted.

# 1. Phase 03 Overview

Phase 03 establishes the application and migration boundaries required before public pages can safely switch from Version 1 TypeScript content to Version 2 database content.

Completed foundation work includes:

- canonical Version 2 domain and database-facing content types;
- validation for lifecycle, publication, Growth Stage, cover, relation, and Growth Note rules;
- a public content-service interface with legacy, dual-read, and database modes;
- repository and mapper boundaries for future Supabase-backed reads;
- a legacy adapter that preserves the current public content shape;
- deterministic V1 extraction, transformation, verification, and dry-run reporting;
- idempotency classification based on `contents.legacy_id`.

Phase 03 does not enable content-management writes, migrate routes, switch pages to database reads, or authorize an import. The five Lake records without a confirmed Growth Stage remain blocked.

# 2. 03A Domain Types and Validation

## 2.1 Domain model foundation

The shared Version 2 model now represents:

- Regions and Content Types;
- Draft, Review, Published, and Archived lifecycle states;
- Seed, Sprout, Growing, Bloom, and Dormant Growth Stages;
- bilingual and mixed-language fields;
- full and short detail levels;
- Growth Notes and public Growth Timeline projections;
- directed content relations;
- optional cover metadata;
- Featured state and manual ordering;
- Home curation references;
- created, updated, published, archived, and last-tended timestamps;
- stable V1 migration identity through `legacy_id`.

The canonical application models are separated from snake-case database row, insert, and update shapes. Public projections omit migration and actor metadata that should not be exposed to visitors.

## 2.2 Validation foundation

The validation layer covers:

- permitted lifecycle transitions;
- required manual Growth Stage assignment;
- title, summary, body, slug, and primary-category publication requirements;
- lowercase kebab-case slugs;
- cover-path and cover-alt consistency;
- relation endpoint, self-reference, duplicate, and note validation;
- Growth Note destination-stage and note requirements;
- V1 migration identity, route, publication, and relation validation.

Missing Growth Stage is a blocking validation result. It is not defaulted from Region, Content Type, age, detail length, or any other inferred signal.

Generic Markdown-file import validation remains deferred. Phase 03C reads the existing executable TypeScript modules and does not implement the later Markdown import feature.

# 3. 03B Content Service Architecture

## 3.1 Content service boundary

The public service defines stable read operations for:

- published content collections;
- published detail lookup by Region and slug;
- published Home curation.

The service supports three source modes:

| Mode | Behavior |
| --- | --- |
| `legacy` | Reads the current Version 1 TypeScript content only. |
| `dual` | Reads database content first and uses legacy content only for routes not yet migrated. |
| `database` | Reads published content through the repository boundary only. |

Dual-read merging uses Region and slug to prevent duplicate public results. Home curation deliberately has no legacy fallback because its conflicts and display overrides remain deferred.

## 3.2 Repository and mapping boundary

The repository isolates Supabase query shapes from application-facing content models. Mappers convert database rows, tags, Growth Notes, relations, and Home curation into canonical public types and enforce required bilingual display values.

The admin content-service contracts define later write responsibilities but do not implement them. Draft creation, lifecycle transitions, publication, archival, version restoration, relation management, Home curation management, and Featured management remain incomplete.

## 3.3 Legacy adapter

The legacy adapter reads the existing Garden, Forest, Lake, Ruins, and detail modules and returns the same public content-service shapes expected by future database reads.

It preserves stable source order and route identity. Detail sections are converted to Markdown without rewriting their meaning. The adapter does not invent tags, dates, covers, Growth Stages, translations, or Home curation records.

# 4. 03C Migration Tooling

Phase 03C added four local TypeScript stages:

1. `scripts/content-v1/extract.ts`
2. `scripts/content-v1/transform.ts`
3. `scripts/content-v1/verify.ts`
4. `scripts/content-v1/apply.ts`

The tooling imports the existing TypeScript content modules as executable data. It does not parse their source text.

The transform produces a deterministic migration bundle containing:

- `contents`;
- `relations`;
- `tags`;
- `contentTags`;
- `homeCuration`;
- `siteCopy`;
- `compatibilityWarnings`;
- blocking `issues`.

All source slugs are preserved exactly. V1 IDs become `legacyId` values corresponding to `contents.legacy_id`. Unconfirmed dates stay null, V1 tags remain empty, and no cover is created when no confirmed cover exists.

# 5. Migration Pipeline Architecture

```text
V1 executable TypeScript modules
  ├─ Garden
  ├─ Forest
  ├─ Lake
  ├─ Ruins
  └─ details
          │
          ▼
Deterministic extract manifest
          │
          ▼
V2 migration bundle transform
  ├─ preserve legacy_id and slug
  ├─ convert detail bodies to Markdown
  ├─ create only Ruins grewInto relations
  ├─ retain null dates and absent tags/covers
  └─ record blocks and compatibility warnings
          │
          ▼
Structural verification
  ├─ total and Region counts
  ├─ identity and route uniqueness
  ├─ relation resolution
  └─ blocked-content exclusion
          │
          ▼
Dry-run apply report
  ├─ created
  ├─ updated
  ├─ unchanged
  ├─ blocked
  ├─ failed
  └─ warnings
```

No stage contains an enabled database write path.

# 6. Dry-Run Evidence

The verified dry-run produced the following results:

| Check | Result |
| --- | --- |
| Total V1 records | **PASS — 19** |
| Garden records | **PASS — 5** |
| Forest records | **PASS — 5** |
| Lake records | **PASS — 5** |
| Ruins records | **PASS — 4** |
| Ruins `grewInto` relations | **PASS — 4** |
| `relatedPaths` migrated as relations | **PASS — 0** |
| Importable records in an empty-snapshot dry-run | **14 planned creates** |
| Blocked Lake records | **5** |
| Structural failures | **0** |
| Compatibility warnings | **4** |
| Database writes | **0** |
| Preview imports | **0** |
| Production imports | **0** |

Validation commands completed successfully:

- TypeScript typecheck: **PASS**;
- ESLint with zero warnings allowed: **PASS**;
- migration dry-run: **PASS**.

The `created` result means a planned dry-run classification against an empty comparison snapshot. It does not mean those records were inserted.

# 7. Migration Validation Rules

Verification enforces:

- exactly 19 extracted records;
- Region counts of Garden 5, Forest 5, Lake 5, and Ruins 4;
- unique `legacy_id` values;
- unique Region and slug pairs;
- resolvable relation source and target identities;
- Ruins as the source of migrated `grewInto` relations;
- `grewInto` as the only migrated relation type;
- exclusion of every blocked record from the importable set;
- machine-readable reporting of every warning and failure.

The transform additionally follows these truthfulness constraints:

- preserve source slugs and IDs;
- preserve confirmed Growth Stages only;
- do not invent dates, tags, covers, copy, translations, or personal content;
- do not convert detail `relatedPaths` into database relations;
- do not create Home curation while its decisions are deferred;
- do not apply display overrides.

# 8. Blocked Content Handling

All five Lake records lack a confirmed Version 1 Growth Stage:

- `reverse-1999`;
- `jung-and-mandala`;
- `the-garden`;
- `love-love-love`;
- `summer-ghost`.

Each remains present in the migration bundle with `growthStage: null` and a `missing_growth_stage` blocking issue. This keeps the extracted inventory complete while preventing the records from entering the dry-run importable set.

The bundle therefore has migration status `blocked` even though structural verification passes. This distinction means the tooling is valid and deterministic, but the complete 19-record import is not authorized or ready.

# 9. Idempotency Strategy

Future migration identity is anchored to the unique database field:

```text
contents.legacy_id
```

Dry-run comparison accepts a reviewed JSON snapshot of existing content and classifies each non-blocked candidate as:

- `created` when no matching `legacy_id` exists;
- `unchanged` when the matching migration fields are identical;
- `updated` when the identity exists but migration fields differ.

A comparison against the generated bundle returned:

- created: 0;
- updated: 0;
- unchanged: 14;
- blocked: 5;
- failed: 0.

This verifies deterministic comparison and duplicate-avoidance design. It does not prove database upsert behavior because no database execution occurred. The TODO acceptance items for repeatable import and duplicate-free database execution therefore remain unchecked.

# 10. Deferred Migration Execution

The following remain intentionally incomplete:

- manual Growth Stage decisions for all five Lake records;
- authorization and implementation of an actual Preview import;
- confirmation that exactly 19 records were imported;
- Preview verification of every existing public URL;
- fixed-category seeding;
- Version 1 public site-copy seeding;
- Home curation decisions;
- display overrides;
- route migration and page switching to database reads;
- admin content management and Garden Keeper workflows;
- any Production migration or cutover.

The apply stage defaults to dry-run. `--preview` records future environment intent but does not enable writes. `--execute` is rejected because writes are not implemented, and `--production` is always rejected.

# 11. Phase Status

**The Phase 03 domain, validation, content-service, legacy-adapter, and deterministic migration-tooling foundations are complete.** Dry-run verification passed with the expected 19-record inventory, four explicit Ruins `grewInto` relations, five blocked Lake records, no guessed Growth Stages, no structural failures, and no database writes.

Phase 03 migration execution is not complete. The 19-record import, Preview route verification, page database switching, admin management, Garden Keeper workflows, and Production migration remain deferred and unchecked.
