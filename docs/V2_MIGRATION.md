# The Garden — Version 2 Migration Plan

## 1. Purpose

This document defines how The Garden moves from the stable Version 1 static-content implementation to the Version 2 database-backed Garden Keeper system.

Migration must be gradual.

The public Version 1 site must remain stable until the Version 2 replacement path has passed acceptance.

### Phase 03C tooling foundation

Phase 03C provides deterministic migration tooling only. It does not import content and contains no database client or write path.

Requirements:

- Node.js 22.6 or newer, with native TypeScript type stripping;
- run commands from the repository root;
- treat generated JSON as sensitive migration input and review it before any future Preview execution.

Commands:

```bash
npm run content:v1:extract
npm run content:v1:transform
npm run content:v1:verify
npm run content:v1:dry-run
```

Each command emits UTF-8 JSON to standard output. Use `--output=<path>` to write clean machine-readable JSON without the `npm run` banner:

```bash
npm run content:v1:extract -- --output=tmp/v1-extract.json
npm run content:v1:transform -- --output=tmp/v1-bundle.json
npm run content:v1:verify -- --output=tmp/v1-verification.json
npm run content:v1:dry-run -- --output=tmp/v1-dry-run.json
```

The default apply command is always a dry-run. `--preview` only records the intended future environment; it does not enable writes:

```bash
npm run content:v1:dry-run -- --preview --output=tmp/v1-preview-dry-run.json
```

To test idempotency classification without connecting to a database, provide a reviewed JSON snapshot whose root contains a `contents` array. Rows may use migration camel-case fields or database snake-case fields:

```bash
npm run content:v1:dry-run -- --existing=tmp/existing-preview.json --output=tmp/v1-comparison.json
```

The comparison key is `contents.legacy_id`. Matching records are classified as `unchanged`; differing records as `updated`; absent records as `created`. These are planned dry-run outcomes, not completed writes.

### Extract manifest format

`extract.ts` imports the existing TypeScript modules at runtime. It does not read or parse TypeScript source text.

```json
{
  "schemaVersion": 1,
  "source": "v1-static-typescript",
  "garden": [],
  "forest": [],
  "lake": [],
  "ruins": [],
  "details": {}
}
```

Arrays retain source order. No timestamp, filesystem metadata, or random identifier is added, so the same source modules produce byte-stable formatted JSON.

### Migration bundle format

```json
{
  "schemaVersion": 1,
  "source": "v1-static-typescript",
  "status": "blocked",
  "contents": [],
  "relations": [],
  "tags": [],
  "contentTags": [],
  "homeCuration": [],
  "siteCopy": [],
  "compatibilityWarnings": [],
  "issues": []
}
```

The current V1 bundle contains all 19 source records but is `blocked` because all five Lake records have no confirmed Growth Stage. Those records remain visible in the manifest with `growthStage: null`; they are excluded from the dry-run importable set. Growth Stages are never guessed. Task 06B-1 adds a separate manual resolution input; absent approvals remain explicitly Pending.

Current intentional empty collections:

- `tags` and `contentTags`, because V1 defines no tags;
- `homeCuration`, because curation conflicts are deferred;
- `siteCopy`, because this phase extracts content modules only and display overrides are deferred.

Only the four explicit Ruins `grewInto` values become relations. `details.relatedPaths` remain presentation navigation.

### Verification and report format

Verification checks exactly 19 records; Region counts of Garden 5, Forest 5, Lake 5, and Ruins 4; unique `legacy_id`; unique Region/slug; relation resolution; and exclusion of blocked content. Known blocked records do not make structural verification fail. Unexpected counts, duplicates, or unresolved relations do.

The dry-run report is JSON and always includes:

```json
{
  "mode": "dry-run",
  "environment": "none",
  "idempotencyKey": "contents.legacy_id",
  "created": [],
  "updated": [],
  "unchanged": [],
  "blocked": [],
  "failed": [],
  "warnings": [],
  "summary": {}
}
```

