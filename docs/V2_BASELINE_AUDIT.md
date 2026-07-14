# The Garden V2 Baseline Audit

Audit task: `00A Version 2 Documentation and Audit`  
Audit date: `2026-07-14`  
Audited checkout: branch `v2-development`, commit `1079667dc06e4d6806c10e95a47a32b8403997c6`

This report records the Phase 0 baseline only. It does not implement Version 2, change public behavior, create infrastructure, or alter Version 1 documents.

# 1. Current Project Structure

The actual Git repository is the inner `the-garden-codex-docs/` directory inside the provided workspace root. The tracked application is a single Next.js project.

```text
the-garden-codex-docs/
├── app/                 App Router pages, route handlers, page-local client components, and CSS
│   ├── (utilities)/     Garden Index route and its shared Index experience
│   ├── api/             Server-side Seed Gardener route handler
│   ├── forest/          Forest collection and dynamic detail route
│   ├── garden/          Garden collection and dynamic detail route
│   ├── greenhouse/      Greenhouse interface
│   ├── lake/            Lake collection and dynamic detail route
│   ├── ruins/           Ruins collection and dynamic detail route
│   └── search/          Standalone public Search experience
├── components/          Shared navigation, footer, cards, status, and detail renderer
├── content/             Static V1 metadata arrays and separate detail-body data
├── docs/                V1 specifications, V2 specifications, migration plan, and TODOs
├── lib/                 Region metadata, discovery helpers, and Seed Gardener validation/prompt logic
├── tests/               API unit tests, route smoke test, and browser/accessibility audit
├── types/               Shared content and Seed Gardener TypeScript types
├── package.json         Runtime dependencies and development/test commands
├── next.config.ts       Next.js configuration; currently empty
└── tsconfig.json        Strict TypeScript/App Router configuration
```

Module responsibilities:

- `app/` owns route composition and page presentation. Server Components are used by default; interactive collection/filter/random/AI experiences are isolated in files with `"use client"`.
- `components/` supplies the shared Top Bar, Garden Guide, Footer, status badge, discovery card, and common full/short detail-page renderer.
- `content/` is the canonical runtime source for V1 item metadata. `content/details.ts` separately stores the full sections, short explanations, and related paths keyed by Region and slug.
- `lib/regions.ts` stores the six public Region descriptors and utility-navigation destinations. `lib/content-discovery.ts` centralizes public item URLs and metadata search. `lib/seed-gardener.ts` owns input validation, output parsing, and the fixed AI instruction.
- `types/` defines the V1 normalized content shape and Greenhouse response shape. `SeedResult` currently exists in both `types/content.ts` and `types/seed.ts`; Greenhouse runtime code uses `types/seed.ts`.
- `tests/` contains one Node test suite for the API, one HTTP route/content smoke script, and one Chrome DevTools Protocol accessibility/responsive script.
- There is no `public/` content asset tree, database layer, service layer, authentication layer, admin area, migration tooling, or Supabase configuration in the audited checkout.

# 2. Current Technology Stack

## Framework and language

- Next.js `15.5.9`.
- React and React DOM `19.1.1`.
- TypeScript `5.9.3` with `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`, the Next.js TypeScript plugin, and the `@/*` root alias.
- App Router is used throughout. There is no Pages Router.
- Styling uses global and route-specific plain CSS files. Tailwind CSS and CSS Modules are not installed.
- Next.js built-in `Link`, Metadata API, Route Handlers, Server Components, Client Components, `generateStaticParams`, and `notFound` are used. No third-party runtime UI or state-management library is installed.

## Main dependencies

Direct runtime dependencies are limited to `next`, `react`, and `react-dom`. Development dependencies provide TypeScript, ESLint 9, Next.js ESLint rules, and React/Node type definitions. `axe-core` is available transitively in the lockfile and is loaded by the browser audit; it is not declared as a direct package dependency.

## Build and verification commands

| Purpose | Command | Current implementation |
| --- | --- | --- |
| Development | `npm run dev` | `next dev` |
| Production build | `npm run build` | `next build` |
| Production server | `npm run start` | `next start` |
| Lint | `npm run lint` | `eslint . --max-warnings=0` |
| Type checking | `npm run typecheck` | `tsc --noEmit` |
| Seed Gardener tests | `npm run test:seed-gardener` | Node test runner; 15 API/validation/provider-error cases are defined |
| Route/content smoke | `npm run test:smoke:garden-index` | Requires a running server; checks Home, `/garden-index`, and all 19 detail links |
| Browser/accessibility audit | `npm run test:phase5` | Requires a running server and local Chrome; checks six viewport widths, representative routes, axe, keyboard behavior, Greenhouse states, and reduced motion |

