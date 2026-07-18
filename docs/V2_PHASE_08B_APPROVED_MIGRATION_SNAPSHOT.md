# The Garden V2 — 08B Approved Migration Snapshot

Task: `08B. Approved Migration Snapshot`  
Implementation date: `2026-07-18`  
Scope: approval artifact generation, validation, reporting, and import preflight  
Import executed: **no**  
Database or Storage writes: **none**  
Public source mode changed: **no**

## Outcome

Migration approval now has a complete machine-readable boundary instead of a
digest-only marker. An approved snapshot freezes the exact source records,
destination mappings, resolved Growth Stages and audit metadata, relations,
child metadata, warnings, and all source, destination, resolution, preview, and
snapshot digests required by import preparation.

The checked-in Growth Stage resolution input is still intentionally empty, so
the current real snapshot status is `BLOCKED`. This task did not create a false
`Approved` artifact and did not choose any editorial Growth Stage. The approval
path is covered with explicit test-only resolutions.

## Snapshot command

First generate the exact Preview report to be reviewed:

```bash
npm run content:v1:dry-run -- \
  --preview \
  --resolutions=scripts/content-v1/resolution.json \
  --output=tmp/v1-preview.json
```

After review, generate the approval artifact with an explicit ISO approval
timestamp:

```bash
npm run content:v1:approve-snapshot -- \
  --preview=tmp/v1-preview.json \
  --resolutions=scripts/content-v1/resolution.json \
  --created-at=2026-07-18T08:00:00.000Z \
  --output=tmp/approved-snapshot.json
```

If the preview used an existing destination snapshot, pass the same file with
`--existing=<path>` to both commands. The explicit timestamp is part of the
approval event and snapshot digest; using the same timestamp and inputs
produces byte-identical formatted JSON.

## Approval requirements

The artifact becomes `Approved` only when:

- the snapshot, preview, and source schema versions match;
- the supplied preview digest matches a freshly regenerated preview;
- the resolution digest matches the supplied resolution input;
- the source and destination-state digests match;
- all 19 records are present and complete;
- every required Growth Stage has a valid manual approval;
- record, global, child, and safeguard blockers are zero;
- preview import readiness has passed.

A blocked candidate remains useful as a machine-readable report, but the
parser and import executor reject it. The human report is headed `Migration
Approval Snapshot`, uses `READY` or `BLOCKED`, and lists record count, resolved
records, warnings, blockers, and digests.

## Invalidation and import preflight

Changing source content, destination state, a Growth Stage decision or any of
its audit metadata, or the reviewed preview invalidates the snapshot. Import
preparation now requires the full approved artifact and its snapshot digest.
Before a database boundary can be called, the executor:

1. validates the artifact structure and its self-digest;
2. checks the explicit command digest;
3. regenerates source and resolution digests;
4. reads and digests the current destination state;
5. regenerates the complete snapshot using the original approval timestamp;
6. requires an exact snapshot match;
7. builds the payload from the frozen approved records and relations.

No import command was run while implementing or validating this phase.

## Safety boundary

- no database schema or migration file was added;
- no database or Storage write was performed;
- no public route, frontend, Admin UI, lifecycle service, or source-mode
  configuration changed;
- the generator reads migration inputs and writes only the explicitly requested
  local JSON artifact;
- the current empty real resolution input remains unchanged and blocked.

