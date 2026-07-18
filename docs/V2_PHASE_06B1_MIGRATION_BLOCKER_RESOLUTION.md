# The Garden V2 — 06B-1 Migration Blocker Resolution

Task: `06B-1. Migration Blocker Resolution`  
Implementation date: `2026-07-17`  
Scope: migration readiness metadata, validation, and reporting only  
Import executed: **no**  
Current import readiness: **blocked pending manual Growth Stage approvals**

## Outcome

The publication timestamp policy is resolved. The five Growth Stage values are
not available, so each remains in a clear Pending state. No content value,
date, database row, Storage object, lifecycle state, public page, or Admin UI
was written or changed.

Before:

```text
Blocked:
5
```

After:

```text
Resolved:
0

Remaining:
5
```

## `publishedAt` policy audit and decision

Current V1 behavior:

- `ContentItem.plantedOn` is optional, and none of the 19 current records
  supplies it;
- the existing transform deliberately emits `publishedAt: null`;
- file timestamps, Git history, build time, and migration time are not source
  editorial metadata.

V2 behavior:

- the content specification requires a timestamp for ordinary Published
  content;
- the database column is nullable;
- the normal atomic publication path assigns `statement_timestamp()` on first
  publication and preserves it on later publication updates;
- shared publication-field validation currently validates content completeness
  but does not synthesize or validate a historical migration timestamp.

Decision:

- policy ID: `v1-published-at-preserve-null`;
- outcome: preserve null for V1 legacy Published migration candidates;
- approval status: Approved as the Task 06B-1 migration policy;
- resolution source: this report;
- non-null derived or unconfirmed timestamps fail migration-policy validation;
- normal V2 publication timestamp behavior is unchanged.

This narrow exception preserves truthfulness and uses the schema's existing
nullable capability. It is not permission to omit timestamps from newly
published V2 content.

## Growth Stage resolution mechanism

The dry-run accepts an optional read-only JSON approval input:

```text
npm run content:v1:dry-run -- --resolutions=<reviewed-json-path>
```

Shape (placeholders must be replaced by the human approver):

```json
{
  "schemaVersion": 1,
  "kind": "v1-migration-resolution-input",
  "growthStages": [
    {
      "source": "v1-static-typescript",
      "legacyId": "<blocked legacy ID>",
      "route": "/lake/<blocked legacy ID>",
      "growthStage": "<manually chosen allowed value>",
      "decisionMethod": "manual",
      "resolutionSource": "<review record>",
      "approvedBy": "<approver>",
      "approvedAt": "<ISO timestamp>",
      "approvalStatus": "Approved",
      "notes": "<review reason>"
    }
  ]
}
```

Each approved entry must provide:

- the exact blocked `legacyId`;
- `source: "v1-static-typescript"` and the exact `/lake/<legacyId>` route;
- one allowed value: `Seed`, `Sprout`, `Growing`, `Bloom`, or `Dormant`;
- `decisionMethod: "manual"`;
- a non-empty `resolutionSource`;
- a non-empty `approvedBy`;
- a valid `approvedAt` timestamp;
- `approvalStatus: "Approved"`;
- non-empty review notes/reason.

The mechanism never proposes a value. Missing inputs are Pending. Duplicate,
unknown, incomplete, or invalid inputs are Invalid and remain blocked. Approved
values are applied only to the in-memory preview bundle; the V1 content modules
and database are never modified.

## Current blocker report

| Legacy ID | Blocker reason | Resolution source | Approval status |
| --- | --- | --- | --- |
| `reverse-1999` | V1 supplies no Growth Stage; V2 requires a manually approved Growth Stage. | Pending manual input | Pending |
| `jung-and-mandala` | V1 supplies no Growth Stage; V2 requires a manually approved Growth Stage. | Pending manual input | Pending |
| `the-garden` | V1 supplies no Growth Stage; V2 requires a manually approved Growth Stage. | Pending manual input | Pending |
| `love-love-love` | V1 supplies no Growth Stage; V2 requires a manually approved Growth Stage. | Pending manual input | Pending |
| `summer-ghost` | V1 supplies no Growth Stage; V2 requires a manually approved Growth Stage. | Pending manual input | Pending |

## Approval readiness contract

A record is import-ready only when required fields are complete, validation
passes, its blockers are resolved, safeguard checks pass, and its digest is
generated. The complete preview is approval-ready only when every record and
dependent child is ready and there are no global blockers or failures.

Resolution input and publication policy are included in `sourceDigest`.
Resolved content and its audit metadata are included in each `recordDigest` and
the complete `previewDigest`. Any decision change invalidates a prior approval.
Even matching digests cannot approve a blocked preview.

## Safety boundary

- deterministic extract → transform → resolve-in-memory → verify → preview;
- no Supabase client, credentials, network call, or database write path;
- no import implementation;
- `--execute` remains rejected;
- `--production` remains rejected;
- no migrations created.

## Tests added

- unresolved blockers prevent approval;
- one valid manual Growth Stage approval makes its record ready while others
  remain Pending;
- all valid test-only approvals allow whole-preview readiness;
- `publishedAt` preserve-null policy accepts null and rejects an unconfirmed
  timestamp;
- source, record, and preview digests change after resolution;
- execute mode remains rejected and no import path exists.

## Validation

- `npm run typecheck` — pass;
- `npm run lint` — pass with zero warnings;
- `npm run content:v1:dry-run` — pass, 14 ready / 5 blocked / 4
  warnings, Resolved 0 / Remaining 5;
- `npm run test:content-admin` — pass, 136 tests;
- `git diff --check` — pass.
