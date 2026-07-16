# The Garden V2 Archived Route Boundary

Task: `04D-2C Archived Route Boundary`

Status: repository implementation complete; Preview migration and SQL test execution pending

## Public disposition contract

`getPublicContentRouteDisposition(region, slug)` is the route-facing read boundary.
It returns exactly one of:

- `published`: the existing full Published detail DTO;
- `archived`: the dedicated limited resting DTO;
- `not_found`: Draft, Review, an unavailable reserved identity, or an unknown route.

The later page integration must render `archived` at the reserved route with HTTP
200. Full resting-state visual design is deferred. `not_found` must use normal
not-found behavior and must not disclose whether a private Draft or Review
identity exists.

The existing `getPublishedContentByRoute` compatibility method remains
Published-only. It delegates to the disposition boundary and returns `null` for
Archived and not-found dispositions.

## Archived DTO

The Archived payload contains only:

- title;
- Region;
- Growth Stage;
- the `Archived` lifecycle and `archived` resting state;
- relation type and route-safe fields for related Published targets.

It omits body, summary, Growth Notes, relation notes, actor data, archive reason,
cover metadata, timestamps, IDs, tags, categories, and private editorial state.
The repository reconstructs an allow-listed DTO from the RPC response, so
unexpected database fields are discarded rather than forwarded.

## Database and relation boundary

`resolve_public_content_route` is a fixed-search-path, stable `SECURITY DEFINER`
RPC. It does not grant anonymous access to Archived rows or to
`route_redirects`. Published rows continue through the existing Published-only
repository query. Archived rows receive only the restricted payload.

Archived relations include only targets whose current projection is Published.
Published detail queries and existing relation RLS also require Published
targets, so Archived targets stay hidden from Published pages.

The RPC recognizes an existing 410 route marker only to forbid legacy fallback.
It does not resolve redirects, return a tombstone DTO, or select an HTTP status.

## Legacy, dual, and database modes

- `legacy` remains the intentional static-only rollback mode.
- `database` never reads V1 fallback content.
- `dual` uses V1 only when the database boundary confirms that the route is
  genuinely unmigrated.

Dual detail lookups forbid fallback for Archived, Draft, Review, and tombstoned
identities. Dual collection merging uses `filter_unmigrated_public_routes`, so
an Archived or otherwise reserved database identity cannot reappear in Region,
Index, or Search results from V1.

Normal content, Home curation, relation, tag, and Growth Note queries remain
Published-only. Archived content is reachable only through the explicit route
disposition lookup.

## Lifecycle invalidation contract

`lib/content/invalidation.ts` defines the hook shape only. Every lifecycle
change that affects public availability must invalidate or refresh all of:

- route cache;
- route metadata;
- sitemap output;
- search indexes.

This phase does not install a cache, metadata registry, sitemap implementation,
search indexing infrastructure, or hook runner.

## Deferred work

- integrate the disposition into the four detail page families;
- implement the resting-state visual design;
- implement archived `noindex` metadata and Published-only sitemap generation;
- implement cache and search-index invalidation infrastructure;
- implement redirect resolution, 410 responses, deletion, and Storage cleanup.

These are intentionally outside 04D-2C and require their separately approved
phases.

## Database verification

After applying all migrations in Preview, run
`supabase/tests/phase_04d_archived_route_boundary.sql`. The test is rollback-only
and verifies Published, Archived, Draft, Review, unknown, tombstoned, dual-read,
relation, grant, and RLS behavior.