The package does not define a single aggregate `test` script. The browser and smoke scripts default to `http://localhost:3001` and can be pointed elsewhere with `BASE_URL`.

## API and external service

- `POST /api/seed-gardener` runs with the Node.js runtime.
- It calls DeepSeek Chat Completions at `https://api.deepseek.com/chat/completions` using `deepseek-v4-flash`.
- The only documented environment variable is server-only `DEEPSEEK_API_KEY`; `.env.example` contains an empty placeholder.
- Provider thinking is disabled, JSON output is requested, the timeout is 20 seconds, the input limit is 1,000 characters, and output is validated to the fixed `SeedResult` contract.
- Provider details and secrets are not returned to the client. Missing configuration and invalid inputs receive safe errors.
- No AI SDK is installed.

## Deployment configuration

- V1/V2 documents identify Vercel as the deployment platform and mention existing EdgeOne work outside the core V2 scope.
- The Git remote is `https://github.com/moonsoul608/the-garden.git`.
- There is no tracked `vercel.json`, EdgeOne configuration, Dockerfile, or other deployment manifest. `next.config.ts` exports an empty configuration, so the repository itself defines no redirects or rewrites.
- The audited checkout is `v2-development`, not `main`. Phase 0 therefore records this commit exactly; a later migration freeze must separately record the approved Production/main commit and deployment URL rather than assuming they are identical.

# 3. Existing V1 Features

The audited implementation is a completed static Version 1 experience with eight working public pages, four detail families, and the Greenhouse API.

## Shared public experience

- Shared Top Bar with Home mark, Search link, and Garden Guide.
- Garden Guide with all six Regions, three utility links, current-page text marker, keyboard focus handling, close button, and Escape handling.
- Shared Footer, canonical `/garden-index` and `/search` links, and a deliberately unavailable `Leave a note` state.
- Skip-to-main-content link, semantic page landmarks, visible focus styling, responsive layouts, and reduced-motion handling.
- Branded 404 page.
- Root and per-page metadata; detail metadata uses item title and summary. Root Open Graph/Twitter metadata and a local SVG favicon are present.

## Home

- Skippable Opening, Welcome, About the gardener, Currently Growing, desktop branching map, mobile path list, Recently Planted, Home-only random compass, hidden Seed interaction, and closing content.
- The map links to all six Regions.
- Currently Growing contains three Garden records plus a separately hard-coded “Continuing ‘继续吗’” card.
- Recently Planted contains two separately hard-coded cards.
- The compass can choose a Region or any of the 19 content items.

## Garden

- Four explanatory Growing Bed cards.
- Client-side Bed filter and Garden-specific metadata search.
- Search clear/reset and empty state.
- Five Seed cards with status badges and working detail routes.

## Forest

- Four interactive Trail cards and equivalent filter controls.
- Five Question cards.
- Region-specific random “A question found you” interaction.
- Encoded Greenhouse prefill link for the selected Question.

## Lake

- Six Ripple pills including All.
- Five Reflection cards filtered by `reflectionType`.
- Region-specific random “Something surfaced” interaction.

## Ruins

- Three explanatory Trace Type cards; they do not filter.
- Four Trace cards.
- Each Trace has its own detail link and a `See what grew from it` link when `grewInto` is present.
- No Ruins filter and no random Trace interaction.

## Garden Index

- Public implementation is `/garden-index`.
- It merges all four static Region arrays in stable Garden → Forest → Lake → Ruins source order.
- It supports Region, Content Type, and metadata keyword filtering plus filter reset.
- It displays all 19 content items.

## Search

- `/search` is a separate client-side search implementation.
- It searches title, summary, categories, and optional tags and groups results by Region.
- It has initial guidance, explicit clear behavior, and the confirmed no-results state.
- It does not currently initialize its query from URL search parameters; a request such as `/search?q=garden` loads the page but the input remains empty.

## Greenhouse and API

- Greenhouse accepts typed ideas, sample inputs, and Forest `?idea=` prefill.
- It implements empty, editing, loading, success, and error states; request cancellation; copy feedback; retry; edit; regenerate; and reset actions.
- The API keeps the DeepSeek key server-side, validates input and structured output, restricts Region to Garden/Forest, restricts stage to Seed/Sprout, and requires exactly three exploration paths.
- There is no saved history, content write, or publication path.

