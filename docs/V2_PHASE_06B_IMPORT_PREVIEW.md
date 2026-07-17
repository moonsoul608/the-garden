# The Garden V2 — 06B Import Preview System

Task: `06B. Import Preview System`  
Implementation date: `2026-07-17`  
Scope: local preview, validation, reporting, and future approval contract only  
Import readiness: **blocked**

## Outcome

The V1 migration tooling now produces a deterministic typed preview without
connecting to Supabase or writing database, Storage, public content, routes, or
Admin state.

Current preview:

```text
Migration Preview:

Ready:
14

Blocked:
5

Warnings:
4
```

The five Lake records remain blocked because `growthStage` is absent. The
preview does not suggest or generate a value. Each blocker names the field,
explains the V2 requirement, and requires an explicit Garden Keeper decision.
The unresolved legacy `publishedAt` policy is also exposed as a global approval
blocker: confirmed dates or an explicitly approved migration-specific nullable
rule are still required. It does not change the five-record blocker count.

## Preview boundary

`scripts/content-v1/preview.ts` is the reusable server-side preview service. It
calls the existing extractor, transformer, and verifier. Verification now also
invokes the shared publication validation contract, so publication rules are
not duplicated in migration code.

The service accepts an optional read-only destination snapshot for planning.
It classifies every ready record as `Create`, `Update`, or `Unchanged`, and uses
`None` for blocked records. It never accepts a database client and exposes no
write method.

## Validation coverage

The preview checks:

- required title, summary, body, slug, category, Growth Stage, and cover alt;
- target Published lifecycle requirements;
- source duplicate legacy IDs and Region/slug pairs;
- destination duplicate legacy IDs and Region/slug ownership conflicts;
- incompatible existing Draft, Review, or Archived lifecycle state;
- supported, unique, resolvable relations;
- relation endpoint readiness;
- tag and content-tag identity and duplicate readiness.

One child relation currently waits for the blocked Lake record `the-garden`.
That dependency is reported separately and does not invent an extra
record-level blocker; the audited content summary remains 14 ready and five
blocked.

## Output contracts

Each record includes:

- source identity;
- destination identity and existing-content detection;
- deterministic preview and destination IDs;
- Region and Content Type;
- Published lifecycle target;
- planned operation;
- validation status;
- blockers and warnings.

The CLI emits the human report on stderr and JSON on stdout. An explicit
`--output` path writes the machine-readable preview file. No preview file is
created by default.

## Approval boundary

Every preview includes:

- `sourceDigest`;
- `destinationStateDigest`;
- `previewDigest`;
- an approval contract requiring an approved snapshot, matching digest,
  unchanged source state, and unchanged destination state.

The preview generates the digest reference, while the separate
`V1ApprovedPreviewSnapshot` type requires an explicit `approved: true` marker.
`validateV1ApprovedPreviewSnapshot()` defines the future execution preflight. A
missing approval marker or a source, destination, or preview change invalidates
the approval. The preview service cannot approve or execute an import.

## Safety

- no database client or credentials;
- no network calls;
- no insert, update, upsert, delete, or migration apply path;
- `--execute` remains rejected;
- `--production` remains rejected;
- supplied destination snapshots are not mutated;
- compatibility warnings are preserved exactly.

## Validation

- `npm run typecheck` — pass;
- `npm run lint` — pass with zero warnings;
- `npm run content:v1:dry-run` — pass, 14 create / 5 blocked / 4 warnings;
- `npm run test:content-admin` — pass, 131 tests;
- `git diff --check` — pass;
- no database content, public content, lifecycle service, Admin UI, route,
  Storage, or migration file was changed.

## Files

Modified files:

- `docs/V2_MIGRATION.md`
- `docs/V2_TODO.md`
- `package.json`
- `scripts/content-v1/apply.ts`
- `scripts/content-v1/verify.ts`
- `types/content.ts`

New files:

- `docs/V2_PHASE_06B_IMPORT_PREVIEW.md`
- `scripts/content-v1/preview.ts`
- `tests/content-v1-preview.test.ts`

Migrations created:

- None.