`blocked` contains content that must not be written. `failed` contains structural, snapshot, or safeguard failures. `warnings` reports every deferred compatibility decision.

### Tooling safeguards

- Default and `--preview` modes are dry-run only.
- `--execute` is rejected because Preview writes are not implemented in this phase.
- `--execute` without `--preview` is also rejected.
- `--production` is always rejected.
- The tooling imports no Supabase package, reads no credentials, and performs no network requests.
- Dates remain null unless a source date is confirmed.
- Slugs and `legacy_id` values are preserved exactly.
- Missing tags, covers, dates, copy, and Growth Stages are not synthesized.
- Re-running against the same reviewed snapshot is deterministic and uses `contents.legacy_id` for idempotency classification.

### Phase 03C rollback

Phase 03C has no data rollback because it performs no database writes. Rollback consists of reverting the tooling and discarding generated JSON reports. Content source modules, application routes, database schema, and Supabase policies remain unchanged. Future Preview execution must add a pre-run Preview backup/export and a post-run restore procedure before any write path is enabled.

### Phase 06B import preview contract

Phase 06B keeps the same write-free extract → transform → verify pipeline and
adds `scripts/content-v1/preview.ts` as the reusable server-side preview
boundary. `apply.ts` remains a dry-run command wrapper and has no import
execution implementation.

The preview contains one typed record for every V1 item, including:

- immutable source `legacyId` and route identity;
- deterministic preview and destination import identities;
- Region, Content Type, and target lifecycle;
- `Create`, `Update`, `Unchanged`, or `None` planning;
- `Ready`, `Blocked`, or `Warning` validation state;
- exact blockers with the required field, reason, and manual action;
- preserved compatibility warnings;
- child readiness for relations, tags, and content-tag links.

Validation combines structural verification with the shared V2 publication
contract. It checks required publication fields, Growth Stage, source and
destination Region/slug uniqueness, legacy identity duplication, lifecycle
compatibility, relation integrity, and child readiness. Values are never
generated or inferred.

The dry-run writes the human report to stderr and machine-readable JSON to
stdout. `--output=<path>` writes only the JSON snapshot to the requested file.
The default audited summary remains 14 planned creates, five blocked Lake
records, and four compatibility warnings. Its resolution report states Before:
Blocked 5; After: Resolved 0, Remaining 5. A manually supplied, valid approval
changes only its named record and the digest-covered preview state.

Every preview contains SHA-256 digests for the source state, normalized
destination state, and complete preview. The future execution input contract
must contain an explicitly approved preview snapshot with the same three
digests. A changed source, changed destination state, or mismatched preview
digest invalidates approval. Phase 06B validates that contract only; it does
not approve or execute an import.

### Phase 06B-1 blocker-resolution contract

The legacy publication timestamp policy is `v1-published-at-preserve-null`.
Current V1 records contain no confirmed `plantedOn` values, so legacy Published
candidates preserve `publishedAt: null`. This is a migration-only exception:
normal V2 publication still assigns its transaction timestamp. File times, Git
history, build time, preview time, and future import time are forbidden as
substitute editorial dates. A non-null unconfirmed value fails policy
validation.

Growth Stage resolutions are accepted only from a separate JSON input passed
with `--resolutions=<path>`. Each decision must name one of the five audited
legacy IDs, contain one allowed Growth Stage, declare `decisionMethod:
"manual"`, and include a non-empty resolution source, approver, approval time,
and `approvalStatus: "Approved"`. Missing, duplicate, unknown, incomplete, or
invalid decisions do not fill content and remain blocked with audit metadata.

The preview exposes record digests and `importReady` state. Whole-preview
approval readiness requires complete required fields, passing verification,
zero record/global/child blockers, zero safeguard failures, and generated
digests. `validateV1ApprovedPreviewSnapshot()` rejects a matching approval
snapshot while any readiness condition is false. The command remains a dry run;
`--execute` and `--production` remain rejected by the dry-run command.

