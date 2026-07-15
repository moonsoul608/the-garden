# The Garden V2 Phase 04 Report

Task: `04A-1 Auth Foundation`

Phase scope: authentication and Garden Keeper authorization foundations only

Report date: `2026-07-15`

Execution mode: local implementation and validation; no Preview or Production deployment

This report records the completed 04A-1 Auth Foundation for GitHub OAuth, cookie-backed Supabase sessions, verified server identity, and Garden Keeper authorization. It does not record a deployed OAuth provider, a bootstrapped Keeper identity, an admin route, or a completed Garden Keeper shell.

# 1. Phase 04 Overview

Phase 04 introduces GitHub authentication and the Garden Keeper administration boundary. It is intentionally divided between foundational security work and later route, deployment, and interface work.

Completed in 04A-1:

- GitHub OAuth-only configuration structure;
- PKCE callback code exchange;
- safe post-authentication redirects;
- cookie-backed Supabase SSR session handling;
- middleware session synchronization;
- verified server-side current-user handling;
- logout and redirect helpers;
- a boolean-only Garden Keeper authorization boundary;
- immutable GitHub provider-identity verification hardening;
- a boolean Keeper-status RPC that reveals no allow-list rows.

Phase 04 as a whole is not complete. Provider deployment, the one-time Keeper bootstrap, admin routes, the admin shell, content-management operations, and publishing workflows remain deferred.

# 2. 04A-1 Auth Foundation Architecture

The foundation preserves the confirmed separation of responsibilities:

```text
GitHub identity
      ↓
Supabase Auth
      ↓
Verified auth claims and auth.users identity
      ↓
private.garden_keeper_identities allow-list
      ↓
Server-side Garden Keeper authorization result
      ↓
RLS and Storage policies as final enforcement
```

Each layer answers a different question:

- GitHub proves the external identity;
- Supabase Auth establishes and verifies the application session;
- the private allow-list grants Garden Keeper status;
- server boundaries coordinate protected operations;
- RLS and Storage policies remain the final database and object enforcement layers.

The middleware does not collapse these layers. It refreshes session state only and makes no authorization decision.

# 3. Authentication Flow

The prepared PKCE flow is:

1. A future server-controlled login entry point starts GitHub OAuth through Supabase Auth.
2. GitHub authenticates the user and returns through Supabase Auth.
3. Supabase redirects the browser to `app/auth/callback/route.ts` with a short-lived authorization code.
4. The callback exchanges the code through `exchangeCodeForSession()`.
5. Supabase SSR writes the resulting session to HTTP cookies.
6. The callback redirects only to a validated same-application path.

The callback accepts a relative `next` path for future protected-route return behavior. Redirect validation rejects absolute URLs, protocol-relative values, backslash-based authority changes, and malformed values. Invalid or absent destinations fall back to `/`, preventing a query parameter from creating an open redirect.

Callback failures use a generic application error code. Raw Supabase or provider errors are not exposed to the visitor.

# 4. Session Handling

The server Supabase client continues to use request cookies through `@supabase/ssr`. The new middleware client mirrors refreshed cookies onto both the request passed to the application and the outgoing response.

On matched application requests, middleware calls `getClaims()` to verify or refresh the cookie-backed session. It then returns the request unchanged apart from synchronized authentication cookies.

Session middleware explicitly does not:

- decide whether a user is a Garden Keeper;
- redirect public visitors;
- protect an admin route;
- query or expose the Keeper allow-list;
- replace authorization checks in Server Actions or Route Handlers.

Existing public routes remain public. Static assets and Next.js image/static paths are excluded from the middleware matcher.

# 5. Server Authentication Helpers

The server-only authentication boundary provides:

- `getCurrentUser()`;
- `requireAuthenticatedUser()`;
- `logout()`;
- safe redirect normalization and redirect helpers.

Current-user identity is derived from verified JWT claims returned by `getClaims()`. The helper returns only the verified Supabase user UUID and does not trust client-supplied identity data or return mutable OAuth profile metadata. Anonymous identities are rejected.

`requireAuthenticatedUser()` raises a generic authentication-required error when no verified user is available. The logout helper returns a narrow success/failure result and does not expose provider errors. All helpers are marked server-only, use the publishable Supabase key through the normal SSR client, and do not create or expose a service-role client.

