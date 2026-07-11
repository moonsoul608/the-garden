# The Garden — Version 1 TODO

## Phase 0 — Specification review

- [x] Read `AGENTS.md`
- [x] Read `docs/MASTER_SPEC.md`
- [x] Read `docs/CONTENT.md`
- [x] Report technical conflicts
- [x] Report missing dependencies
- [x] Report content that requires placeholders
- [x] Confirm implementation phases
- [x] Do not write page code before review is complete

## Phase 1 — Foundation

- [x] Create Next.js + TypeScript project
- [x] Configure linting
- [x] Configure type checking
- [x] Create shared folder structure
- [x] Create shared content types
- [x] Add Region metadata
- [x] Add Garden, Forest, Lake, and Ruins data
- [x] Normalize every content item to the shared formal type
- [x] Create global colour tokens
- [x] Create typography scale
- [x] Create spacing scale
- [x] Create button styles
- [x] Create card styles
- [x] Create status badges
- [x] Build Top Bar
- [x] Build Garden Guide
- [x] Build Footer
- [x] Keep Last tended hidden while dates are unconfirmed
- [x] Render Leave a note as unavailable without an external link
- [x] Create all main routes as stable placeholders
- [x] Run lint
- [x] Run type check
- [x] Run production build

## Phase 2A — Home

- [x] Build Opening
- [x] Add skip and reduced-motion behaviour
- [x] Build Welcome
- [x] Build About the gardener
- [x] Build Currently Growing
- [x] Build desktop branching Garden Map
- [x] Build mobile vertical path list
- [x] Build Recently Planted
- [x] Build Where next?
- [x] Add lightweight hidden Seed
- [x] Test keyboard navigation
- [x] Test mobile layout
- [x] Run lint, type check, and build

## Phase 2B — Garden

- [x] Build Garden entrance
- [x] Build Growing Beds
- [x] Build Bed filtering
- [x] Build Garden search
- [x] Build Seed collection
- [x] Build empty state
- [x] Build Garden ending
- [x] Test mobile layout
- [x] Run lint, type check, and build

## Phase 2C — Forest

- [x] Build Forest entrance
- [x] Build Trails of Thought
- [x] Build Trail filtering
- [x] Build Question collection
- [x] Build A question found you
- [x] Add Greenhouse prefill links
- [x] Build Forest ending
- [x] Test mobile layout
- [x] Run lint, type check, and build

## Phase 2D — Lake

- [x] Build Lake entrance
- [x] Build Ripple filter pills
- [x] Build Reflection collection
- [x] Build Something surfaced
- [x] Build Lake ending
- [x] Test mobile layout
- [x] Run lint, type check, and build

## Phase 2E — Ruins

- [x] Build Ruins entrance
- [x] Build explanatory Trace types
- [x] Build Trace collection
- [x] Build See what grew from it links
- [x] Build Ruins ending
- [x] Confirm that no Ruins filtering exists
- [x] Confirm that no random Trace exists
- [x] Test mobile layout
- [x] Run lint, type check, and build

## Phase 2F — Garden Index and Search

- [x] Build Garden Index
- [x] Add Region filters
- [x] Add Content Type filters
- [x] Add index search
- [x] Keep stable merged Region source ordering
- [x] Build Search the Garden
- [x] Group search results by Region
- [x] Add empty state
- [x] Test mobile layout
- [x] Run lint, type check, and build

## Phase 3 — Detail pages

- [x] Build shared short-detail template
- [x] Build Garden full-detail template
- [x] Build Forest full-detail template
- [x] Build Lake full-detail template
- [x] Build Ruins full-detail template
- [x] Build Building The Garden detail
- [x] Build Learning Psychological Statistics detail using only confirmed themes
- [x] Build exploratory-websites Question detail
- [x] Build fear-of-forgetting Question detail using only confirmed themes
- [x] Build Reverse: 1999 detail
- [x] Build 《爱爱爱》 detail
- [x] Build 《夏日幽灵》 detail
- [x] Build first-version-of-Home detail
- [x] Build all 11 confirmed short-detail pages
- [x] Add `generateStaticParams()` for all four Region route families
- [x] Return `notFound()` for invalid slugs
- [x] Confirm every card route works (19/19 return 200)
- [x] Confirm all return and related-path links resolve
- [x] Confirm Greenhouse query parameters are URL encoded
- [x] Confirm no valid CTA returns 404
- [x] Verify desktop and mobile detail layout rules
- [x] Verify reduced-motion support
- [x] Run lint, type check, and build