# 4. Current Data Architecture

## Storage and canonical records

V1 content is stored in tracked TypeScript files:

- `content/garden.ts`: 5 Garden Seeds.
- `content/forest.ts`: 5 Forest Questions.
- `content/lake.ts`: 5 Lake Reflections.
- `content/ruins.ts`: 4 Ruins Traces.
- `content/details.ts`: full-detail sections, short-detail explanations, unfinished messages, and related links.

`content/index.ts` exports the four arrays and creates `allContent` by concatenating them in Region order. There is no database, JSON/MDX content store, filesystem Markdown body, remote CMS, or runtime content mutation.

## Current V1 content shape

The shared `ContentItem` contains:

```text
id, slug, title, summary, region, contentType, detailLevel,
status?, categories, tags?, plantedOn?, lastTended?, cta, image?
```

Region extensions are:

- Garden: `beds[]`.
- Forest: `trails[]`.
- Lake: `reflectionType` and `reason`.
- Ruins: `traceType` and optional URL-valued `grewInto`.

Current records follow `id === slug`. Garden/Forest/Ruins carry manual statuses; Lake records omit status. All records omit tags, planted/tended dates, and images. The optional type fields exist but are not populated.

## Confirmed 19-item inventory

| Region | Slug | Detail level | Current stage/status |
| --- | --- | --- | --- |
| Garden | `building-the-garden` | full | Growing |
| Garden | `learning-psychological-statistics` | full | Growing |
| Garden | `exploring-ai-tools` | short | Sprout |
| Garden | `python-starting-from-the-basics` | short | Sprout |
| Garden | `designing-better-slides-and-documents` | short | Sprout |
| Forest | `why-exploratory-websites-invite-more-clicks` | full | Sprout |
| Forest | `does-ai-help-thinking-or-organize-answers` | short | Seed |
| Forest | `why-people-fear-forgetting` | full | Sprout |
| Forest | `how-psychology-shapes-product-and-web-design` | short | Sprout |
| Forest | `when-a-question-moves-from-forest-to-garden` | short | Seed |
| Lake | `reverse-1999` | full | not set |
| Lake | `jung-and-mandala` | short | not set |
| Lake | `the-garden` | short | not set |
| Lake | `love-love-love` | full | not set |
| Lake | `summer-ghost` | full | not set |
| Ruins | `first-version-of-home` | full | Dormant |
| Ruins | `portfolio-never-built` | short | Dormant |
| Ruins | `too-much-interaction` | short | Dormant |
| Ruins | `unfinished-continue` | short | Dormant |

Totals are 19 items: 8 full details and 11 short details.

## Current read and render flow

```text
content/{garden,forest,lake,ruins}.ts
        ├── Region page/client filter → Region cards
        ├── concatenated arrays → Garden Index / Search / Home compass
        └── [slug] route lookup
                    + content/details.ts lookup
                    → shared DetailPage renderer
```

- Region pages import their static arrays directly.
- Index and Search independently concatenate the same four arrays.
- Dynamic detail pages use `generateStaticParams()`, set `dynamicParams = false`, find the item by slug, and pass it to the shared renderer.
- The shared renderer separately looks up body content from `detailContent[item.region][item.slug]`.
- Home imports the first three Garden entries but duplicates display metadata and separately embeds the “继续吗” and Recently Planted records.
- Primary taxonomy descriptions are hard-coded in page/client files rather than stored with the content records.

## Difference from the V2 content contract

V2 requires a canonical, mutable record with lifecycle, growth stage, bilingual title/summary/body fields, Markdown body, primary categories, required tags array, cover metadata, Featured/manual order, created/published/tended/archived timestamps, and creator/updater identity. None of those V2 extensions exists in the runtime model yet.

Additional gaps:

- V1 `status` must map to V2 `growthStage`; lifecycle is entirely absent.
- V1 title and summary are single mixed-language fields, not language-specific fields.
- Body data is presentation-shaped TypeScript blocks rather than canonical Markdown.
- Relations are split between Ruins URL strings and detail-page related URLs; they do not use stable content IDs or typed relation records.
- Home cards are not canonical curation references.
- There are no Growth Notes, versions, preview tokens, archive state, redirect records, SEO cover data, or database timestamps.
- Missing historical dates cannot be derived safely from Git, filesystem, or import time under the V2 rules.

# 5. Route Inventory

## Public page routes