### Phase 06C import execution contract

Phase 06C adds a separate server/script-only execution command. It does not
change `apply.ts`, public source mode, routes, Admin UI, lifecycle services,
Storage policies, or V1 source content.

Execution requires all of the following:

- `--execute` and `--preview`;
- `--approval=<path>` containing the explicit 06B approved-snapshot envelope;
- `--digest=<sha256>` matching the approved preview digest;
- `--resolutions=<path>` containing the exact manual Growth Stage input used
  to generate the approved preview;
- `NEXT_PUBLIC_SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY` for the
  Preview project;
- the Phase 06C database migration already applied.

Example, after a Garden Keeper has supplied real approvals and approved the
resulting preview:

```bash
npm run content:v1:import -- \
  --execute \
  --preview \
  --approval=tmp/v1-approved-preview.json \
  --digest=sha256:<approved-preview-digest> \
  --resolutions=tmp/v1-growth-stage-resolutions.json \
  --output=tmp/v1-import-result.json
```

The script regenerates the source state and reads a fresh destination snapshot
before calling one service-role-only RPC. A missing or incomplete approval,
explicit digest mismatch, source change, destination change, unresolved
blocker, duplicate identity, duplicate relation, missing relation endpoint, or
existing unreceipted migration identity rejects the import before commit.

`execute_v1_import(jsonb)` owns the database transaction. It creates all 19
content projections, valid tags and associations, valid relations, approved
structured Growth Notes when present, and exactly one immutable initial
version per content. Current V1 supplies no structured Growth Note rows; its
sections named “Growth notes” remain in the preserved Markdown body, and no
note text or historical timestamp is invented. Initial version snapshots
retain the V1 `legacyId`, source version, source/import digests, and manual
Growth Stage resolution provenance.

The transaction verifies content count, Region/slug uniqueness, relation
integrity, Published lifecycle validity, and initial-version count before it
writes an immutable import receipt. Any validation or insert failure rolls the
whole statement back. A repeated call with the same import digest returns the
stored result with `idempotent: true` and creates no content, version,
relation, tag, or receipt duplicate.

The machine result contains the import digest, technical import timestamp,
source version, created identities, skipped identities, warnings, and
verification result. The human report prints created content/version/relation
counts, skipped records, warnings, and verification status. Neither path
performs public cutover.

Implementation and rollback-only tests exist, but no Preview import was run in
Phase 06C because the five real Lake Growth Stage approvals and an approved
snapshot were not supplied. The migration and SQL integration test must be
applied and run against the real Preview database before execution evidence is
claimed.

### Phase 06D migration verification contract

Phase 06D adds a deterministic, read-only verification boundary after import.
It does not execute an import, update migrated content, change public source
mode, alter routes, delete V1 data, or write to the database.

The command accepts three JSON inputs:

- `--report=<path>`: the immutable Phase 06C `v1-import-result` receipt;
- `--preview=<path>`: the exact approved `v1-import-preview` snapshot;
- `--queries=<path>`: a migration-scoped
  `v1-migration-verification-query-results` read snapshot.

The query snapshot contains V2 content, initial versions, relations, tags,
content-tag bindings, Growth Notes, and public-service read probes. Content and
child rows must be scoped to the migration identities. Public probes are
collected through the unchanged content service and cover every migrated
Published record plus Archived, Draft, and Review control records. Missing
control coverage produces `WARNING`; observed lifecycle incompatibility
produces `FAIL`.

Run verification after a real approved Preview import and after collecting the
read-only query snapshot:

```bash
npm run content:v1:verify-migration -- \
  --report=tmp/v1-import-result.json \
  --preview=tmp/v1-approved-preview.json \
  --queries=tmp/v1-v2-query-results.json \
  --output=tmp/v1-migration-verification.json
```

