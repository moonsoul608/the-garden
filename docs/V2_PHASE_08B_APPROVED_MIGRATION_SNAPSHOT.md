# The Garden V2 — 08B-1 Regenerated Approved Migration Snapshot

Task: `08B-1 Regenerate Approved Migration Snapshot`
Implementation date: `2026-07-18`
Scope: migration preview and approval artifacts only
Import executed: **no**
Database or Storage writes: **none**
Public source mode changed: **no**

## Outcome

The migration preview and approved snapshot were regenerated after the 08A-2
Growth Stage applicability correction.

- Preview: 19 ready, 0 blocked, 4 existing compatibility warnings.
- Approved snapshot: `READY` / `Approved`, 19 records, 0 blockers.
- Five Lake Reflections preserve `growthStage: null`.
- The checked-in resolution input remains empty; no Growth Stage resolution was
  created or required.
- Four explicit Ruins `grewInto` relations remain frozen in the snapshot.

Generated artifacts:

- `tmp/v1-preview-08b1.json`
- `tmp/v1-approved-snapshot-08b1.json`

## Lake Reflection exception

Growth Stage is required for Garden Seeds, Forest Questions, and Ruins Traces.
It is optional for Lake Reflections. A null Lake Reflection Growth Stage means
`not growth-tracked / not applicable`; it is not missing editorial data and is
not a new Growth Stage enum value.

Therefore the five Lake nulls need no manual resolution. Creating Seed or any
other stage for them would invent an editorial decision and would destroy the
meaning of the source state. The snapshot preserves both
`sourceRecord.growthStage: null` and `resolvedGrowthStage: null`, with
`growthStageResolution: null`.

## Validation policy and invalidation

Snapshot format version 2 binds the approval to validation policy
`v1-migration-validation-08b1` and applicability policy
`v1-growth-stage-applicability-08a2`. The schema digest covers source schema
version 1, preview schema version 1, approved-snapshot version 2, and the full
validation-policy descriptor.

An artifact is `READY` only when all five frozen checks are true:

- blockers are zero;
- Preview validation and import readiness pass;
- schema compatibility passes;
- Growth Stage applicability passes;
- preview, resolution, source, destination-state, and schema digests match.

Old snapshot-format artifacts are rejected. A policy version change,
applicability declaration change, validation-rule change, schema-digest change,
or preview-digest change invalidates approval even when source records are
otherwise unchanged.

## Migration provenance

The snapshot records:

- migration task `08B-1` and generator `content:v1:approve-snapshot`;
- source mode `v1-static-typescript`, source schema version 1, and all 19 source
  records;
- deterministic destination identity and planned operation per record;
- nullable Lake state and its explicit non-applicability meaning;
- relations, child metadata collections, published-at policy, and warnings;
- approval timestamp `2026-07-18T08:00:00.000Z`;
- preview, resolution, source, destination-state, schema, and snapshot digests.

Regenerated digests:

- Preview: `sha256:a7562655a6448f6716c830cfc1ad582c6b13b76f686db8b4136fe730707b0a81`
- Schema: `sha256:ace8b82a1fc1cea8e5792c761f047567e0d2cd3eed6299b27d820c10414b18bb`
- Snapshot: `sha256:8351754863f97bdfb4bb92c3359cad14bbf621dc229d5941b37cabe5f6baec0f`

## Regeneration commands

```bash
npm run content:v1:dry-run -- \
  --preview \
  --resolutions=scripts/content-v1/resolution.json \
  --output=tmp/v1-preview-08b1.json

npm run content:v1:approve-snapshot -- \
  --preview=tmp/v1-preview-08b1.json \
  --resolutions=scripts/content-v1/resolution.json \
  --created-at=2026-07-18T08:00:00.000Z \
  --output=tmp/v1-approved-snapshot-08b1.json
```

If a reviewed destination snapshot is later supplied, the same `--existing`
file must be passed to both commands; that produces a different
destination-state, preview, and approved-snapshot digest.

## Safety boundary

- no import command was run;
- no database, Storage, public UI, Admin UI, or source-mode change was made;
- no Growth Stage value or resolution was synthesized;
- no migration file was created for 08B-1.