| Route | Implementation | Current behavior |
| --- | --- | --- |
| `/` | `app/page.tsx` | Home; 200 |
| `/garden` | `app/garden/page.tsx` | Garden collection; 200 |
| `/forest` | `app/forest/page.tsx` | Forest collection; 200 |
| `/lake` | `app/lake/page.tsx` | Lake collection; 200 |
| `/ruins` | `app/ruins/page.tsx` | Ruins collection; 200 |
| `/greenhouse` | `app/greenhouse/page.tsx` | Greenhouse; supports `idea` query prefill; 200 |
| `/garden-index` | `app/(utilities)/garden-index/page.tsx` | Actual canonical V1 Garden Index; 200 |
| `/search` | `app/search/page.tsx` | Separate Search page; 200 |
| `/index` | no route and no rewrite | 404 in the audited production build |

The runtime spot check used the existing production build and did not rebuild or call the real AI provider.

## Dynamic detail route families

- `/garden/[slug]`: 5 statically generated paths.
- `/forest/[slug]`: 5 statically generated paths.
- `/lake/[slug]`: 5 statically generated paths.
- `/ruins/[slug]`: 4 statically generated paths.

All four families use `dynamicParams = false`; unknown slugs return the branded 404. The existing route smoke test asserts that all 19 links rendered by `/garden-index` return 200.

## API route

- `POST /api/seed-gardener` is the only API route.
- An empty-object request returns the expected safe 400 response.
- No admin, authentication, preview, notes, analytics, import/export, upload, sitemap, or database API routes exist.

# 6. V1 Documentation vs Implementation Differences

## Current real state versus V1 documents

1. **The V1 TODO is current, contrary to a known-difference example in `V2_MIGRATION.md`.** `docs/TODO.md` marks Phases 0–6 and Final Acceptance complete and includes detailed verification notes. It is not presently an incomplete implementation checklist.
2. **Garden Index is `/garden-index`.** Current `docs/MASTER_SPEC.md`, `docs/CONTENT.md`, `docs/TODO.md`, navigation, tests, and runtime agree on `/garden-index`. There is no `/index` route, redirect, or rewrite.
3. **Home curation is partly canonical and partly duplicated.** The first three Currently Growing cards spread Garden records but override/add display metadata. “Continuing ‘继续吗’” and both Recently Planted cards are literal objects in `app/page.tsx`.
4. **“继续吗” is not an independent content record.** Both Home cards resolve to `/forest/why-people-fear-forgetting`, matching the current V1 decision. The Ruins trace remains the separate `/ruins/unfinished-continue` record.
5. **Some Region presentation copy differs from `docs/CONTENT.md`.** Examples include Lake’s entrance note, Ripple tagline/description, collection tagline/description, and additional eyebrow/ending action labels across Region pages. The confirmed item titles, summaries, principal detail bodies, and core Region meanings remain aligned.
6. **Hero return navigation is inconsistent.** Forest, Lake, and Ruins show a local `← Home` link in the hero; Garden does not. Shared Top Bar and Garden Guide still provide navigation everywhere.
7. **The shared type plans dates/tags/images, but data does not use them.** `plantedOn`, `lastTended`, `tags`, and `image` exist only as optional type fields and are absent from all 19 records.
8. **The two utility experiences overlap by design in V1.** Garden Index includes its own keyword search plus Region/Content Type filtering, while `/search` duplicates keyword matching in a grouped presentation.
9. **The Search page does not consume query parameters.** The route remains valid with `?q=...`, but the current client state starts blank, so it does not preserve or apply a URL query.
10. **Detail-body storage is separate from item metadata.** V1 documentation describes a shared content model, while the implementation requires both the Region array entry and a second slug-keyed entry in `content/details.ts`.
11. **`SeedResult` is defined twice.** This is an internal type duplication, not a user-visible defect; current Greenhouse code consistently imports the `types/seed.ts` version.
12. **Deployment claims are documentary rather than repository-configured.** Vercel is the documented target, but no tracked platform manifest is present.

## V2 documents versus the verified baseline

The most important documentation conflict is the public index path:

- `V2_MASTER_SPEC.md`, `V2_MIGRATION.md`, and `V2_TODO.md` describe `/index` as an existing V1 route and ask Phase 0 to confirm its rewrite behavior.
- Verified code, current V1 documentation, tests, and runtime establish `/garden-index` as the only working V1 Index route; `/index` returns 404.
- Therefore the V2 instruction to preserve all existing URLs applies to `/garden-index`. Making `/index` canonical later cannot silently remove `/garden-index`; the route policy must be reconciled before the Phase 8/Stage 11 discovery cutover.

