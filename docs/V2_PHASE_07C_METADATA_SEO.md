# Phase 07C — Metadata and SEO

## Scope

Phase 07C connects public metadata, social previews, structured data, sitemap,
and robots output to the existing public content boundary. It does not change
the content source mode, public read service, lifecycle behavior, Admin UI,
Storage, database data, or migrations.

## Public metadata contract

All normal public pages provide a title, description, deterministic canonical
path, Open Graph metadata, Twitter metadata, and explicit index/follow rules.
The root layout resolves relative canonical and social URLs against `SITE_URL`.
Vercel's Production URL and deployment URL are fallbacks, followed by
`http://localhost:3000` for local development. Production and Preview must set
`SITE_URL` to the approved public Production origin so generated absolute URLs
do not depend on a temporary deployment hostname.

Published detail metadata is built only from the allow-listed
`PublicContentDetail` projection. It uses the public title and summary selected
by the existing bilingual fallback, the canonical Region/slug route, and an
approved public cover URL with approved alt text. Missing, unsafe, or
internal-identity cover paths use the site fallback social image. Draft,
Review, migration, actor, Admin, and database identity fields are not inputs.

Archived detail routes retain their limited title and canonical path but emit
`noindex,follow`. Unknown, invalid, and failed route reads emit
`noindex,nofollow`. The shared not-found page is also `noindex,nofollow`.

## Sitemap and robots policy

`/sitemap.xml` reads only `getPublishedContent` through the public route
integration. It accepts valid public Region/slug pairs, removes duplicate
routes, sorts by canonical path, and emits deterministic absolute URLs.
`lastModified` uses a valid public `lastTendedAt`, then `publishedAt`, and is
omitted when neither value exists.

Draft, Review, Archived, tombstoned, Admin, API, auth, preview, and invalid
routes cannot enter the sitemap because they are not Published public cards.
The robots route allows normal public crawling and disallows Admin, API, auth,
and preview path prefixes. Robots exclusions are not treated as an access
control; the existing authorization and published-only boundaries remain the
security controls.

## Structured data

Published detail pages emit one `CreativeWork` JSON-LD object. Its allow-list is
limited to the public title, summary, canonical URL, content type, confirmed
language mapping, valid public dates, and an approved public cover URL. Missing
values are omitted rather than inferred. JSON is escaped before insertion into
the document. Archived and not-found pages do not emit content structured data.

## Metadata and sitemap invalidation requirements

This phase does not add cache infrastructure. When invalidation infrastructure
is implemented, it must refresh the existing `route`, `metadata`, `sitemap`,
and `search` targets atomically for every public-availability change.

- Publish: refresh the detail route and metadata, and add the canonical route
  to sitemap and search outputs.
- Archive, unpublish, or tombstone: remove the route from sitemap and search;
  refresh the old route and metadata so the archived or unavailable indexing
  policy is visible immediately.
- Restore or republish: refresh all four targets after the record becomes
  Published; a non-Published restore must remain absent from sitemap/search.
- Slug or Region change: invalidate both old and new route/metadata keys and
  rebuild sitemap/search so only the new canonical route remains.
- Public title, summary, content language, cover path, or cover alt change:
  refresh detail metadata, social metadata, and structured data.
- `publishedAt` or `lastTendedAt` change: refresh structured data and sitemap
  `lastModified` output.
- `SITE_URL` change: rebuild or invalidate all metadata, structured data,
  robots, and sitemap output because every absolute public URL is affected.

Until those hooks have an implementation, deployments and lifecycle runbooks
must explicitly rebuild/revalidate these surfaces after relevant changes.