# 6. Garden Keeper Authorization Boundary

`requireGardenKeeper()` first requires a verified authenticated user and then calls the boolean-only `current_user_is_garden_keeper` RPC.

Its result is deliberately narrow:

- authorized, with the minimal verified user identity;
- unauthenticated;
- forbidden;
- authorization unavailable.

The helper never reads or returns `private.garden_keeper_identities` rows. It does not reveal the approved username, immutable GitHub provider ID, allow-list size, or the reason a specific identity did not match.

This result is prepared for a future protected admin layout, Server Actions, and Route Handlers. Those consumers have not been created in 04A-1 and must perform authorization at every protected server boundary when implemented.

# 7. Security Considerations

The completed foundation applies the following controls:

- GitHub is the only prepared external OAuth provider;
- email and SMS signups are disabled in local Supabase configuration;
- anonymous sign-in is disabled and anonymous claims are rejected;
- new signups are closed by default outside the temporary one-time Preview bootstrap window;
- authorization uses an immutable GitHub provider account ID rather than a mutable username;
- post-authentication redirects are constrained to local paths;
- session middleware performs synchronization only;
- current-user identity comes from verified claims rather than cookie session user data or client input;
- allow-list contents remain in the private schema;
- application code uses no service-role key;
- existing RLS and Storage policies remain unchanged and remain final enforcement.

The readable GitHub username remains suitable only as an operational aid during the future bootstrap. It is not an authorization key.

# 8. Migration Preparation

The prepared migration makes two narrowly scoped changes:

1. It hardens `private.is_garden_keeper()` by requiring the allow-listed user and immutable provider ID to match an actual linked `auth.identities` GitHub identity.
2. It adds `public.current_user_is_garden_keeper()`, which exposes only a boolean result to authenticated users through the Supabase Data API.

The RPC grants no access to the private table and adds no broad table or schema grant. It does not alter the existing content RLS model or any Storage policy.

The migration file is prepared in the repository only. It was not applied to Preview or Production as part of 04A-1.

# 9. Configuration Preparation

`supabase/config.toml` now contains the local GitHub provider structure and local callback allow-list. `.env.example` documents empty placeholders for the GitHub OAuth client ID and secret used by the Supabase CLI configuration.

No credential or secret value was added. Preview and Production credentials must remain separate. The hosted Preview provider configuration still requires an external operational step.

# 10. Validation Evidence

The following requested validations completed successfully:

| Check | Result |
| --- | --- |
| TypeScript typecheck | **PASS** |
| ESLint with zero warnings allowed | **PASS** |
| `git diff --check` | **PASS** |
| Admin pages added | **No** |
| Content-management workflow added | **No** |
| Publishing workflow added | **No** |
| Preview or Production migration applied | **No** |
| Production configuration changed | **No** |

An additional local `next build` was attempted. It stalled during compilation without producing diagnostics and was stopped. This report does not claim a successful production build.

# 11. Deferred Operations

The following remain incomplete and must not be inferred from the foundation code:

- creating and installing Preview GitHub OAuth credentials;
- configuring the hosted Preview Supabase GitHub provider and redirect URLs;
- temporarily enabling new signup for the initial Keeper authentication;
- recording and verifying the approved immutable GitHub provider account ID;
- inserting the one-time Keeper allow-list binding;
- disabling new signup again after bootstrap and verifying that state;
- testing the complete OAuth flow against Preview;
- creating `/admin` login, unauthorized, logout, or protected routes;
- building the Garden Keeper layout or dashboard;
- protecting future admin Server Actions and Route Handlers;
- content creation, editing, publication, archive, preview, version, curation, and upload workflows;
- applying any auth migration or configuration to Production.

# 12. Phase Status

**04A-1 Auth Foundation is complete at the repository level.** The PKCE callback, session synchronization, verified server authentication helpers, safe redirects, logout helper, boolean Keeper authorization boundary, provider-identity hardening migration, and boolean status RPC are prepared and validated.

Phase 04 is not complete. Preview OAuth deployment, Keeper bootstrap, admin route integration, the Garden Keeper shell, and all content-management and publishing operations remain deferred and unchecked.