Verification checks total, Region, and Content Type counts; missing, duplicate,
and unexpected identities; slug, Region, lifecycle, Growth Stage, and complete
structured-record digests; blocked-record exclusion; one immutable initial
version and complete migration provenance per item; relation count, targets,
orphans, and lifecycle validity; tags, content-tag bindings, and Growth Notes;
and Published/Archived/Draft/Review public-read behavior.

The machine report contains `PASS`, `FAIL`, or `WARNING`, a deterministic SHA-256
verification digest, the query-capture timestamp, section summaries, and every
check performed. The human report prints the same section outcomes and all
non-passing findings. A `FAIL` exits non-zero. Warnings are preserved without
being promoted into invented content.

The implementation and fixture tests exist, but no real Preview verification
report was generated in Phase 06D because Phase 06C has not been executed.

### Phase 06E cutover preparation contract

Phase 06E prepares cutover without changing Production behavior. It adds an
ordered, deterministic readiness gate and the operator runbook in
`docs/V2_PHASE_06E_CUTOVER_PREPARATION.md`. It does not import content, change
`CONTENT_SOURCE_MODE`, alter public routes or the content service, delete V1
content, write database data, or create a database migration.

The readiness gate covers data, application, operational, and safety evidence.
Every check is blocking. A Phase 06D `FAIL` always blocks cutover. A `WARNING`
also blocks cutover until its exact findings receive explicit operator
acceptance; acceptance does not convert or hide those findings.

Forward source-mode transitions are strictly ordered:

```text
legacy -> dual -> database
```

`legacy -> database` is forbidden. Entry to `dual` requires every readiness
check and an approved cutover window. Entry to `database` additionally requires
an accepted stability period, zero legacy fallback use, healthy monitoring,
reverified parity, and explicit final approval. These rules prepare a future
operator decision only; Phase 06E performs neither transition.

Any verification regression, public-read failure, redirect/404 regression,
duplicate or discovery mismatch, private/Archived exposure, database outage,
cache incoherence, or operator stop decision requires rollback. Rollback
restores `legacy` mode, preserves imported V2 data and the V1 fallback, and
invalidates public caches. Incident response must not delete V2 or V1 data.

The current cutover assessment remains **BLOCKED** because a real approved
preview, Preview import receipt, Phase 06D report, Production backup evidence,
monitoring evidence, and cache-invalidation readiness have not been supplied.
Existing resolver, lifecycle, and redirect contract tests are supporting
evidence only; real Preview route and public-read probes remain required.

---

## 2. Migration principles

1. Do not rebuild from zero.
2. Do not overwrite Version 1 documents.
3. Preserve all existing public URLs.
4. Preserve all confirmed public content.
5. Do not invent missing personal content.
6. Use Preview/Staging before Production.
7. Use a separate Preview Supabase project.
8. Keep a temporary static fallback during cutover.
9. Make migration repeatable and idempotent.
10. Remove legacy content files only after explicit acceptance.

---

## 3. Version 1 source inventory

### 3.1 Public routes

- `/`
- `/garden`
- `/forest`
- `/lake`
- `/ruins`
- `/greenhouse`
- `/index`
- `/search`

### 3.2 Detail routes

- `/garden/[slug]`
- `/forest/[slug]`
- `/lake/[slug]`
- `/ruins/[slug]`

### 3.3 API

- `POST /api/seed-gardener`

### 3.4 Initial content

Garden:

1. `building-the-garden`
2. `learning-psychological-statistics`
3. `exploring-ai-tools`
4. `python-starting-from-the-basics`
5. `designing-better-slides-and-documents`

Forest:

- preserve all five existing Version 1 slugs and content records.

Lake:

- preserve all five existing Version 1 slugs and content records.

Ruins:

- preserve all four existing Version 1 slugs and content records.

Total:

- 19 content items.

The migration script must read the actual repository data rather than relying only on this summary.

---

## 4. Known Version 1 implementation differences