## Phase 4 — Greenhouse AI

- [x] Choose DeepSeek Chat Completions API, `deepseek-v4-flash`, and `DEEPSEEK_API_KEY`
- [x] Build Greenhouse entrance
- [x] Build Plant an idea input
- [x] Add sample input chips
- [x] Add Forest query prefill
- [x] Create `/api/seed-gardener`
- [x] Keep API key server-side
- [x] Add input validation
- [x] Add structured output schema
- [x] Restrict Region output to Garden or Forest
- [x] Restrict stage output to Seed or Sprout
- [x] Require exactly three exploration paths
- [x] Add empty state
- [x] Add loading state
- [x] Add success state
- [x] Add error state
- [x] Add Copy this Seed
- [x] Add Grow it again
- [x] Add Edit the idea
- [x] Add Plant another idea
- [x] Add live-region announcements
- [x] Review basic rate limiting; defer unreliable process-local limiting until deployment needs justify shared infrastructure
- [x] Run lint, type check, and build

Phase 4 verification note: UI states, actions, request cancellation, Forest prefill, samples, validation, safe error responses, responsive layout, and reduced motion are implemented. The provider uses DeepSeek `POST /chat/completions` with `deepseek-v4-flash` and thinking disabled. A real online success call remains blocked until `DEEPSEEK_API_KEY` is configured locally and the account has available balance.

## Phase 5 — Responsive and accessibility review

- [x] Verify all mobile pages avoid horizontal overflow
- [x] Verify touch target sizes
- [x] Verify keyboard navigation
- [x] Verify visible focus states
- [x] Verify semantic heading order
- [x] Verify text contrast
- [x] Verify icon labels
- [x] Verify no essential hover-only content
- [x] Verify `prefers-reduced-motion`
- [x] Verify Greenhouse live regions
- [x] Verify Garden Guide mobile behaviour
- [x] Add a shared `Skip to main content` link targeting the real page `main`
- [x] Verify 320, 390, 500, 768, 1024, and 1440 CSS-pixel viewports
- [x] Verify all eight main pages and full/short detail templates with browser automation and axe
- [x] Verify all 19 detail routes and `/garden-index` return 200
- [x] Verify the Seed Gardener API keeps safe validation behaviour
- [x] Run lint, type check, production build, existing tests, and the Phase 5 browser audit

Phase 5 issues found and fixed:

- The shared layout had no skip link or stable `main` target. Added the first-Tab skip link and `main#main-content` on every route family.
- Garden Guide relied only on native `<details>` state. Added explicit `aria-expanded`/`aria-controls`, a named close button, Escape handling, deterministic opening focus, focus return, and a working Footer entry. It remains a non-modal popover; background content is not incorrectly made inert.
- Several Home sections referenced missing heading IDs. Connected every `aria-labelledby` value to its real `h2`.
- Garden and Index selected filters communicated visually mainly through colour. Added a visible check marker while retaining `aria-pressed`.
- Garden, Index, and Search lacked a consistently keyboard-reachable explicit clear action. Added named clear controls and an always-available Index filter reset.
- The Greenhouse submit button became natively disabled during loading, which could drop keyboard focus. It now retains focus with `aria-disabled` while the submit handler still blocks repeated requests.
- Forest and Greenhouse used scripted smooth scrolling even under reduced motion. Their scrolling now follows `prefers-reduced-motion`.
- axe found insufficient contrast in four Forest trail descriptions and the Lake Ripples description. Two additional small metadata colours were also below 4.5:1 in manual contrast calculations. The affected text colours were minimally darkened without changing the palette.
- Narrow Top Bar spacing risked crowding at 320px. Mobile typography and spacing were tightened while keeping 44px Search and Guide targets.