Other V2 baseline statements are accurate: the app uses Next.js 15.5.9/React 19/App Router, includes 19 items in a 5/5/5/4 split, has four detail families, uses DeepSeek server-side, and has the documented responsive/accessibility/test baseline.

# 7. V2 Migration Points

The following are future migration points only. No work from later phases was performed during this audit.

| Current module | Future approved change | Reason | Main dependencies/order |
| --- | --- | --- | --- |
| `types/content.ts`, `types/seed.ts` | Extend/normalize domain types | Add lifecycle, V2 growth stage naming, bilingual fields, Markdown, timestamps, covers, Featured, versions, relations | V2 Phase 2 schema and Phase 3 domain contract before public read migration |
| `content/*.ts` | Convert 19 records into idempotent migration seed data, then retain as temporary fallback | Routine content changes must stop requiring source edits while preserving all IDs, slugs, copy, detail levels, and stages | Preview Supabase, validation, migration script, count/URL acceptance, rollback flag |
| `content/details.ts` | Preserve rendered meaning while converting bodies and short explanations to canonical Markdown | Current body data is component-shaped and separate from metadata | Approved Markdown mapping, bilingual fallback, detail parity checks, no invented prose |
| `lib/content-discovery.ts` and direct page imports | Introduce one shared content service | Public/admin database logic must not be duplicated; dual read must avoid duplicates | Schema/RLS, validation/auth, database-first plus measurable legacy fallback |
| Four `[slug]` pages | Move from build-time-only static array lookup to lifecycle-aware service reads | New Published items, Archived resting pages, redirects, previews, metadata, and sitemap cannot rely on fixed `generateStaticParams` plus `dynamicParams = false` | Content service, lifecycle/privacy rules, stable URL/redirect design, cache/revalidation plan |
| `app/page.tsx` | Replace embedded curation metadata with canonical content references | V2 keeps separate Currently Growing/Recently Planted meanings without duplicated content | Migrated records, `home_curation`, limits/order validation, Garden Keeper curation |
| Garden/Forest/Lake/Ruins pages | Read Published records and approved ordering from the service | Collections must support dynamic content, Featured/manual/stage/tended ordering, archive exclusion | Content service, timestamps, lifecycle filtering, fixed taxonomy seed data |
| Hard-coded Bed/Trail/Ripple/Trace descriptors | Seed and centralize fixed taxonomy/copy without making taxonomy user-creatable | V2 keeps these taxonomies fixed but allows approved copy settings | Schema/settings contract and approved editable-key list |
| `app/(utilities)/garden-index`, `app/search`, Top Bar, Guide, Footer, tests | Merge discovery into the approved canonical Index and make Search compatibility preserve query/filter parameters | Remove duplicate search logic while keeping old public entry points valid | First resolve `/garden-index` versus `/index`; then shared query contract, URL tests, navigation updates |
| `components/detail-page.tsx` | Add source-aware Path Back, optional Growth Timeline, relations, cover, save/share controls, and archived/preview states | V2 approved detail upgrades and lifecycle behavior | Content service, local visitor state, public Growth Notes, relation records, approved copy |
| Ruins `grewInto` and all detail `relatedPaths` | Convert resolvable internal targets to typed ID relations | Current relations are URL strings and include some intentionally non-clickable future labels | Imported content IDs, validation, cleanup/impact rules; do not infer relations from categories |
| Greenhouse UI/API and `lib/seed-gardener.ts` | Preserve public response, then add authorized explicit Draft handoff and bounded admin prompt settings | AI must remain server-side and must never publish automatically | Garden Keeper auth, Draft service, schema validation, AI settings constraints, rate/spam controls |
| Shared Footer `Leave a note` | Replace unavailable placeholder with approved private form | V2 explicitly approves private visitor notes, not comments | Approved copy, validation/sanitization, rate limiting, RLS, admin moderation |
| `app/layout.tsx` and metadata | Add content-level bilingual metadata, cover/fallback OG, and Published-only sitemap behavior | Current metadata is static/basic and has no lifecycle exclusions | Content service, cover Storage, archive/preview `noindex`, sitemap tests |
| New `/admin` and preview routes | Add Garden Keeper, GitHub OAuth allow-list, secure preview, editing/lifecycle/version/curation tools | Central V2 maintenance goal | Separate Preview/Production Supabase, RLS, immutable GitHub provider identity, server-side authorization |
| Local visitor features | Add Saved Paths and Recently Visited in browser storage; sharing on detail pages | Approved visitor features without visitor accounts | Stable content identity/routes, unavailable-item handling, accessibility announcements |
| Tests | Retain V1 regression coverage and add lifecycle/privacy/migration/navigation/SEO tests | Existing tests assume exactly 19 static items and `/garden-index` | Update incrementally with each approved phase; do not discard the 19-item/URL preservation fixture |

