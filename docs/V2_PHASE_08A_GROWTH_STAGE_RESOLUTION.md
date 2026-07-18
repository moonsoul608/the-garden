# The Garden V2 — 08A Growth Stage Resolution

Task: `08A. Growth Stage Resolution`  
Implementation date: `2026-07-18`  
Scope: migration readiness input, validation, digesting, preview, and reports only  
Import executed: **no**  
Database or Storage writes: **none**  
Public source mode changed: **no**

## Outcome

The migration tooling now has one deterministic, reusable Growth Stage
resolution format at `scripts/content-v1/resolution.json`. It is consumed by
preview, approval digesting, and the existing import executor. The checked-in
file is deliberately empty because no five record-by-record editorial choices
were supplied with this task. No Growth Stage was inferred or generated.

Current operational report:

```text
Before blocked: 5
Resolved: 0
Remaining: 5
Validation: Blocked
```

Acceptance-path report using explicit test-only approvals:

```text
Ready: 19
Blocked: 0
Before blocked: 5
Resolved: 5
Remaining: 0
Validation: Valid
Warnings: 4
```

The test-only value is not content input and is never loaded by the command.
Real readiness changes only after the Garden Keeper reviews and fills all five
records.

## Resolution record

Every approved record must contain:

```json
{
  "source": "v1-static-typescript",
  "legacyId": "<one audited Lake legacy ID>",
  "route": "/lake/<same legacy ID>",
  "growthStage": "<Seed|Sprout|Growing|Bloom|Dormant>",
  "decisionMethod": "manual",
  "resolutionSource": "<review record>",
  "approvedBy": "<reviewer identity>",
  "approvedAt": "<ISO timestamp>",
  "approvalStatus": "Approved",
  "notes": "<review reason>"
}
```

Unknown Growth Stages are rejected through the shared V2 runtime validator.
Unknown or malformed source identities, incomplete metadata, and duplicate
identities remain blocked and are reported as Invalid. Missing records remain
Pending.

## Digest and approval safety

The machine preview includes:

- `resolutionReport.resolutionDigest`;
- `resolutionReport.approvedRecords`;
- `resolutionReport.validationStatus`;
- the five per-record audit results.

Resolution entries are canonicalized before digesting. Reordering an otherwise
equivalent file produces the same output. Changing a stage, note, reviewer,
source, or timestamp changes the resolution, source, record, and preview digest
as applicable. The old approval snapshot then fails unchanged-source or
preview-digest validation.

## Safety boundary

- resolution is applied only to the in-memory migration bundle;
- no import command was run;
- no database schema or data was changed;
- no migration file was created;
- no public page, Admin UI, lifecycle service, Storage policy, or source-mode
  configuration was changed.
