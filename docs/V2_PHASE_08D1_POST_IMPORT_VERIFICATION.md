# The Garden V2 — 08D-1 Post-Import Verification

Task: `08D-1. Post Import Verification`  
Implementation date: `2026-07-19`  
Scope: read-only post-import verification boundary  
Content data modified: **no**  
Import executed: **no**  
Source mode changed: **no**

## Outcome

The existing deterministic migration verifier now contains an explicit fixed
boundary for the completed V1 import. It verifies supplied post-import query
results against the approved Preview and successful import receipt without a
database client or write path.

The boundary does not change content data, execute or replay the import, change
`CONTENT_SOURCE_MODE`, or alter Admin behavior.

## Required invariants

The machine report fails when any of these invariants does not hold:

- the exact approved set of 19 V1 `legacy_id` values exists, with no missing,
  duplicate, or unexpected migration-scoped identities;
- every identity retains its approved Region;
- every expected record exists exactly once with `Published` lifecycle;
- exactly one immutable initial `V1 import` version exists per identity, with
  matching snapshot and migration provenance;
- all four expected relations have resolvable source and target identities,
  exact relation types, and Published endpoints;
- all five Lake Reflection records may preserve `growth_stage = null`, meaning
  Growth Stage is not applicable;
- every non-Lake imported record has a non-null Growth Stage.

These checks supplement the verifier's existing slug, structured metadata,
public-read, tag, Growth Note, and deterministic digest checks.

## Read-only command

The boundary remains available through the existing command:

```bash
npm run content:v1:verify-migration -- \
  --report=<successful-import-result.json> \
  --preview=<approved-preview.json> \
  --queries=<post-import-query-results.json> \
  --output=<verification-report.json>
```

All inputs are JSON files. The command only reads them and optionally writes a
verification report. It has no capability to invoke `execute_v1_import`, edit
content, or switch the public source mode. A failed invariant produces a
non-zero exit code.

## Automated coverage

`tests/content-v1-migration-verification.test.ts` now proves the complete
08D-1 boundary with 19 contents, 19 versions, four relations, five nullable
Lake Reflections, and non-null Growth Stages elsewhere. Negative coverage
includes Region, lifecycle, missing identity, relation target, missing version,
and required Growth Stage failures.

## Change manifest

Modified files:

- `docs/V2_TODO.md`
- `scripts/content-v1/migration-verification.ts`
- `tests/content-v1-migration-verification.test.ts`

New files:

- `docs/V2_PHASE_08D1_POST_IMPORT_VERIFICATION.md`

Migrations created: **none**.