Phase 5 verification note: the local Chrome/CDP audit covered 6 viewports × 16 representative routes (all eight main pages plus one full and one short detail per Region), with `scrollWidth` equal to the viewport in every case. axe reported zero violations after fixes on all 16 representative routes. Keyboard automation covered first/last-direction focus movement primitives, Space/Enter button activation, filters, explicit search clears, Garden Guide open/close/Escape/focus return, Greenhouse prefill/error/retry/copy/grow-again/edit/reset, related paths, visible focus outlines, and reduced motion. A separate HTTP smoke check returned 200 for all eight main pages and all 19 details; an empty API request returned the expected safe 400 response. No hydration warning appeared in the development console.

Phase 6 visual-only follow-up: no unresolved accessibility defect was reclassified as visual polish. Decorative hills, ripples, mist, and Region artwork intentionally clip inside decorative containers; they do not increase document `scrollWidth` or hide content. Any later refinement of their density or composition remains optional Phase 6 work.

## Phase 6 — Visual polish

- [x] Add one restrained environmental animation per Region at most
- [x] Add Home path highlight
- [x] Add Forest path-sign visual treatment
- [x] Add Lake ripple treatment
- [x] Add Ruins paper/stone accents
- [x] Add Greenhouse sprout loading animation
- [x] Keep mobile motion simpler
- [x] Confirm all Regions still share one visual system

Phase 6 issues found and fixed:

- Added a restrained Home map-path highlight for the corresponding hover or keyboard-focus node without changing the map structure or mobile path list.
- Added a lightweight local SVG favicon plus root Open Graph and Twitter summary metadata while retaining every page-specific and dynamic detail title/description.
- Added a branded, accessible 404 state so invalid detail slugs no longer look like a framework error page.
- Stabilized the Garden Guide current-path marker after client mount. This preserves its existing keyboard/focus behavior while preventing a production hydration mismatch when the server fallback path differs from the browser URL.
- Removed the unused Phase 1 placeholder component and its orphaned CSS selectors. No visitor-facing confirmed content was rewritten.
- Removed browser profiles, screenshots, and temporary Phase 5/6 audit artifacts from the workspace.

Phase 6 verification note: visual review covered all eight main pages and one full plus one short detail page per Region at 320px and 1440px, with automated overflow regression at 320, 390, 500, 768, 1024, and 1440 CSS pixels. The final production audit reported zero axe violations and zero Phase 5 browser-audit failures. HTTP checks returned 200 for all eight main routes and all 19 details, the invalid detail returned the branded 404, and 41 rendered internal link targets resolved without empty or placeholder href values. Client chunks contained neither the configured secret nor server-only DeepSeek markers. A production console audit across 17 representative routes reported zero hydration warnings and zero browser exceptions after the Garden Guide fix.

Production route follow-up: Garden Index now uses `/garden-index` as its only public route. The conflicting `/index` rewrite and `/garden-index` redirect were removed, and shared navigation, documentation, and automated browser coverage now use the canonical route.

Known non-blocking release notes:

- A paid live DeepSeek request was intentionally not made during final QA. The server request shape, model, disabled thinking mode, safe provider-error mapping, missing-key 503, and `SeedResult` validation remain covered by the 15 passing Seed Gardener tests; deployment still requires a valid `DEEPSEEK_API_KEY` and available provider balance.
- Next.js 15.5.9 logs an internal `NoFallbackError` server diagnostic when QA deliberately requests an ungenerated slug under a `dynamicParams = false` detail route. The response remains a stable branded 404, no technical detail is shown to the visitor, and the page hydrates without warning.

## Final acceptance

- [x] Eight main pages load
- [x] Six Regions appear in Garden Guide
- [x] Home map works on desktop and mobile
- [x] Garden filtering and search work
- [x] Forest filtering and random Question work
- [x] Lake filtering and random Reflection work
- [x] Ruins related-growth links work
- [x] Greenhouse structured AI output works
- [x] Forest prefill works
- [x] Garden Index includes all four content types
- [x] Search returns expected matches
- [x] All cards have valid detail routes
- [x] No private API key appears client-side
- [x] No personal information was invented
- [x] Production build succeeds

Final acceptance status: Phases 0 through 6 are complete. The Version 1 release criteria are satisfied subject only to the documented deployment-time DeepSeek key/balance requirement and the non-user-facing Next.js invalid-slug diagnostic above.
