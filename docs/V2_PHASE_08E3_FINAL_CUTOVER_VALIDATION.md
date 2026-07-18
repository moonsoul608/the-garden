# The Garden V2 - 08E-3 Final Cutover Validation

Task: `08E-3. Final Cutover Validation`  
Validation date: `2026-07-19`  
Scope: final application validation after the database-default cutover  
Effective default source: `database`  
Imported content modified: **no**  
Database schema modified: **no**  
Additional migration performed: **no**  
Legacy source removed: **no**

## Outcome

The post-cutover application boundary is validated with the database as the
default public content source. An absent `CONTENT_SOURCE_MODE` now drives the
complete public verification matrix through the database adapter rather than
an explicitly injected source mode. The matrix covers Home, all four public
Region collections, Search, Garden Index, all 19 imported detail routes,
metadata, sitemap output, lifecycle visibility, relations, and Lake Growth
Stage non-applicability.

Database-mode reads perform no legacy collection, detail, or Home-curation
reads. Explicit Legacy and guarded Dual modes remain intact, and the only
accepted rollback sequence remains:

```text
database -> dual -> legacy
```

The final validation is read-only with respect to content and the database. It
does not delete the legacy adapter, update imported records, alter lifecycle
state, change relations, create a schema migration, or execute rollback.

## Default source and rollback

| Check | Result |
| --- | --- |
| Absent `CONTENT_SOURCE_MODE` | Resolves to `database` |
| Full public matrix source | Absent source environment, using the database default |
| Database collection fallback | Zero legacy reads |
| Database detail fallback | Zero legacy reads |
| Database Home fallback | Zero legacy reads |
| Database failure behavior | Fails closed without exposing repository details or reading legacy |
| Explicit Dual availability | Preserved with database-authorized fallback eligibility only |
| Explicit Legacy availability | Preserved |
| `database -> dual` | Accepted as an adjacent transition |
| `dual -> legacy` | Accepted as an adjacent transition |
| Direct `database -> legacy` | Rejected |

## Public surface validation

The shared public content service remains the single source-aware read path.
Public page wiring is guarded against direct imports from the frozen Garden,
Forest, Lake, and Ruins arrays.

| Surface | Final validation |
| --- | --- |
| Home | Required database identities for Currently Growing and Recently Planted are present |
| Garden | Exactly 5 Published Seeds render |
| Forest | Exactly 5 Published Questions render |
| Lake | Exactly 5 Published Reflections render |
| Ruins | Exactly 4 Published Traces render |
| Search | Receives the exact 19-route Published discovery set |
| Garden Index | Receives the exact 19-route Published discovery set |
| Detail routes | All 19 Region/slug routes resolve as Published with nonblank title, summary, body, categories, and presentation data |

The 19-route manifest is:

- Garden: 5;
- Forest: 5;
- Lake: 5;
- Ruins: 4.

Every detail route is validated for public metadata containing its title,
description, canonical Region/slug URL, indexable robots policy, and matching
Open Graph title and URL. Sitemap verification requires exactly 19 unique
Published detail paths with no missing, duplicate, malformed, or extra route.

## Lifecycle, relations, and Growth Stage

Lifecycle controls remain source-enforced:

- Draft resolves as public not found;
- Review resolves as public not found;
- Archived resolves only to the dedicated resting-state representation;
- Draft, Review, and Archived controls do not appear in Region collections,
  Search, Garden Index, or sitemap output.

All four imported `grewInto` relations load from database detail reads and
resolve to Published targets:

- `first-version-of-home` -> `building-the-garden`;
- `portfolio-never-built` -> `the-garden`;
- `too-much-interaction` -> `why-exploratory-websites-invite-more-clicks`;
- `unfinished-continue` -> `why-people-fear-forgetting`.

All five Lake Reflections retain `growthStage = null`, meaning
`not growth-tracked / not applicable`. Public presentation renders
`Not growth-tracked`. Garden, Forest, and Ruins items retain their exact
non-null Growth Stage values.

## Garden Keeper compatibility

The protected Admin read path remains independent from the public anonymous
database client and is unchanged by the default-source switch. Regression
coverage verifies that:

- all 19 migrated database records are accessible through the Admin content
  list;
- Region counts are Garden 5, Forest 5, Lake 5, and Ruins 4;
- all migrated records retain Published lifecycle presentation;
- each Lake record displays `Not growth-tracked` with no invented marker;
- every non-Lake record displays its exact imported Growth Stage and marker;
- the Admin workspace uses the shared Growth Stage presentation boundary.

## Regression evidence

The final boundary is covered by existing focused suites plus one strengthened
default-source path:

- `tests/source-cutover.test.cjs` verifies absent-mode resolution, explicit
  rollback modes, adjacent transitions, fail-closed database behavior, and no
  database-to-legacy shortcut;
- `tests/preview-cutover-verification.test.cjs` now runs its complete public
  render matrix using an absent source environment, so all seven surfaces and
  19 detail routes exercise the real post-cutover database default;
- `tests/database-read-verification.test.cjs` verifies imported collection
  counts, all detail records, metadata fields, relations, Lake nulls, and zero
  legacy reads;
- `tests/admin-migrated-content-verification.test.cjs` verifies migrated Admin
  access and Growth Stage presentation;
- public route integration tests verify metadata, sitemap, lifecycle, archived,
  and safe error boundaries.

## Validation commands

The required final validation completed successfully:

```text
npm run typecheck
npm run lint
npm run test:content-admin
npm run test:preview-cutover
npm run build
git diff --check
```

`npm run test:content-admin` completed with 224 passing tests. The focused
Preview cutover suite completed with 3 passing tests. TypeScript checking,
linting, the production build, and whitespace validation all passed.

## Preservation boundary

08E-3 does not:

- delete or weaken the frozen legacy source;
- remove Dual mode or its fallback-eligibility guard;
- permit database-mode fallback to legacy;
- modify any imported content, version, relation, Growth Note, lifecycle, or
  Home-curation record;
- change the database schema or add a migration;
- change Keeper Admin workflows;
- execute rollback or remove rollback evidence.

## Change manifest

Runtime verification:

- `lib/content/preview-cutover.ts`
- `tests/preview-cutover-verification.test.cjs`

Governance:

- `docs/V2_TODO.md`
- `docs/V2_PHASE_08E3_FINAL_CUTOVER_VALIDATION.md`

Migrations created: **none**.
