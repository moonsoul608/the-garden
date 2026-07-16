# The Garden V2 — 06A Migration Audit and Import Preparation

Task: `06A. Migration Audit and Import Preparation`
Audit date: `2026-07-17`
Scope: documentation and local, non-writing validation only
Migration readiness: **not ready for import**

This report audits the existing Version 1 to Version 2 migration tooling and
records the preparation work required before a separately authorized import.
It does not import data, modify database content, change public routes, add a
migration execution path, or alter lifecycle, Admin, or Storage behavior.

## 1. Executive summary

The local migration foundation remains deterministic and write-free. The
current source inventory is complete at 19 records:

| Region | Expected | Extracted | Dry-run importable | Blocked |
| --- | ---: | ---: | ---: | ---: |
| Garden | 5 | 5 | 5 | 0 |
| Forest | 5 | 5 | 5 | 0 |
| Lake | 5 | 5 | 0 | 5 |
| Ruins | 4 | 4 | 4 | 0 |
| **Total** | **19** | **19** | **14** | **5** |

The empty-snapshot dry-run reports:

- 14 planned creates;
- 0 planned updates;
- 0 unchanged records;
- 5 blocked records;
- 0 structural failures;
- 4 compatibility warnings;
- 0 database writes.

`created` is a local classification against an empty comparison snapshot. It
does not mean that any row was inserted.

The five record-level blockers are unchanged: every Lake record lacks a
confirmed Growth Stage. The migration bundle therefore has status `blocked`
even though structural verification passes.

## 2. Existing tooling audit

### 2.1 Extract — `scripts/content-v1/extract.ts`

Current source format:

- executable TypeScript modules, not source-text parsing;
- collection data from `content/garden.ts`, `content/forest.ts`,
  `content/lake.ts`, and `content/ruins.ts`;
- detail data from `content/details.ts`;
- a deterministic JSON manifest with `schemaVersion: 1` and
  `source: "v1-static-typescript"`;
- source array order is preserved;
- no timestamp, random ID, filesystem metadata, database client, credentials,
  or network access is introduced.

The extract manifest contains `garden`, `forest`, `lake`, `ruins`, and
`details`. Direct execution writes UTF-8 JSON only to stdout unless an explicit
`--output` path is supplied.

Audit result: **fit for inventory extraction**. It reads the actual repository
data and does not rely on the documentation summary.

### 2.2 Transform — `scripts/content-v1/transform.ts`

Current output format:

- a camel-case `V1MigrationBundle` data-transfer object;
- `contents`, `relations`, `tags`, `contentTags`, `homeCuration`, `siteCopy`,
  `compatibilityWarnings`, and `issues` collections;
- all 19 records remain in `contents`, including blocked records;
- blocked records retain `growthStage: null` and are never auto-filled.

Current destination assumptions:

- `legacyId` corresponds to unique `contents.legacy_id`;
- the database will generate the V2 UUID primary key;
- V1 public records are migration candidates for lifecycle `Published`;
- Region, Content Type, Detail Level, slug, title, summary, categories, and body
  retain their V1 meaning;
- only explicit Ruins `grewInto` paths become V2 relations;
- V1 content language is selected by a Han-character test and is not
  machine-translated;
- unconfirmed editorial dates stay null;
- `featured` is false and `manualOrder` is null;
- no Home curation or site-copy rows are produced.

Audit result: **deterministic, but not a complete destination import contract**.
It produces migration candidates and warnings, not database rows or writes.

### 2.3 Verify — `scripts/content-v1/verify.ts`

Current verification checks:

- exactly 19 records;
- Region totals of Garden 5, Forest 5, Lake 5, and Ruins 4;
- unique V1 legacy IDs;
- unique Region/slug route identities;
- unique and resolvable migrated relations;
- Ruins as the source of each migrated `grewInto` relation;
- `grewInto` as the only migrated relation type;
- exclusion of blocked records from the importable set.

Known record blockers do not make structural verification fail. Unexpected
counts, duplicates, or relation failures do.

Audit result: **structural verification passes**, but its scope is narrower
than full V2 publication validation. The shared
`validateV1MigrationBundle()` function exists in
`lib/content/validation.ts`, but `verify.ts` does not call it. Before any future
import is authorized, the reviewed bundle must also be checked against the
shared publication requirements for slug, title, summary, body, categories,
Growth Stage, and cover alt text.

### 2.4 Apply/dry-run — `scripts/content-v1/apply.ts`

