# The Garden V2 - 08D-4 Controlled Database Cutover Preparation

Task: `08D-4. Controlled Database Cutover Preparation`  
Implementation date: `2026-07-19`  
Scope: cutover readiness verification and operator boundary only  
Cutover executed: **no**  
Default source mode changed: **no**  
Imported content modified: **no**

## Outcome

The completed V2 migration now has a deterministic cutover-preparation
boundary. The boundary records `PREPARED` only when every database,
source-mode, rollback, and cache invariant below is supplied and passing. Any
missing or changed invariant returns `BLOCKED`.

`PREPARED` is not permission to cut over. It does not change deployment
configuration, authorize a cutover window, or execute a source transition. An
absent `CONTENT_SOURCE_MODE` continues to resolve to `legacy`.

## Readiness verification

| Boundary | Required evidence | Verified state |
| --- | --- | --- |
| Contents | Exact completed migration count | 19 |
| Initial versions | One initial version for every imported content | 19 |
| Relations | Exact count plus resolvable, unique source/target integrity | 4, integrity passed |
| Migration receipt | Durable successful receipt exists and matches the verified import | Exists |
| Lake Growth Stage | All five Lake Reflections may retain `growth_stage = null` as not applicable | Valid |
| Legacy mode | Default and explicit legacy behavior remain unchanged | Passed |
| Dual mode | Database-first, eligibility-controlled legacy behavior remains unchanged | Passed |
| Database mode | Imported collections and all 19 detail reads are verified | Passed |
| Database fallback | Database mode performs no legacy reads, including on database failure | Zero fallback |
| Rollback | Only `database -> dual -> legacy` is accepted | Passed |
| Cache boundary | Route cache, metadata, sitemap, and static content are all required | Complete |

Evidence is provided by the combined content test boundary:

- `content-v1-migration-verification.test.ts` verifies the 19 contents, 19
  initial versions, four relations, successful matching import receipt, and
  Lake-null applicability;
- `database-read-verification.test.cjs` verifies database-mode collections,
  all 19 database detail routes, relation mapping, Lake-null presentation, and
  zero legacy reads;
- `source-cutover.test.cjs` verifies the unchanged legacy default, adjacent
  legacy/dual/database configuration, fail-closed Dual behavior, database
  admission, and no database-to-legacy shortcut;
- `content-v1-cutover-preparation.test.ts` binds the completed evidence to the
  exact count, source-mode, rollback, and cache requirements and keeps
  `cutoverExecuted` fixed to `false`.

Keeper Admin verification remains covered separately by
`admin-migrated-content-verification.test.cjs`; this task does not change its
workflows.

## Source-mode boundary

Forward cutover remains a separately approved two-deployment sequence:

```text
legacy -> dual -> database
```

- Legacy remains the default while `CONTENT_SOURCE_MODE` is absent.
- Dual remains database-first and may use legacy only for identities the
  database explicitly identifies as unmigrated. It fails closed when fallback
  eligibility cannot be established.
- Database mode uses only database reads. A validation or repository failure
  must fail closed and must never read the legacy source.
- Direct `legacy -> database` is forbidden.

No environment file or source-mode configuration is changed by 08D-4.

## Controlled rollback

The required rollback path is:

```text
database -> dual -> legacy
```

Rollback is configuration-only. Preserve the V2 database, migration receipt,
versions, relations, legacy source, backups, and evidence throughout.

1. Record the incident time, active deployment, source mode, symptoms, and
   evidence identifiers.
2. Deploy the adjacent `database -> dual` transition with
   `CONTENT_SOURCE_MODE=dual`, `CONTENT_SOURCE_PREVIOUS_MODE=database`, and
   `CONTENT_SOURCE_MODE_CONFIRM=dual`.
3. Invalidate/revalidate every cache surface listed below and run the public
   smoke matrix. If Dual cannot establish safe fallback eligibility, it must
   fail closed; continue immediately to the prepared Legacy deployment.
4. Deploy the adjacent `dual -> legacy` transition with
   `CONTENT_SOURCE_MODE=legacy`, `CONTENT_SOURCE_PREVIOUS_MODE=dual`, and
   `CONTENT_SOURCE_MODE_CONFIRM=legacy`.
5. Invalidate/revalidate every cache surface again and verify the frozen
   legacy route manifest.
6. Leave both data sources intact and block another cutover until the failed
   evidence is renewed.

Direct `database -> legacy` is rejected by the source configuration contract.
Rollback does not re-import, edit, or delete V2 content.

## Cache invalidation and revalidation

After each future forward cutover deployment and after each rollback step, the
operator must refresh and then probe all of these source-dependent surfaces:

- **Route cache:** Home, all four Region collections and detail routes, Garden
  Index, Search compatibility routes, redirects, archived routes, and unknown
  route controls. Purge framework, hosting, and CDN route output before the
  smoke matrix.
- **Metadata:** Revalidate page titles/descriptions, canonical URLs, Open
  Graph/Twitter metadata, and structured data for the active source. Confirm
  no output identifies the previous source state.
- **Sitemap:** Regenerate/revalidate `/sitemap.xml`; verify the exact active
  Published route set and confirm Draft, Review, and Archived routes remain
  excluded.
- **Static content:** Rebuild or revalidate pre-rendered Home, Region, detail,
  Index/Search, navigation, and discovery output, including deployment/CDN
  artifacts. Confirm the 19 migrated public routes appear exactly once and
  legacy-only output is not retained after database entry.

The existing lifecycle contract also names `search` as an invalidation target;
for cutover operations it is covered by the static discovery/Index/Search
refresh above. Repository tests are supporting evidence, not a substitute for
probing deployed responses after each future transition.

Do not advance to the next source mode, or declare rollback complete, while
any route, metadata, sitemap, or static response still reflects the previous
mode.

## Preservation boundary

08D-4 makes no runtime, database, content, Admin, or source default change:

- no cutover is executed;
- `CONTENT_SOURCE_MODE` still defaults to `legacy`;
- legacy content and fallback code remain present;
- imported contents, versions, relations, and receipt remain unchanged;
- Lake Reflection null Growth Stage values remain unchanged and valid;
- Keeper Admin workflows remain unchanged.

## Change manifest

Modified files:

- `docs/V2_MIGRATION.md`
- `docs/V2_TODO.md`
- `package.json`
- `scripts/content-v1/cutover-readiness.ts`

New files:

- `docs/V2_PHASE_08D4_CUTOVER_PREPARATION.md`
- `tests/content-v1-cutover-preparation.test.ts`

Migrations created: **none**.
