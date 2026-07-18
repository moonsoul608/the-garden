# Phase 07D — Source Cutover Controls

## Outcome and scope

Phase 07D implements controlled source selection, database-mode validation,
dual-mode hardening, rollback controls, and public route smoke contracts. It
does not execute a Preview or Production cutover. The default remains
`legacy`; no schema, migration, content row, V1 source, Admin workflow, or
lifecycle rule is changed.

V1 source and all three read modes remain available. Fallback retirement is a
later, explicitly approved operation.

## Source configuration contract

Source selection is server-only deployment configuration. An absent
`CONTENT_SOURCE_MODE` resolves to `legacy`. No database health signal, request,
hostname, or build environment can infer or advance a mode.

Every source change requires these three variables in the build and runtime
environment:

```text
CONTENT_SOURCE_MODE=<target>
CONTENT_SOURCE_PREVIOUS_MODE=<current>
CONTENT_SOURCE_MODE_CONFIRM=<target>
```

Only adjacent changes are accepted:

```text
legacy -> dual -> database
database -> dual -> legacy
```

Examples:

```text
# Forward entry to Dual
CONTENT_SOURCE_MODE=dual
CONTENT_SOURCE_PREVIOUS_MODE=legacy
CONTENT_SOURCE_MODE_CONFIRM=dual

# Forward entry to Database
CONTENT_SOURCE_MODE=database
CONTENT_SOURCE_PREVIOUS_MODE=dual
CONTENT_SOURCE_MODE_CONFIRM=database

# First rollback deployment
CONTENT_SOURCE_MODE=dual
CONTENT_SOURCE_PREVIOUS_MODE=database
CONTENT_SOURCE_MODE_CONFIRM=dual

# Final rollback deployment
CONTENT_SOURCE_MODE=legacy
CONTENT_SOURCE_PREVIOUS_MODE=dual
CONTENT_SOURCE_MODE_CONFIRM=legacy
```

Declared direct `legacy -> database` and `database -> legacy` transitions,
missing transition confirmation, and mismatched confirmation fail
configuration resolution. An existing explicit `CONTENT_SOURCE_MODE=legacy`
with no transition values is treated as an unchanged legacy-only deployment,
which preserves the pre-cutover contract. The controlled rollback procedure
still uses the two adjacent deployments shown above.

The operator must apply source variables to the same deployment scope as the
Supabase public credentials. Preview must use Preview credentials and
Production must use Production credentials. A source change requires a new
deployment or server restart; do not mutate source variables inside a running
process.

## Database-mode admission validation

Environment-driven `database` mode requires four real, stable control routes:

```text
CONTENT_DATABASE_PUBLISHED_PROBE=/garden/published-slug
CONTENT_DATABASE_DRAFT_PROBE=/garden/draft-control-slug
CONTENT_DATABASE_REVIEW_PROBE=/forest/review-control-slug
CONTENT_DATABASE_ARCHIVED_PROBE=/ruins/archived-control-slug
```

Each value must be one valid `/garden/[slug]`, `/forest/[slug]`,
`/lake/[slug]`, or `/ruins/[slug]` route. Operators must record the exact
identities in the approved evidence bundle; placeholders are not accepted.

Before the first database-only public result is served, one shared validation
promise verifies:

- the Supabase-backed repository can be created;
- Published collection and Home curation queries complete;
- the Published control appears in the collection, resolves as Published, and
  has a readable Published detail;
- the Draft and Review controls resolve as not found and explicitly forbid
  legacy fallback;
- the Archived control resolves to the limited resting-state disposition.

Validation runs once per server process. An unavailable adapter, query error,
empty/malformed public collection, lifecycle mismatch, missing detail, exposed
Draft/Review control, or incorrect Archived response fails closed with a safe
`database_validation_failed` error. Raw provider/database details are not
returned. Database mode never silently falls back to V1 after a validation
failure.

## Dual-mode final behavior

Dual collections read the database before reading legacy content. If the
database cannot authorize fallback eligibility, the request fails closed and
the legacy source is not read. This prevents a database outage from
resurrecting a stale Archived, Draft, Review, deleted, or otherwise reserved V1
identity.

When the database succeeds:

- mapped database Published results are first;
- duplicate database and legacy routes are removed by `Region/slug`;
- only routes returned by `filter_unmigrated_public_routes` may use V1;
- database ordering uses the requested public order followed by stable Region
  and slug tie-breakers;
- legacy fallback retains its stable source order after database results;
- limit/offset are applied only after the deterministic merged list exists.

Home curation continues to have no legacy fallback, as established before this
phase.

## Cutover smoke matrix

Run the complete matrix in Preview before each forward transition and in the
target environment immediately after deployment:

| Route family | Published | Draft | Review | Archived | Unknown |
| --- | --- | --- | --- | --- | --- |
| `/garden/[slug]` | detail renders | safe 404 | safe 404 | resting state | safe 404 |
| `/forest/[slug]` | detail renders | safe 404 | safe 404 | resting state | safe 404 |
| `/lake/[slug]` | detail renders | safe 404 | safe 404 | resting state | safe 404 |
| `/ruins/[slug]` | detail renders | safe 404 | safe 404 | resting state | safe 404 |

Also verify Region pages, Home curation, Garden Index, Search, metadata,
sitemap, robots, redirects, and the frozen V1 route manifest. Repository tests
are supporting evidence; they do not replace deployed route probes.

## Rollback

Rollback changes configuration and caches only. It does not write, delete, or
re-import content. Preserve the V2 database, import receipts, backups, V1
source, and deployment evidence throughout.

1. Record the incident time, deployment, active mode, symptoms, and evidence.
2. Deploy `database -> dual` with the exact adjacent configuration above.
3. Invalidate/revalidate all cache surfaces listed below and run the smoke
   matrix. If the database cannot safely authorize Dual fallback, do not serve
   stale Dual results; continue immediately to the prepared Legacy deployment.
4. Deploy `dual -> legacy`.
5. Invalidate/revalidate again and confirm the frozen V1 route manifest.
6. Leave all V2/V1 data intact and block a new cutover until evidence and
   approval are renewed.

Each deployment creates a fresh server process, so React request memoization
and the one-process database validation promise cannot cross source modes.

## Cache awareness

Phase 07D does not redesign or install cache infrastructure. A source-mode
change or rollback must explicitly refresh every source-dependent surface:

- route output and any framework/CDN route cache for all four Regions, Home,
  Index, and Search;
- detail metadata, social metadata, structured data, and any metadata cache;
- `/sitemap.xml` after the active Published set changes or a source mode
  changes;
- search/discovery output covered by the existing lifecycle invalidation
  contract;
- deployment/CDN caches that can retain output from the previous source mode.

`route`, `metadata`, `sitemap`, and `search` remain the canonical invalidation
targets in `lib/content/invalidation.ts`. Until a cache hook runner exists, the
operator must use the hosting platform's tested redeploy/revalidation/purge
procedure, then probe the outputs. Do not advance or declare rollback complete
while any output still identifies the previous source mode.

## Test coverage

The automated contract covers:

- unchanged Legacy default and static-only behavior;
- explicit adjacent forward and rollback configuration;
- strict database validation probe parsing;
- successful and failed database admission validation;
- fail-closed database and Dual failure behavior;
- database-first, unique, stale-safe, deterministic Dual merging;
- all four detail route families across Published, Draft, Review, Archived,
  and unknown states;
- retained public route error boundaries.

No Production cutover was performed and no migration was created.