Despite its filename, the current stage has no database apply implementation.
`npm run content:v1:dry-run` only builds a report.

Current safeguards:

- mode is always `dry-run`;
- default environment is `none`;
- `--preview` changes only the report label and does not enable writes;
- `--execute` is rejected;
- `--production` is rejected;
- no Supabase package, credential, or network request is used;
- optional existing-state input must be a JSON object with a `contents` array;
- content classification uses `contents.legacy_id` as the idempotency key;
- duplicate legacy IDs in the existing snapshot are reported as failures.

Current classification:

- no matching `legacy_id` → `created`;
- matching `legacy_id` with identical compared fields → `unchanged`;
- matching `legacy_id` with differing compared fields → `updated`;
- blocked content → excluded from all three classifications.

Audit result: **safe for local planning only**. The comparison covers content
projection fields, but it does not classify or reconcile tags, content-tag
links, relations, Home curation, or site copy. It also does not detect an
existing Region/slug conflict owned by a different or missing `legacy_id`.
Those gaps must be closed and tested in Preview before duplicate-free database
execution can be claimed.

## 3. V1 to V2 field mapping

The table records current behavior, not a proposed automatic fill policy.

| V1 field/source | Transform field | V2 destination | Current rule |
| --- | --- | --- | --- |
| `ContentItem.id` | `legacyId` | `contents.legacy_id` | Preserve exactly; future V2 UUID remains database-generated. |
| `title` | `titleZh` or `titleEn` | `contents.title_zh` or `contents.title_en` | Place the original string in one language field using the current Han-character test; do not translate. |
| `slug` | `slug` | `contents.slug` | Preserve exactly; uniqueness is Region + slug. |
| `region` | `region` | `contents.region` | Direct mapping; do not infer or change Region. |
| `contentType` | `contentType` | `contents.content_type` | Direct mapping; do not infer a new type. |
| `detailLevel` | `detailLevel` | `contents.detail_level` | Preserve `full` or `short`. |
| no V1 lifecycle field | `lifecycle: "Published"` | `contents.lifecycle` | Existing public V1 items are treated as Published migration candidates. |
| `status` | `growthStage` | `contents.growth_stage` | Preserve only a confirmed V1 value; missing values remain null and block the record. |
| `summary` | `summaryZh` or `summaryEn` | `contents.summary_zh` or `contents.summary_en` | Preserve original text in one detected language field; do not translate. |
| full detail `sections[].title` and `blocks` | `bodyZhMarkdown` or `bodyEnMarkdown` | `contents.body_zh_markdown` or `contents.body_en_markdown` | Convert headings, paragraphs, lists, and note blocks to Markdown without rewriting. |
| short detail `explanation` | `bodyZhMarkdown` or `bodyEnMarkdown` | same body columns | Preserve the explanation as the short Markdown body. |
| detected title/summary/body languages | `contentLanguage` | `contents.content_language` | Current detector produces `zh`, `en`, or `mixed`; it does not synthesize `bilingual`. |
| `categories` | `primaryCategories` | `contents.primary_categories` | Preserve strings and order. |
| `beds`, `trails`, `reflectionType`, `traceType` | none | none separately | Not separately migrated because the source `categories` field is the canonical stored value. |
| `tags` | `tags`, normalized `contentTags` | `tags` and `content_tags` | Trim/lowercase identity and preserve display text; current V1 inventory has no tags. |
| `image` | `cover.path` | `contents.cover_image_path` | Preserve a confirmed path only. No current V1 record has an image. |
| no V1 cover alt fields | `cover.altZh`, `cover.altEn` | cover alt columns | Remain null; any future source cover would require approved alt text before publication. |
| `grewInto` on Ruins | relation source/target legacy IDs, type `grewInto` | `content_relations` after UUID resolution | Resolve only exact internal Garden/Forest/Lake/Ruins routes. Four current paths resolve. |
| `details.relatedPaths` | none | none | Presentation navigation remains outside the relation model. |
| `plantedOn` | currently forced to `publishedAt: null` | `contents.published_at` | No current record supplies a confirmed value; do not use file, Git, or migration time as editorial history. |
| `lastTended` | currently forced to `lastTendedAt: null` | `contents.last_tended_at` | No current record supplies a confirmed value; do not infer. |
| no V1 archive date | `archivedAt: null` | `contents.archived_at` | Direct null for Published candidates. |
| no V1 Featured value | `featured: false` | `contents.featured` | Do not infer Featured status. |
| no V1 manual order | `manualOrder: null` | `contents.manual_order` | Do not infer order. |
| `cta` | none | none | Not a content-row field; covered by the display-overrides compatibility warning. |
| Lake `reason` | none | none separately | Not duplicated because current records repeat the summary. |
| embedded Home data | empty `homeCuration` | `home_curation` | Deferred pending an approved curation decision; do not duplicate Home cards as content. |
| visitor-facing fixed copy | empty `siteCopy` | `site_copy` | Deferred; current extraction is limited to content modules. |