The migration audit must explicitly record differences between documents and actual code.

Known examples include:

- Version 1 TODO does not reflect completed implementation.
- Home curation is partly embedded directly in the Home page.
- `Exploring AI Tools` is implemented as Garden content.
- “继续吗” Home links currently resolve to the existing Forest memory Question rather than an independent content record.
- some visitor-facing copy differs from the original Version 1 content document.
- current content data does not consistently use all planned date fields.
- Search and Garden Index overlap.
- some Region hero navigation patterns are inconsistent.

Migration must preserve actual working behavior unless a frozen V2 decision intentionally changes it.

“继续吗” content identity is not redesigned by this migration. Preserve the current working link behavior until a separately approved content decision changes it.

---

## 5. Target architecture

```text
Public pages / Admin
          ↓
     Content service
          ↓
 Validation + authorization
          ↓
       Supabase
```

Temporary transition:

```text
Database content
      +
Legacy static content fallback
          ↓
     Content service
          ↓
       Public pages
```

Final:

```text
Supabase
   ↓
Content service
   ↓
Public pages + Garden Keeper
```

---

## 6. Environment strategy

### 6.1 Preview

- V2 branch
- Vercel Preview
- Supabase Preview
- test GitHub OAuth callback
- test Storage bucket
- test DeepSeek configuration

### 6.2 Production

- `main`
- Vercel Production
- Supabase Production
- production GitHub OAuth callback
- production Storage bucket
- production DeepSeek key

Preview and Production credentials must never be mixed.

---

## 7. Migration stages

# Stage 0 — Freeze and inventory

Tasks:

- record current `main` commit;
- record current deployment URL;
- record current environment-variable names;
- record all public routes;
- record all 19 item IDs and slugs;
- record current metadata;
- record current Home curation;
- record current redirects/rewrites;
- record current tests;
- export current static content to a machine-readable snapshot.

Output:

- migration inventory;
- route manifest;
- content manifest;
- baseline screenshots or visual QA notes;
- known-difference report.

No public code behavior changes in this stage.

---

# Stage 1 — Build Preview data foundation

Tasks:

- create Supabase Preview;
- apply schema;
- apply RLS;
- create cover bucket;
- configure GitHub OAuth;
- add environment validation;
- add content service interfaces;
- keep public reads on Version 1 static data.

Acceptance:

- Preview infrastructure works;
- Production unaffected;
- no public route changed.

---

# Stage 2 — Build idempotent import

The import must:

- use stable unique source keys;
- upsert rather than blindly insert;
- report created, updated, skipped, and failed records;
- avoid duplicate relations;
- preserve slug;
- preserve Region;
- preserve Content Type;
- preserve Detail Level;
- preserve Growth Stage;
- preserve existing summaries and bodies;
- preserve current Home destination links;
- transform Ruins `grewInto` into a relation;
- seed confirmed fixed taxonomy;
- seed current approved site copy;
- never invent missing fields.

For missing dates:

- do not invent historical dates;
- use nullable fields;
- add a migration note where required;
- set technical import timestamps separately from content dates.

Acceptance:

- re-running import creates no duplicate content;
- all 19 items present;
- all expected routes resolvable.

---

# Stage 3 — Add dual-read content service

Create one public content-service interface.

During transition:

1. read database record when migrated and valid;
2. use static fallback only when the database record is unavailable;
3. log fallback use in Preview;
4. never show duplicate items;
5. keep the same public shape for page components.

Recommended migration marker:

- `source = database | legacy`
- internal only, not visitor-facing.

Acceptance:

- Region pages can render mixed sources without duplicates;
- detail routes resolve correctly;
- Index and Search remain stable;
- fallback use is measurable.

---

# Stage 4 — Migrate public reads in Preview

Order:

1. Garden content
2. Forest content
3. Lake content
4. Ruins content
5. detail pages
6. Home curation
7. Garden Index
8. Search compatibility
9. metadata and sitemap

