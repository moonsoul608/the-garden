# The Garden V2 Phase 01A Report

Task: `01A Branch and Preview Deployment`  
Report date: `2026-07-14`  
Repository: `https://github.com/moonsoul608/the-garden.git`  
Audited repository root: `D:\the-garden\the-garden-codex-docs\the-garden-codex-docs`

This report covers only Phase 1A. No Supabase project, dependency, database, content-system change, business-page change, or route migration was created or performed.

# 1. Git Branch Status

- Current local branch: `v2-development`.
- Current commit: `db230481cae58db43cc041104d55476bdc08d1f1` (`docs: add V2 baseline audit`).
- Configured upstream: `origin/v2-development`.
- Remote verification: a live `git ls-remote` check confirmed that `origin/v2-development` exists at the same commit, `db230481cae58db43cc041104d55476bdc08d1f1`.
- Branch tracking state before this report: synchronized with `origin/v2-development` (zero commits ahead and zero commits behind).
- Working tree before this task's report was created: clean.
- Working tree after this task: only this report is newly added; generated `.next` output and TypeScript build metadata remain ignored.

Branch purposes:

- `main` is the intended Vercel Production branch and must remain the only branch that promotes automatically to Production.
- `v2-development` is the dedicated V2 development branch and must produce Vercel Preview Deployments only.

Relevant branch relationship:

- Live remote `main`: `7b6eb0c9a4d5086add7b477bfe5f92a40058a648` (`Fix Garden Index routing`).
- Live remote `v2-development`: `db230481cae58db43cc041104d55476bdc08d1f1`.
- `origin/main` is an ancestor of `origin/v2-development`; the V2 branch is two commits ahead and has not diverged from the remote Production branch.
- The local `main` branch is at `1079667dc06e4d6806c10e95a47a32b8403997c6`, one commit ahead of `origin/main`. This is not a current deployment conflict because it has not been pushed to remote `main`, but future work must not push or merge it into `main` until a Production release is explicitly approved.

# 2. Current Deployment Configuration

## Repository configuration

- `vercel.json`: not present.
- `.vercelignore`: not present.
- `.vercel/` project-link metadata: not present.
- `next.config.ts`: present and exports an empty `NextConfig`; it defines no custom output mode, redirects, rewrites, headers, or deployment-specific branch behavior.
- `package.json` build script: `next build`.
- `package.json` start script: `next start`.
- Framework versions: Next.js `15.5.9`, React `19.1.1`, and TypeScript `5.9.3`.
- Lockfile: `package-lock.json` is present, allowing reproducible npm installation on Vercel.
- Other deployment configuration: no tracked Vercel, EdgeOne, Docker, Netlify, Cloudflare, GitHub Actions deployment, YAML deployment, or other platform manifest was found.
- Environment contract currently documented by the repository: server-only `DEEPSEEK_API_KEY` in `.env.example`. Its absence does not fail the build; the Greenhouse API returns a safe configuration error. No Supabase variables or dependencies were added.

## Production branch strategy

The repository and V2 migration documents consistently assign:

- `main` → Vercel Production;
- `v2-development` → Vercel Preview.

No repository configuration overrides or conflicts with this strategy. Vercel's actual Production Branch selection and Git integration settings are dashboard-managed and are not stored in this checkout, so they could not be independently confirmed from local files.

## Preview Deployment conditions

The repository-side conditions for a standard Vercel Preview Deployment are satisfied:

1. `v2-development` exists locally and remotely.
2. The local branch tracks the matching remote branch.
3. The project is a supported Next.js application with a lockfile and a successful `next build`.
4. There is no `vercel.json`, `.vercelignore`, Ignored Build Step configuration in the repository, or branch-specific build rule that would suppress Preview builds.
5. The V2 branch is separate from remote `main`, so deploying it as Preview does not require changing the Production branch.

An actual Preview Deployment URL cannot be confirmed from the repository alone. It depends on the Vercel project being connected to this GitHub repository, Preview Deployments being enabled, and the Vercel project not having a dashboard-only ignored-build rule for `v2-development`.

# 3. Validation Results

All commands were run from the actual inner Git repository on `v2-development` at commit `db23048`.

