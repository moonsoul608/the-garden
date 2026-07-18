# The Garden V2 - 08E-2 Database Default Source Switch

Task: `08E-2. Database Default Source Switch`  
Implementation date: `2026-07-19`  
Scope: application default-source cutover after passed Preview verification  
Default source mode: `database`  
Imported content modified: **no**  
Admin workflows modified: **no**  
Destructive cleanup performed: **no**

## Outcome

When `CONTENT_SOURCE_MODE` is absent, the public content service now selects
the database adapter. The switch applies to the single shared public read path
used by Home, the four Region collections, Search, Garden Index, all detail
routes, detail metadata, static parameters, and sitemap generation.

The legacy adapter remains present and callable through explicit `legacy`
mode. Dual mode remains database-first with eligibility-controlled fallback.
No imported content, lifecycle state, relation, Growth Note, Home curation,
Admin action, database migration, or Storage object was changed.

Public database reads use a server-only anonymous Supabase client constrained
by public RLS. It has no authenticated cookie or session dependency, so static
parameter and sitemap generation use the same database adapter without coupling
public builds to Keeper request state. Admin services retain their separate
authenticated server client and workflows.

Published database details resolve directly through the RLS-constrained detail
query. Non-Published identities continue through the disposition boundary for
Draft/Review hiding and Archived resting-state behavior. Dual mode always uses
the disposition boundary first because fallback eligibility must be explicitly
authorized before any legacy read.

## Default and explicit modes

| Configuration | Effective source behavior |
| --- | --- |
| `CONTENT_SOURCE_MODE` absent | Database-only post-cutover default |
| Explicit `database` transition | Database-only, with admission validation |
| Explicit `dual` transition | Database-first; legacy only for database-authorized unmigrated routes |
| Explicit `legacy` | Frozen V1 adapter for rollback |

The accepted absent-mode default does not require transition-only probe
variables. An explicit `dual -> database` transition still requires distinct
Published, Draft, Review, and Archived probes and runs the complete admission
validation before returning database content. Missing or invalid transition
probes, repository failures, lifecycle mismatches, or incomplete database
results fail closed. Database mode never attempts a legacy collection, detail,
or Home read.

## Verified public matrix

The regression boundary uses the exact 19 imported route identities and
verifies these source-dependent surfaces:

| Surface | Database-default expectation |
| --- | --- |
| Home | Required Currently Growing and Recently Planted identities exist in the database result set |
| Garden | Exactly five Published Seeds |
| Forest | Exactly five Published Questions |
| Lake | Exactly five Published Reflections |
| Ruins | Exactly four Published Traces |
| Search | Exact Published 19-route discovery input |
| Garden Index | Exact Published 19-route discovery input |
| Detail routes | All 19 Region/slug routes resolve from database records with nonblank body content |

The public pages continue to import the shared content service rather than
legacy Region arrays. Presentation helpers may preserve approved CTA language,
but titles, summaries, categories, tags, Growth Stage, route identity, body,
relations, and metadata come from the active database adapter.

## Metadata, sitemap, and lifecycle visibility

For every imported detail route, verification requires a public title,
description, canonical Region/slug path, indexable robots metadata, and matching
Open Graph title and URL. Sitemap generation must return exactly the 19 unique
Published detail paths.

Draft and Review controls resolve as public not found. Archived controls use
the allow-listed resting-state disposition. None of those controls may appear
in collections, Search, Garden Index, or the sitemap. These checks run through
the same database-only service instance and record zero legacy reads.

## Lake Growth Stage applicability

All five Lake Reflections retain `growthStage = null`, meaning Growth Stage is
not applicable. Garden, Forest, and Ruins records retain applicable non-null
values. The switch does not invent a Lake enum value and does not update any
imported row.

## Rollback

The preserved controlled rollback path is:

```text
database -> dual -> legacy
```

Each step requires the existing adjacent source-mode configuration, cache
refresh, and public smoke checks documented in
`docs/V2_PHASE_07D_SOURCE_CUTOVER.md`. Rollback changes application
configuration only. It must preserve the database, migration receipt, versions,
relations, legacy source files, and all evidence.

Direct declared `database -> legacy` remains rejected. If Dual cannot authorize
fallback safely, it fails closed; operators continue to the prepared adjacent
Legacy deployment rather than serving unverified legacy results from Dual.

## Regression coverage

The switch is covered by:

- `tests/source-cutover.test.cjs`, which verifies the absent-mode database
  default uses only the database adapter, explicit Legacy availability,
  adjacent transitions, retained transition admission, fail-closed behavior,
  and zero fallback;
- `tests/preview-cutover-verification.test.cjs`, which verifies Home, Regions,
  Search, Garden Index, all 19 details, metadata, sitemap, lifecycle visibility,
  relations, Lake-null behavior, source-aware page wiring, and rollback.

Run the focused render boundary with:

```text
npm run test:preview-cutover
```

Both files are also included in `npm run test:content-admin`.

## Preservation boundary

08E-2 does not:

- delete or weaken the legacy adapter;
- remove Dual mode or its fallback eligibility guard;
- permit database-mode legacy fallback;
- modify the 19 imported contents or their lifecycle state;
- change Keeper Admin pages, services, actions, or workflows;
- create or apply a database migration;
- remove rollback data or perform cleanup.

## Change manifest

Runtime configuration:

- `lib/content/source-cutover.ts`
- `lib/content/service.ts`
- `lib/supabase/config.ts`
- `lib/supabase/public-server.ts`
- `.env.example`
- `README.md`

Regression coverage:

- `lib/content/preview-cutover.ts`
- `tests/source-cutover.test.cjs`
- `tests/preview-cutover-verification.test.cjs`

Governance:

- `docs/V2_MIGRATION.md`
- `docs/V2_TODO.md`
- `docs/V2_PHASE_08E2_DATABASE_DEFAULT_SWITCH.md`

Migrations created: **none**.