For each area:

- compare item count;
- compare title;
- compare summary;
- compare route;
- compare status;
- compare CTA destination;
- compare full/short detail behavior;
- run mobile and keyboard checks.

Do not migrate all public reads in one unverified change.

---

# Stage 5 — Build Garden Keeper against Preview data

Garden Keeper becomes the only supported routine write path.

Required Preview proof:

- create Draft;
- autosave;
- move to Review;
- publish;
- edit Published content;
- add Growth Note;
- add relation;
- upload cover;
- create version;
- restore version;
- archive;
- restore archive;
- delete an archived test item;
- generate preview token;
- revoke preview token;
- manage Home curation;
- edit approved site copy;
- edit approved Greenhouse prompt;
- review notes;
- view analytics.

Do not enable Production writes until Preview acceptance.

---

# Stage 6 — Greenhouse Draft handoff

Keep the existing public generation response.

Add explicit Draft handoff.

Rules:

- anonymous Greenhouse use does not silently create admin Drafts;
- an authorized explicit action creates Draft;
- source idea and generated structure are preserved;
- Garden Keeper edits before Review;
- publication remains manual.

Acceptance:

- existing Greenhouse tests pass;
- Draft handoff test passes;
- anonymous spam path is not introduced.

---

# Stage 7 — Production preflight

Before Production import:

- back up repository state;
- export V1 static data snapshot;
- back up Supabase Production;
- verify Production schema version;
- verify RLS;
- verify Storage policy;
- verify OAuth;
- verify administrator allow-list;
- verify Vercel environment variables;
- verify DeepSeek key;
- verify Preview acceptance report;
- prepare rollback switch to static reads.

Use a short content-edit freeze during the final import and verification window.

---

# Stage 8 — Production import

Run the same idempotent migration used in Preview.

Required checks immediately after import:

- total = 19;
- Garden = 5;
- Forest = 5;
- Lake = 5;
- Ruins = 4;
- every slug matches baseline;
- every public URL resolves;
- all full details render;
- all short details render;
- Home destinations resolve;
- relations resolve;
- no Draft is public;
- no Archived item appears in discovery.

Do not switch all public reads until these checks pass.

---

# Stage 9 — Production dual-read cutover

Enable database-first reads with static fallback.

Monitor:

- content lookup failures;
- fallback count;
- route 404s;
- duplicate result reports;
- metadata mismatches;
- Search/Index mismatches;
- Greenhouse failures;
- admin authorization failures.

Keep the fallback until a defined stability period and explicit approval.

---

# Stage 10 — Enable Production Garden Keeper

Enable:

- GitHub login;
- Draft creation;
- Review;
- publishing;
- archive;
- version history;
- cover uploads;
- Growth Notes;
- relations;
- Home curation;
- site copy settings;
- Greenhouse settings;
- visitor notes;
- analytics.

Run a Production smoke content workflow using a temporary Draft.

Do not publish invented test content publicly.

---

# Stage 11 — Remove duplicate public implementations

After the merged Garden Index is accepted:

- make `/index` canonical;
- preserve `/search`;
- preserve query parameters;
- remove duplicate Search component logic;
- update TopBar;
- update Garden Guide;
- update tests.

After Home curation is accepted:

- remove hard-coded duplicate Home content metadata;
- keep presentation structure;
- read canonical content references.

---

# Stage 12 — Legacy fallback retirement

Retire static fallback only when all conditions are met:

- no fallback use in accepted Production period;
- all 19 records verified;
- Garden Keeper routine publishing verified;
- Search/Index verified;
- Home curation verified;
- metadata verified;
- sitemap verified;
- accessibility verified;
- rollback backup available;
- explicit approval given.

Then:

- remove legacy content imports from runtime;
- preserve a static export or migration fixture for historical recovery;
- do not delete Version 1 documentation;
- update README.

---

## 8. Data-mapping rules