### 3.1 Current relation mapping

| V1 Ruins source | V1 target path | Target legacy ID | V2 type |
| --- | --- | --- | --- |
| `first-version-of-home` | `/garden/building-the-garden` | `building-the-garden` | `grewInto` |
| `portfolio-never-built` | `/lake/the-garden` | `the-garden` | `grewInto` |
| `too-much-interaction` | `/forest/why-exploratory-websites-invite-more-clicks` | `why-exploratory-websites-invite-more-clicks` | `grewInto` |
| `unfinished-continue` | `/forest/why-people-fear-forgetting` | `why-people-fear-forgetting` | `grewInto` |

## 4. Missing and deferred data

### 4.1 Blocking missing field

`growthStage` is required by the V2 database and publication contract. All five
Lake values are absent and must remain unfilled until the Garden Keeper makes an
explicit editorial decision.

### 4.2 Nullable or intentionally absent data

- `publishedAt`, `lastTendedAt`, and `archivedAt` are null;
- tags and content-tag links are empty;
- covers and cover alt text are absent;
- Featured is false;
- manual order is null;
- relation notes are null;
- Home curation is empty;
- site copy is empty.

These are not current record-level dry-run blockers, but they must be reviewed
against the destination contract before import.

### 4.3 Publication timestamp contract conflict

The current migration plan forbids invented historical dates and the transform
sets `publishedAt: null`. The V2 content specification states that Published
content requires a publication timestamp, while the current database schema
allows the column to be null. This is an audit-wide readiness decision, not a
license to use the migration time as a historical date.

Required preparation: approve either a migration-specific nullable timestamp
rule for legacy Published content or provide confirmed source dates. Record the
decision before Preview import design or execution.

## 5. Compatibility warnings

| Code | Current warning | Required preparation |
| --- | --- | --- |
| `home_curation_deferred` | Home curation is empty because known V1 curation conflicts remain deferred. | Review actual Home destinations and approve canonical content references and order separately. |
| `site_copy_deferred` | Site copy is empty because only content modules are extracted. | Inventory approved V1 fixed-copy keys and review them before any site-copy seed. |
| `display_overrides_deferred` | V1 display overrides are not migration records. | Record which CTA or presentation overrides remain code-owned; do not silently store them as content. |
| `related_paths_not_migrated` | Detail `relatedPaths` remain presentation navigation. | Preserve current navigation behavior; migrate only the four explicit Ruins `grewInto` relations. |

## 6. Explicit blocked-record report

No value has been proposed or auto-filled.

| Identifier | Missing field | Required action |
| --- | --- | --- |
| `reverse-1999` | Growth Stage | Garden Keeper must manually choose and approve one allowed V2 Growth Stage; a future authorized migration-input task must record that decision and rerun verification. |
| `jung-and-mandala` | Growth Stage | Garden Keeper must manually choose and approve one allowed V2 Growth Stage; a future authorized migration-input task must record that decision and rerun verification. |
| `the-garden` | Growth Stage | Garden Keeper must manually choose and approve one allowed V2 Growth Stage; a future authorized migration-input task must record that decision and rerun verification. |
| `love-love-love` | Growth Stage | Garden Keeper must manually choose and approve one allowed V2 Growth Stage; a future authorized migration-input task must record that decision and rerun verification. |
| `summer-ghost` | Growth Stage | Garden Keeper must manually choose and approve one allowed V2 Growth Stage; a future authorized migration-input task must record that decision and rerun verification. |

Allowed values are `Seed`, `Sprout`, `Growing`, `Bloom`, and `Dormant`. The audit
does not recommend a value for any record.

## 7. Migration safety rules

### 7.1 Idempotency

- Keep the exact V1 ID as immutable `contents.legacy_id`.
- Require a unique `legacy_id` for every migrated content row.
- A future importer must use reviewed upsert semantics keyed by `legacy_id`,
  not blind insertion.
- Re-running the same reviewed input against the same destination state must
  yield no content changes.
