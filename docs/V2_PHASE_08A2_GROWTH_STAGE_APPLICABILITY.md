# The Garden V2 — 08A-2 Growth Stage Applicability Correction

Task: `08A-2 Lake Growth Stage Applicability Correction`

## Product rule

Growth Stage remains one unchanged enum with `Seed`, `Sprout`, `Growing`,
`Bloom`, and `Dormant`.

- Garden Seeds require Growth Stage.
- Forest Questions require Growth Stage.
- Ruins Traces require Growth Stage.
- Lake Reflections may have a null Growth Stage.

For a Lake Reflection, null means `not growth-tracked / not applicable`. It is
not an enum value and does not require a migration resolution.

## Implementation

- `contents.growth_stage` and `content_revisions.growth_stage` are nullable.
- database checks allow null only for the Lake + Reflection pairing;
- the shared `requiresGrowthStage(region, contentType)` rule is used by content,
  lifecycle, migration, Draft, Review, and Admin validation;
- the V1 preview, approved snapshot, and preflight accept all five Lake nulls;
- no Lake Growth Stage approval or fake resolution is generated;
- Keeper Admin uses an explicit `Not growth-tracked` option for Lake
  Reflections and does not default that pairing to Seed;
- public and archived displays render the null state intentionally and never
  interpolate it as `null` text.

## Safety boundary

This task does not execute an import, change source mode, perform cutover, or
modify the Growth Stage enum. Existing non-null Growth Stage values are
preserved.