### 8.1 Identity

Version 1 `id` and `slug` should remain stable where possible.

If a new UUID is used as database primary key:

- retain the V1 ID in a stable `legacy_id` or import key;
- relations must use the new stable internal ID;
- URLs continue to use the original slug.

### 8.2 Region and Content Type

Map directly.

Do not infer a new Region or Content Type during migration.

### 8.3 Growth Stage

Map the existing manual status.

Do not calculate a new stage from age or detail length.

### 8.4 Lifecycle

All current public Version 1 items migrate as:

- `Published`

unless the actual implementation clearly marks an item as non-public.

### 8.5 Dates

Use actual confirmed dates only.

Do not treat:

- Git commit date;
- file modification date;
- migration date

as a historical planted or tended date unless explicitly approved.

Technical timestamps may be stored separately.

### 8.6 Bilingual fields

Map current title and summary into the language field matching the actual content.

Do not create machine translations during migration.

### 8.7 Body

Preserve current rendered meaning.

Conversion to Markdown must not:

- omit sections;
- invent new prose;
- expose internal comments;
- render component names.

### 8.8 Relations

Convert only explicit Ruins `grewInto` values when their target can be resolved safely.

Do not infer relations from shared categories.

Version 1 detail `relatedPaths` remain presentation navigation and are not migrated as relations.

### 8.9 Home

Convert Home items into curation references.

Do not create duplicate content records for Home cards.

---

## 9. URL migration

### 9.1 Unchanged content

No redirect required.

### 9.2 Region change

If later approved:

- create new Region route;
- create permanent redirect from old route;
- store migration record;
- verify Search, Index, Home, relations, sitemap, and saved local links;
- do not change without explicit content approval.

### 9.3 Archive

- keep route;
- show resting-state page;
- `noindex`;
- exclude from sitemap and discovery.

### 9.4 Delete

- route becomes 404/Gone;
- do not redirect unrelated content;
- do not reuse slug automatically.

---

## 10. Rollback plan

Rollback must remain possible during migration.

### 10.1 Before database-first cutover

Rollback:

- disable database reads;
- return to static Version 1 content;
- leave imported data intact for diagnosis.

### 10.2 After dual-read cutover

Rollback:

- switch content-service feature flag to legacy-first or legacy-only;
- disable Garden Keeper writes if data integrity is uncertain;
- preserve Production database snapshot;
- do not delete content during incident response.

### 10.3 After fallback retirement

Rollback source:

- database backup;
- JSON export;
- preserved migration fixture;
- Git repository;
- Vercel deployment history.

Document the exact feature flag or deployment procedure before Production cutover.

---

## 11. Migration validation

### Content checks

- 19 total items;
- correct Region counts;
- correct slugs;
- correct titles;
- correct summaries;
- correct statuses;
- correct detail levels;
- correct body sections;
- correct related destinations.

### Route checks

- all main routes;
- all detail routes;
- `/index`;
- `/search`;
- `/greenhouse`;
- `/api/seed-gardener`;
- archived test route;
- deleted test route;
- preview route;
- admin route.

### Privacy checks

- Draft not public;
- Review not public;
- visitor notes private;
- analytics admin-only;
- service role not client-side;
- preview token cannot edit;
- non-admin denied.

### UX checks

- Home unchanged until approved upgrade;
- Garden Guide works;
- Path Back works;
- mobile layout works;
- keyboard works;
- focus visible;
- reduced motion works;
- no horizontal overflow.

### SEO checks

- old URLs stable;
- metadata valid;
- Open Graph valid;
- sitemap excludes non-public routes;
- archived and preview noindex.

---

## 12. Migration completion record

At completion, append:

- Production migration date;
- source commit;
- target commit;
- schema version;
- imported counts;
- redirect count;
- fallback removal date;
- known limitations;
- backup locations;
- final acceptance result.

Do not mark migration complete while the runtime still depends on undocumented fallback behavior.