| Check | Command | Actual result |
| --- | --- | --- |
| Lint | `npm run lint` | **PASS** — ESLint completed with `--max-warnings=0`; no errors or warnings were reported. |
| TypeScript | `npm run typecheck` | **PASS** — `tsc --noEmit` completed successfully. |
| Production build | `npm run build` | **PASS** — Next.js 15.5.9 compiled successfully, checked types, generated all 32 static pages, and completed page optimization/build traces. The initial sandboxed attempt could not run Next.js child processes; the definitive build was rerun with child-process permission and passed. |
| Seed Gardener tests | `npm run test:seed-gardener` | **PASS** — 15 tests passed; 0 failed, skipped, or cancelled. No real paid DeepSeek request was made. |
| Garden Index route smoke | `npm run test:smoke:garden-index` | **PASS** — Home and `/garden-index` returned 200, canonical routes remained distinct, and all 19 content links returned 200. |
| Browser/accessibility audit | `npm run test:phase5` | **PASS** — the definitive run completed successfully using headless Chrome outside the restricted sandbox. All emitted responsive checks passed across 320, 390, 500, 768, 1024, and 1440 px viewports; all tested routes had no horizontal overflow; axe checks reported no violations on the 16 representative pages; keyboard, focus, Garden Guide, filter, search, and reduced-motion checks passed. The first sandboxed Chrome launch failed with exit code `2147483651`; this was an execution-environment restriction, not a project test failure. |

The repository does not define a single aggregate `test` script. Every test command currently declared in `package.json` was run individually.

# 4. Changes Made

- Added `docs/V2_PHASE_01A_REPORT.md` to record the Phase 1A branch, deployment configuration, validation evidence, remaining manual actions, and acceptance status.

No deployment configuration changes were required.

No application source, business page, content data, route behavior, dependency, environment file, or Supabase-related file was changed.

# 5. Manual Vercel Actions Required

The following steps still require access to the Vercel dashboard. They have **not** been represented as completed in this report:

1. Open the Vercel project for The Garden and confirm that its connected Git repository is `moonsoul608/the-garden`.
2. In **Project Settings → Git**, confirm that **Production Branch** is exactly `main`.
3. Confirm that Preview Deployments are enabled for non-Production branches and that no dashboard-only **Ignored Build Step** excludes `v2-development`.
4. Locate the deployment for commit `db230481cae58db43cc041104d55476bdc08d1f1` on `v2-development`. If no deployment exists, trigger it through a new push/redeploy without changing the Production branch.
5. Record and open the generated Preview URL. Confirm that Vercel labels the deployment as **Preview**, not **Production**, and that the build completes successfully.
6. Run a short Preview smoke check for `/`, `/garden-index`, `/search`, `/greenhouse`, and one representative detail route. A real Greenhouse provider request is optional for Phase 1A; if it is required later, configure `DEEPSEEK_API_KEY` for the Preview environment only.
7. Open the current Production deployment and confirm that its source branch remains `main` and that no `v2-development` deployment has been promoted or aliased to the Production domain.
8. Record the confirmed Preview URL, Production URL, and deployed source commits in the next authorized infrastructure record. Do not add Supabase settings during this Phase 1A verification.

# 6. Phase 1A Acceptance Status

| Acceptance item | Status | Evidence / limitation |
| --- | --- | --- |
| `v2-development` branch established | **PASS** | Exists locally and on `origin` at `db23048`. |
| Tracks `origin/v2-development` | **PASS** | Upstream is configured and local/remote commits match. |
| `main` remains Production | **PENDING MANUAL VERCEL CONFIRMATION** | The required strategy is documented and there is no repository conflict, but the dashboard-only Production Branch setting is not available locally. |
| Preview build conditions satisfied | **PASS (repository/build)** | Supported Next.js project, remote branch present, lockfile present, no repository exclusion, and production build plus all existing tests pass. Actual Preview URL still requires dashboard verification. |
| Production unaffected | **PASS (repository scope); PENDING LIVE CONFIRMATION** | No Production branch, deployment configuration, application, or business files were changed or pushed. The live Production deployment/alias must still be confirmed in Vercel. |

Phase 1A is complete for all repository-controlled work. Full environment acceptance remains conditional on the manual Vercel checks above, especially confirmation of the Production Branch and the actual Preview Deployment URL.
