# The Garden V2 — 08E-1 Preview Database Cutover Verification

Task: `08E-1. Preview Database Cutover`  
Implementation date: `2026-07-19`  
Scope: read-only Preview database-source render verification  
Production cutover executed: **no**  
Default source mode changed: **no**  
Imported content modified: **no**  
Admin workflows modified: **no**

## Outcome

The public application now has one source-aware render path from the shared
content service through Home, the four Region collections, Garden Index,
Search, all four detail families, metadata, and sitemap generation. The 08E-1
verification creates an isolated service instance in explicit `database` mode;
it does not set `CONTENT_SOURCE_MODE`, mutate process configuration, deploy a
source transition, or authorize Production.

The deterministic Preview verification result is `VERIFIED` for the completed
19-record migration contract. The result always records:

- `previewOnly: true`;
- `cutoverExecuted: false`;
- `productionCutoverAuthorized: false`;
- `defaultSourceModeChanged: false`.

Any non-Preview scope, missing route, visibility mismatch, metadata/sitemap
regression, relation mismatch, Lake Growth Stage regression, legacy fallback
read, or rollback-contract failure returns `BLOCKED`.

## Public render path

Before 08E-1, detail routes, detail metadata, static parameters, and sitemap
already read through the public content service, but Home, Region collections,
Garden Index, and Search still imported V1 arrays directly. That bypass would
have allowed a database-mode detail route and a legacy-mode collection to be
rendered in the same deployment.

08E-1 removes that split:

```text
Home / Region / Index / Search / Detail / Metadata / Sitemap
                              ↓
                 Public Content Service
                              ↓
                    active source adapter
```

The existing V1 CTA and card-presentation language remains a presentation
layer. Titles, summaries, categories, tags, Growth Stage, route identity, body,
relations, and metadata come from the active public content source. Because an
absent `CONTENT_SOURCE_MODE` still resolves to `legacy`, default behavior and
visitor-facing copy remain unchanged.

## Verified public matrix

| Surface | Database-mode verification |
| --- | --- |
| Home | Required source identities for Currently Growing and Recently Planted are present |
| Garden | Exactly 5 Published Seeds render from the service |
| Forest | Exactly 5 Published Questions render from the service |
| Lake | Exactly 5 Published Reflections render from the service |
| Ruins | Exactly 4 Published Traces render from the service |
| Search | The exact 19-route Published set is supplied to discovery |
| Detail routes | All 19 Garden, Forest, Lake, and Ruins routes resolve as Published with nonblank title, summary, and body |

Garden Index was moved to the same service path as a regression safeguard even
though the task's named public matrix requires Search.

## Metadata and sitemap

Every imported detail route is verified for:

- title and description;
- canonical Region/slug path;
- public robots behavior;
- Open Graph title and route;
- database-backed detail identity.

The sitemap must contain exactly the 19 unique imported Published routes. Draft,
Review, and Archived control identities must be absent. A missing, duplicated,
malformed, or extra route blocks verification.

## Lifecycle visibility

The verification boundary requires three non-Published control dispositions:

- Draft resolves as public not found;
- Review resolves as public not found;
- Archived resolves to the allow-listed resting-state disposition;
- none appears in collections, Search input, or sitemap.

The 19 imported routes must all resolve as Published. Database mode performs
zero legacy reads throughout the verification.

## Relations and Lake applicability

All four imported `grewInto` relations are loaded from detail reads and must
resolve to the expected Published targets:

- `first-version-of-home` → `building-the-garden`;
- `portfolio-never-built` → `the-garden`;
- `too-much-interaction` → `why-exploratory-websites-invite-more-clicks`;
- `unfinished-continue` → `why-people-fear-forgetting`.

Every Lake Reflection must retain `growthStage = null`. The public detail
renderer continues to present this as `Not growth-tracked`; no enum value is
invented and no imported row is changed. Garden, Forest, and Ruins records must
retain an applicable non-null Growth Stage.

## Rollback readiness

The verified rollback sequence remains:

```text
database -> dual -> legacy
```

The source configuration contract accepts both adjacent deployments with exact
confirmation and rejects a direct `database -> legacy` transition. Each real
rollback deployment must still refresh route, metadata, sitemap, search, and
static output caches and repeat the public smoke matrix described in
`docs/V2_PHASE_07D_SOURCE_CUTOVER.md`.

Verification does not execute either rollback step. It preserves the imported
database, versions, relations, receipt, and V1 source.

## Regression coverage

Run the focused path with:

```text
npm run test:preview-cutover
```

The same suite is included in `npm run test:content-admin`. It verifies:

- Preview-only admission and Production blocking;
- exact public surface and 19-route manifests;
- source-aware page wiring without direct Region-array imports;
- metadata and exact Published-only sitemap behavior;
- Draft, Review, and Archived visibility controls;
- four relations and Lake-null rendering data;
- zero database-mode legacy reads;
- `database -> dual -> legacy` rollback readiness;
- fail-closed behavior for an incomplete database render set.

The repository verification is supporting evidence for a future deployed
Preview probe. It does not claim a Production cutover or grant Production
authorization.

## Preservation boundary

08E-1 does not:

- change the absent-mode `legacy` default;
- modify `.env.local` or deployment variables;
- execute a Production source transition;
- delete or weaken the legacy source;
- write or edit the 19 imported contents, 19 versions, four relations, or
  migration receipt;
- alter Keeper Admin services, pages, actions, or lifecycle workflows.

## Change manifest

Public render integration:

- `app/page.tsx`
- `app/garden/page.tsx`
- `app/garden/garden-collection.tsx`
- `app/forest/page.tsx`
- `app/forest/forest-experience.tsx`
- `app/lake/page.tsx`
- `app/lake/lake-experience.tsx`
- `app/ruins/page.tsx`
- `app/search/page.tsx`
- `app/search/search-experience.tsx`
- `app/(utilities)/garden-index/page.tsx`
- `app/(utilities)/index/index-experience.tsx`
- `components/discovery-card.tsx`
- `lib/content-discovery.ts`
- `lib/content/public-presentation.ts`

Verification and governance:

- `lib/content/preview-cutover.ts`
- `tests/preview-cutover-verification.test.cjs`
- `package.json`
- `docs/V2_MIGRATION.md`
- `docs/V2_TODO.md`
- `docs/V2_PHASE_08E1_PREVIEW_CUTOVER.md`

Migrations created: **none**.