- Idempotency must cover child records as well as `contents`: tag identity,
  content-tag pairs, and relation source/target/type keys.
- Do not treat the current snapshot comparison as proof of database upsert
  idempotency; it is only a deterministic classification test.

### 7.2 Duplicate prevention

- Reject duplicate V1 IDs and duplicate Region/slug identities in source.
- Before a future write, detect destination Region/slug conflicts even when the
  existing row has a different or missing `legacy_id`.
- Reject duplicate existing `legacy_id` values.
- Resolve relation endpoints before writing either endpoint relation.
- Use the database uniqueness constraints for `legacy_id`, Region/slug,
  normalized tag name, content/tag pair, and relation source/target/type as a
  final guard, not as the only preflight check.
- Do not perform a partial 14-record import while five source records remain
  editorially blocked unless a separate migration policy explicitly authorizes
  and documents partial-state handling.

### 7.3 Rollback strategy

Current audit/dry-run rollback:

- no data rollback is necessary because no database write occurs;
- discard generated JSON output if one was intentionally written;
- revert documentation changes if the audit itself is rejected.

Required before a future Preview write:

- export and retain the complete pre-import Preview database state;
- record source commit, schema migration level, input checksum, and expected
  counts;
- define a transaction or batch boundary for content and dependent records;
- document and rehearse the exact restore procedure;
- keep V1 static content available as the public fallback;
- do not design or authorize Production rollback from this audit alone.

### 7.4 Preview requirement

- Resolve all five Growth Stage decisions and the publication-timestamp rule
  before import readiness is reconsidered.
- Review the complete machine-readable bundle before any write.
- Use only the separate Supabase Preview project for the first execution.
- Verify the destination identity and route manifest immediately before write.
- Require an explicit Preview-only authorization; a flag name alone is not
  sufficient environment isolation.
- Keep Production forbidden until Preview import, rerun, rollback rehearsal,
  content comparison, and route verification have all passed.

### 7.5 Content verification

Before and after any future Preview import, verify:

- total 19; Garden 5; Forest 5; Lake 5; Ruins 4;
- every `legacy_id`, Region, slug, Content Type, Detail Level, lifecycle, and
  approved Growth Stage;
- exact original titles and summaries in the selected language fields;
- full and short Markdown body meaning and section completeness;
- primary categories and any reviewed tags;
- exactly four expected `grewInto` relations and no inferred relations;
- cover paths and required alt text, if any cover is later introduced;
- timestamp handling matches the approved legacy rule;
- no Draft, Review, or Archived body is exposed publicly;
- every existing public detail URL resolves in Preview without duplicate cards;
- Home and site-copy behavior remains unchanged until separately approved.

## 8. Import preparation plan

This is a readiness plan only; none of these steps is executed by Task 06A.

1. Obtain a manual, record-by-record Growth Stage decision for the five Lake
   records.
2. Resolve and document the legacy Published timestamp rule without inventing
   dates.
3. Produce and review a frozen migration input plus checksum from a recorded
   source commit.
4. Extend future preflight design to invoke shared publication validation and
   validate destination snapshot shape and Region/slug ownership.
5. Define child-record idempotency and dry-run comparison for relations, tags,
   and content-tag links.
6. Inventory and separately approve fixed taxonomy, Home curation, site copy,
   and display-override decisions.
7. Document the Preview backup, restore, transaction, and acceptance procedure.
8. Only in a separately authorized implementation task, build and test a
   Preview-only execution path. Task 06A does not create it.
9. Run the future Preview dry-run twice: once against the pre-import snapshot
   and once against the expected post-import snapshot; the second run must be
   unchanged and duplicate-free.
10. After a separately authorized Preview import, perform the full content and
    route verification matrix before considering Production preparation.

## 9. Validation evidence

Commands were run from the repository root on `2026-07-17`:

| Command | Result |
| --- | --- |
| `npm run typecheck` | **PASS** — exit 0 |
| `npm run lint` | **PASS** — exit 0, zero warnings allowed |
| `npm run content:v1:dry-run` | **PASS** — exit 0, dry-run mode, environment `none` |

Dry-run summary:

```text
created: 14
updated: 0
unchanged: 0
blocked: 5
failed: 0
warnings: 4
```

No `--execute`, `--preview`, `--production`, `--existing`, or `--output` option
was used. No generated report file or database write was produced.

## 10. Task change manifest

Modified files:

- None.

New files:

- `docs/V2_PHASE_06A_MIGRATION_AUDIT.md`

Migrations created:

- None.