Migration dependency summary:

```text
Baseline freeze and route decision
        ↓
Preview/Production environment separation
        ↓
Schema + RLS + Storage + authentication foundation
        ↓
V2 domain types, validation, idempotent 19-item import
        ↓
Shared dual-read content service with static fallback
        ↓
Incremental public-read migration and Garden Keeper workflows
        ↓
Home/discovery/detail/Greenhouse/visitor upgrades
        ↓
Production import, database-first cutover, monitored fallback retirement
```

# 8. Risks and Recommendations

All recommendations below implement or protect decisions already present in the V2 documents; they do not add product scope.

1. **Resolve the Index route conflict before route work.** The migration inventory must treat `/garden-index` as a real protected V1 URL. Record an explicit compatibility decision before making `/index` canonical so current navigation, external links, and tests do not regress.
2. **Freeze the correct source revision.** This audit inspected `v2-development` at the commit recorded above. Stage 0 still needs the approved Production/main commit and deployment URL recorded before infrastructure or import work.
3. **Do not invent dates during import.** All 19 items lack planted/tended dates. Keep historical content dates nullable and separate technical import timestamps exactly as `V2_MIGRATION.md` requires.
4. **Preserve mixed-language content without automatic translation.** Existing single fields contain English, Chinese, and mixed text. Field mapping needs an item-by-item language decision and must not create missing translations.
5. **Treat body conversion as a content-preservation task.** `content/details.ts` includes structured lists, named notes, intentionally unresolved future path labels, and confirmed sensitive-content boundaries. Markdown conversion must retain meaning and visibility without turning internal structure into visitor copy.
6. **Avoid dual-source duplication.** Pages currently import arrays directly in several places. The future service must be introduced behind one stable public shape and must de-duplicate database and fallback records using stable source identity.
7. **Change static route generation only after lifecycle/privacy controls exist.** Removing `dynamicParams = false` too early could expose incomplete records or create inconsistent 404 behavior. Dynamic reads must enforce Published/Archived/Preview rules server-side first.
8. **Protect Draft and Review privacy at every layer.** Client-side filters are insufficient. RLS or equivalent server policy, service authorization, preview-token limits, sitemap exclusions, and metadata rules are all dependencies for public migration.
9. **Normalize relations conservatively.** Ruins `grewInto` paths are strong migration candidates; other related links should convert only when their target resolves to an existing content item. Do not infer relations from shared categories or create records for non-clickable future labels.
10. **Keep Home behavior stable during canonicalization.** “继续吗” currently points to the Forest memory Question and is not a separate item. Preserve that identity until a separately approved content decision changes it.
11. **Separate lifecycle from growth.** V1 `status` is only the source for `growthStage`. All current public records may migrate as Published, but publication state must not be inferred from growth or detail level.
12. **Preserve server-only Greenhouse controls.** Provider URL, model, API key, timeout, validation, and error mapping are code-controlled today and must remain outside editable Garden Keeper settings.
13. **Maintain rollback until explicit acceptance.** Keep the static files as a measured fallback through Preview and Production dual-read validation. Do not remove them merely because the import succeeds once.
14. **Update tests in stages, not by weakening them.** Existing checks encode valuable V1 guarantees: 19 resolvable content URLs, responsive widths, keyboard behavior, focus, reduced motion, safe AI errors, and the current canonical Index path. Route expectations should change only after the route decision is approved.
15. **Record deployment configuration outside assumptions.** The repository contains no platform manifest. Preview/Production URLs, environment bindings, OAuth callbacks, Supabase project separation, and rollback switch must be explicitly documented during their approved phases.

## Phase 0 conclusion

The current implementation is a stable, static V1 application with 19 verified content records, eight working public pages using `/garden-index`, four fixed detail families, one server-side Greenhouse API, and established accessibility/test coverage. It has none of the V2 database, Garden Keeper, lifecycle, migration, or visitor-data features yet. The primary baseline conflict to resolve later is the V2 documents' assumption that `/index` already exists. No Version 2 feature work should begin from this report alone; subsequent phases must be issued and executed separately.
