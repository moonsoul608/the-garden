# The Garden V2 Phase 01B Report

Task: `01B Supabase Foundation`  
Report date: `2026-07-14`  
Repository: `D:\the-garden\the-garden-codex-docs\the-garden-codex-docs`

This report covers only the Supabase foundation requested for Phase 01B. It does not claim that a live Supabase connection, Preview/Production project isolation, or a production build was verified.

# 1. Supabase Integration Status

- Installed the official `@supabase/supabase-js` SDK at `2.110.3`.
- Installed the official Next.js server-rendering helper `@supabase/ssr` at `0.12.1`.
- `package.json` and `package-lock.json` contain the dependency changes.
- The integration currently provides initialization utilities only. No Supabase query is used by a page or content service.
- No live Supabase project credentials were available, so no connection success is claimed.
- No privileged server client was created. `SUPABASE_SECRET_KEY` is reserved for a later authorized administrative or migration phase and is not read by Phase 01B code.

Current status: **foundation implemented; live connection unverified**.

# 2. Environment Configuration

The following variables were planned:

| Variable | Exposure | Phase 01B use |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Required when either Supabase client is created. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Required when either Supabase client is created. This is the public project key, not a secret. |
| `SUPABASE_SECRET_KEY` | Server only | Reserved for later approved privileged operations; unused in Phase 01B. It must never use the `NEXT_PUBLIC_` prefix. |

File behavior:

- `.env.example` now documents empty placeholders only; it contains no real key.
- `.env.local` retains the existing DeepSeek value and contains empty Supabase placeholders for local V2 setup. The file is ignored by Git through the existing `.env*` rule.
- Missing public Supabase values are checked when a client is created. The client factory throws a concise configuration error instead of attempting a request with undefined values.
- `NEXT_PUBLIC_SUPABASE_URL` is also checked for a valid HTTP(S) URL.

Environment separation plan:

- Local V2 development and Vercel Preview must use the Supabase Preview project values.
- Vercel Production must use the Supabase Production project values under the same variable names.
- Values must be configured separately in Vercel's Preview and Production environment scopes; the application must not select between embedded Preview and Production credentials.
- Preview and Production Supabase projects and credentials were not available in this task. Therefore, Preview-write/Production-read isolation is **not verified**.

# 3. Client Architecture

## Browser client

Location: `lib/supabase/client.ts`

- Uses `createBrowserClient` from `@supabase/ssr`.
- Uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Intended for future Client Components that require browser-side Supabase access.

Usage:

```ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
```

## Server client

Location: `lib/supabase/server.ts`

- Is marked server-only.
- Uses `createServerClient` from `@supabase/ssr`.
- Reads the App Router cookie store through `next/headers`.
- Is asynchronous because `cookies()` is asynchronous in the current Next.js version.
- Uses the publishable project key and does not create a privileged/service-role client.
- Includes the cookie adapter required by the recommended App Router client structure. Authentication proxy/session refresh work is intentionally deferred.

Usage in a future Server Component, Server Action, or Route Handler:

```ts
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
```

## Shared configuration

Location: `lib/supabase/config.ts`

- Centralizes public environment reads and safe missing-configuration errors.
- Performs validation only when a client is requested, so existing V1 pages do not require Supabase configuration during their current static data flow.

# 4. Validation Results

No validation command was rerun while completing this report.

| Check | Result | Actual evidence / limitation |
| --- | --- | --- |
| Dependency resolution | **PASS** | `npm install @supabase/supabase-js @supabase/ssr` completed and added the two direct dependencies. `npm ls` reported `@supabase/ssr@0.12.1` and `@supabase/supabase-js@2.110.3`. |
| TypeScript | **PASS** | The earlier `npm run typecheck` completed successfully with no TypeScript errors. It was not rerun after the user requested that repeated validation stop. No source changes were made after that successful check other than this Markdown report. |
| Lint | **PARTIAL** | The standard `npm run lint` inspected the pre-existing, Git-ignored `.chrome-cdp-audit` Chrome profile and failed on generated extension JavaScript. A focused rerun using the same rules with `--ignore-pattern .chrome-cdp-audit/**` completed successfully. The package script itself was not changed, and lint was not rerun for this report. |
| Production build | **NOT VERIFIED** | `npm run build` started, loaded `.env.local`, and then produced no further output for an extended period in the restricted execution environment. It was interrupted without a success or failure result and was not rerun by instruction. |
| Development startup | **NOT VERIFIED** | No new development-server startup check was completed after the foundation changes. It was not run while completing this report. |
| Live Supabase connection | **NOT VERIFIED** | No real Supabase URL or key was supplied. No connection was attempted and no success is claimed. |
| Preview/Production isolation | **NOT VERIFIED** | Separate projects and Vercel environment bindings require external Supabase/Vercel configuration that was not available locally. |

# 5. Changes Made

Tracked repository changes:

- `.env.example` — documents the public Supabase project variables and the reserved server-only secret variable without real values.
- `package.json` — adds `@supabase/supabase-js` and `@supabase/ssr`.
- `package-lock.json` — locks the installed Supabase dependency graph.
- `lib/supabase/config.ts` — validates public Supabase configuration lazily and returns safe setup errors.
- `lib/supabase/client.ts` — creates the browser client.
- `lib/supabase/server.ts` — creates the App Router server client with cookie access.
- `docs/V2_PHASE_01B_REPORT.md` — records the implementation and verification state.

Local ignored change:

- `.env.local` — adds empty Supabase placeholders while preserving the existing DeepSeek configuration. It remains untracked and contains no supplied Supabase credential.

Scope inspection found no changes to:

- `app/` pages or route handlers;
- `components/`;
- `content/`;
- content types or content discovery;
- `next.config.ts`;
- existing V1 page data sources.

# 6. Limitations

The current repository has no Phase 2 or later Supabase implementation. Specifically, Phase 01B created none of the following:

- database tables;
- database Schema or schema migration;
- RLS policies;
- Storage buckets or Storage policies;
- authentication or GitHub OAuth flow;
- service-role/privileged Supabase client;
- content migration;
- database-backed content service;
- Garden Keeper admin;
- page data-source replacement.

There is also no verified live Supabase Preview project, Supabase Production project, Vercel environment binding, or cross-environment isolation result.

# 7. Phase 01B Acceptance Status

| Acceptance item | Status | Evidence / limitation |
| --- | --- | --- |
| Supabase foundation dependencies complete | **PASS** | The two official packages are installed and locked. |
| Environment-variable structure complete | **PASS (structure)** | Public and reserved server-only variables are documented with empty placeholders; no real Supabase secret is committed. External Preview/Production values remain unconfigured and unverified. |
| Client initialization complete | **PASS** | Browser, server, and shared configuration utilities exist under `lib/supabase/`. |
| V1 functionality unaffected | **PASS by change scope; runtime not fully verified** | No V1 page, content file, route, component, or data source changed. TypeScript passed, but build and startup completion were not verified. |
| Lint passes | **PARTIAL** | Project source passed when the pre-existing generated Chrome audit directory was excluded; the unchanged standard script still encounters that ignored directory. |
| Typecheck passes | **PASS** | Completed successfully before report generation. |
| Build passes | **NOT VERIFIED** | The restricted build attempt did not complete and was not rerun. |

Phase 01B repository implementation is complete within the requested scope. Full environment acceptance remains conditional on a successful build/start check and real, separately configured Supabase Preview and Production projects in a later infrastructure verification step.
