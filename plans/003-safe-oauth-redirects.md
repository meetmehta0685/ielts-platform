# Plan 003: Make OAuth completion and post-login redirects safe

> **Executor instructions**: Follow each step and verification gate. Stop and
> report on a STOP condition; do not improvise. Update `plans/README.md` when
> complete unless a reviewer maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat a7d0afd..HEAD -- frontend/lib/auth-redirect.ts frontend/test/auth-redirect.test.ts frontend/test/auth-callback.test.tsx frontend/components/auth/login-form.tsx frontend/components/auth/signup-form.tsx frontend/app/auth/callback/page.tsx`
> If an in-scope file changed, compare it with the excerpts below and stop on a
> material mismatch.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-verification-baseline.md`
- **Category**: bug / security
- **Planned at**: commit `a7d0afd`, 2026-07-31

## Why this matters

The login form trusts the user-controlled `redirect` query value and passes it
straight to `router.push`. Post-authentication navigation must be restricted to
internal application paths. Separately, the OAuth callback creates a timeout
inside an async function and returns cleanup from that async function, but the
React effect never receives it. When a session arrives after the initial check,
the success handler navigates to the dashboard and the stale timeout can later
navigate back to login.

Google signup and Google login also use the same callback with no destination
intent, so new OAuth users skip `/complete-profile`.

## Current state

- `frontend/components/auth/login-form.tsx:44-45`:

  ```ts
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  ```

- `frontend/components/auth/login-form.tsx:73-75`:

  ```ts
  router.push(redirectPath);
  router.refresh();
  ```

- `frontend/app/auth/callback/page.tsx:34-55` subscribes and creates a timeout.
  It clears the timeout only in a cleanup function returned by `checkSession`.
- `frontend/app/auth/callback/page.tsx:63` invokes `checkSession()` but does not
  return its cleanup from `useEffect`.
- Both OAuth buttons currently set `redirectTo` to `/auth/callback`; the
  callback always navigates to `/dashboard`.
- Routing is performed with Next.js `useRouter`; continue using it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm run test --prefix frontend -- auth-redirect.test.ts auth-callback.test.tsx` | exit 0 |
| Build | `npm run build --prefix frontend` | exit 0 |
| Focused lint | `npm run lint --prefix frontend -- lib/auth-redirect.ts test/auth-redirect.test.ts test/auth-callback.test.tsx` | exit 0 for new helper/test code |

## Scope

**In scope**:

- `frontend/lib/auth-redirect.ts` (create)
- `frontend/test/auth-redirect.test.ts` (create)
- `frontend/test/auth-callback.test.tsx` (create)
- `frontend/components/auth/login-form.tsx`
- `frontend/components/auth/signup-form.tsx`
- `frontend/app/auth/callback/page.tsx`

**Out of scope**:

- Supabase project settings, provider configuration, and email-confirmation
  policy.
- Password signup behavior and profile database schema.
- Middleware cookie format or a migration to `@supabase/ssr`.
- Visual redesign of any auth page.

## Git workflow

- Branch: `codex/003-safe-oauth-redirects`
- Commit: `fix: make oauth redirects safe and deterministic`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Centralize internal redirect validation

Create `frontend/lib/auth-redirect.ts` with:

```ts
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/dashboard"
): string
```

Rules:

- accept application-relative paths beginning with exactly one `/`;
- preserve query strings and hashes on valid internal paths;
- reject protocol-relative `//...`, schemes such as `https:` and
  `javascript:`, backslashes, control characters, and strings not beginning
  with `/`;
- return the fallback for invalid or empty input;
- validate with the `URL` constructor against a fixed dummy origin and confirm
  the parsed origin remains the dummy origin.

Update the password login form to apply this helper before `router.push`.

**Verify**:
`npm run test --prefix frontend -- auth-redirect.test.ts`
→ valid internal routes pass and every unsafe category returns `/dashboard`.

### Step 2: Preserve login-versus-signup intent through OAuth

Change OAuth redirect URLs:

- Google login:
  `/auth/callback?next=/dashboard`
- Google signup:
  `/auth/callback?next=/complete-profile`

Build them with `new URL("/auth/callback", window.location.origin)` and
`searchParams.set`, rather than string concatenation. In the callback, read
`next`, pass it through `safeInternalPath`, and use the validated result for
both immediate-session and delayed-session navigation.

Do not add user identifiers, email addresses, tokens, or other sensitive data
to the callback URL.

**Verify**:
`rg -n 'redirectTo:' frontend/components/auth/{login-form,signup-form}.tsx`
→ both call sites use callback URLs carrying their intended internal next path.

### Step 3: Make callback subscription and timeout cleanup synchronous to the effect

Refactor the callback effect so cleanup is returned directly by `useEffect`:

- declare `let subscription` and `let timeoutId` in the effect scope;
- use a `cancelled` boolean to prevent navigation after unmount;
- call the async session check from the effect;
- if subscribing, assign the subscription and timeout into effect-scope
  variables;
- on a successful auth-state event, clear the timeout before unsubscribing and
  navigating;
- in the effect cleanup, set `cancelled`, clear any timeout, and unsubscribe;
- ensure exactly one terminal navigation occurs.

Keep the existing six-second user-facing timeout unless tests show a documented
Supabase requirement to change it.

**Verify**:
`npm run test --prefix frontend -- auth-callback.test.tsx`
→ all callback timing tests pass with fake timers.

### Step 4: Add regression tests for both auth defects

Mock `@/lib/supabase`, `next/navigation`, and Sonner. Cover:

1. immediate session navigates once to the validated `next`;
2. no initial session, then auth event before six seconds, navigates once and
   does not navigate again after timers advance beyond six seconds;
3. no session or event reaches timeout and navigates once to login;
4. unmount before completion produces no navigation;
5. an unsafe `next` value falls back to `/dashboard`.

Use fake timers and restore real timers after every test.

**Verify**:
`npm run test --prefix frontend -- auth-redirect.test.ts auth-callback.test.tsx`
→ all tests pass without contacting Supabase.

## Test plan

- `frontend/test/auth-redirect.test.ts`: table-driven valid and unsafe paths.
- `frontend/test/auth-callback.test.tsx`: immediate, delayed-success,
  timeout, unmount, and unsafe-destination cases.
- Mock all network/auth behavior; never use real credentials.
- Verification: focused test command from the table.

## Done criteria

- [ ] No user-controlled string reaches `router.push` without
      `safeInternalPath`.
- [ ] Successful delayed OAuth clears its timeout before navigation.
- [ ] Effect cleanup cancels timeout and subscription on unmount.
- [ ] Google signup lands on complete profile; Google login lands on dashboard.
- [ ] Focused tests and frontend build pass.
- [ ] Only in-scope files and the plan-index status row changed.
- [ ] `plans/README.md` marks plan 003 `DONE`.

## STOP conditions

- Supabase rejects callback URLs with query parameters under the project's
  configured allowlist; report the exact rejection without changing provider
  settings.
- The callback has moved to a server route or uses a different OAuth flow.
- Tests require real Supabase credentials or a live OAuth browser session.
- Correct behavior requires changing the session-cookie architecture.

## Maintenance notes

- All future post-auth destinations must pass through `safeInternalPath`.
- If role-based onboarding is introduced, encode only a small destination
  identifier, not raw user data, into the callback URL.
- Review fake-timer cleanup carefully; this is the regression boundary for the
  original bug.
