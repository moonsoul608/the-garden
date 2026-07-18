# The Garden V2 — 08D-3 Admin Verification

Task: `08D-3. Admin Verification`  
Implementation date: `2026-07-19`  
Scope: read-only Keeper Admin verification for migrated content  
Content data modified: **no**  
Import executed: **no**  
Source mode changed: **no**

## Outcome

Keeper Admin coverage now follows the completed 19-record import from database
row shapes through the Admin content repository, authorization-aware service,
and Growth Stage presentation boundary. The verification uses an injected,
read-only database client and cannot execute an import or mutate content.

The Admin implementation continues to read `contents` independently of the
public content source mode. Migrated Published records appear in the Content
workbench without an open Draft revision, while normal Draft and Review records
continue to use their existing revision-aware actions.

## Imported content verification

The automated boundary verifies the complete imported workspace inventory:

- Garden: 5 contents
- Forest: 5 contents
- Lake: 5 contents
- Ruins: 4 contents
- total: 19 Published contents

Every expected imported identity is represented in the workbench fixture. The
repository-to-service mapping retains the Region on every record, exposes no
synthetic active revision for imported Published rows, and returns the full
19-item list to the Keeper.

## Growth Stage presentation

Admin Growth presentation is now expressed through one tested helper used by
the Content workbench:

- each of the five Lake Reflection records retains `growthStage = null` and
  renders `Not growth-tracked` without a Growth marker;
- every Garden, Forest, and Ruins record renders its exact imported Growth Stage
  and the corresponding existing marker;
- no Growth Stage is inferred or written during verification.

## Workflow and public-boundary regression coverage

`npm run test:content-admin` retains the existing Admin lifecycle suites in the
same run as the new imported-content verification. They continue to cover:

- Draft creation and editing with optimistic locking;
- Draft submission to Review and return to Draft;
- Review publication and existing lifecycle transition guards;
- Published, Draft, Review, Archived, deleted, and missing public visibility;
- the legacy-default and guarded dual/database source-mode rules.

The new coverage does not alter those services or public routes.

## Preservation and safety

- `CONTENT_SOURCE_MODE` remains absent by default, so public reads still default
  to `legacy`.
- Database contents, versions, relations, tags, and migration receipts are not
  read by a write-capable test path and are not modified.
- No migration or import code was invoked.
- No cutover configuration or state was changed.
- No legacy data or fallback implementation was removed.
- Public route implementations and visibility rules are unchanged.

## Automated coverage

`tests/admin-migrated-content-verification.test.cjs` is included in
`npm run test:content-admin`. It verifies the 19 imported database row shapes,
Region counts, Published lifecycle, lack of synthetic Draft revisions, and
rendered Growth presentation.

Existing Admin workflow, source-cutover, database-read, and public-route tests
remain part of the aggregate command and provide the regression boundary for
the unchanged behavior listed above.

## Change manifest

Modified files:

- `app/admin/(protected)/content/page.tsx`
- `docs/V2_TODO.md`
- `lib/content/admin/index.ts`
- `package.json`

New files:

- `docs/V2_PHASE_08D3_ADMIN_VERIFICATION.md`
- `lib/content/admin/content-management-presentation.ts`
- `tests/admin-migrated-content-verification.test.cjs`

Migrations created: **none**.
