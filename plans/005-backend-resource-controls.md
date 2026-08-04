# Plan 005: Bound uploads and rate-limit costly backend operations

> **Executor instructions**: Follow each step and verification gate. Stop and
> report on a STOP condition; do not improvise. Update `plans/README.md` when
> complete unless a reviewer maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat a7d0afd..HEAD -- backend/package.json backend/package-lock.json backend/src/server.ts backend/src/app.ts backend/src/config/limits.ts backend/src/middleware/rateLimits.ts backend/src/middleware/errorHandler.ts backend/src/routes backend/test`
> If an in-scope file changed, compare it with the excerpts below and stop on a
> material mismatch.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-verification-baseline.md`
- **Category**: security / reliability
- **Planned at**: commit `a7d0afd`, 2026-07-31

## Why this matters

The audio endpoint uses Multer memory storage without a file-size limit or MIME
allowlist. An authenticated request can therefore make the process retain a
large upload in memory before transcription. The same authenticated user can
also call transcription, text-to-speech, chat, writing, speaking, planner, and
AI-assisted test grading repeatedly with no rate limit, consuming provider
quota or degrading the service.

This plan establishes explicit upload constraints, authenticated per-user rate
limits, consistent `413` and `429` responses, and integration tests that do not
call external providers.

## Current state

- `backend/src/routes/speakingRoutes.ts:7-9`:

  ```ts
  const upload = multer({ storage: multer.memoryStorage() });
  router.post(
    "/transcribe",
    requireAuth,
    upload.single("audio"),
    SpeakingController.transcribeAudio
  );
  ```

- `backend/src/server.ts:19-34` configures CORS/JSON parsing and mounts all
  routes directly. It calls `app.listen` in the same module, which makes
  integration testing awkward.
- `requireAuth` attaches the verified Supabase user to `req.user`; use
  `req.user.id` as the rate-limit key after authentication.
- Costly endpoints include:
  - `POST /api/chat/stream`
  - `POST /api/writing/evaluate`
  - `POST /api/speaking/transcribe`
  - `POST /api/speaking/evaluate`
  - `POST /api/speaking/synthesize`
  - `POST /api/planner/generate`
  - reading/listening submission endpoints when they request AI explanations.
- The backend uses Express 5 and npm.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install limiter | `npm install express-rate-limit --prefix backend` | exit 0; manifest and lockfile updated |
| Focused tests | `npm run test --prefix backend -- resource-controls.test.ts` | exit 0 |
| Build | `npm run build --prefix backend` | exit 0 |
| Full verify | `npm run verify` | exit 0 |

## Scope

**In scope**:

- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/server.ts`
- `backend/src/app.ts` (create)
- `backend/src/config/limits.ts` (create)
- `backend/src/middleware/rateLimits.ts` (create)
- `backend/src/middleware/errorHandler.ts` (create if needed)
- `backend/src/routes/chatRoutes.ts`
- `backend/src/routes/writingRoutes.ts`
- `backend/src/routes/speakingRoutes.ts`
- `backend/src/routes/plannerRoutes.ts`
- `backend/src/routes/testRoutes.ts`
- `backend/test/resource-controls.test.ts` (create)

**Out of scope**:

- Redis or another distributed rate-limit store.
- Pricing, billing, subscription tiers, or permanent usage accounting.
- Provider/model configuration.
- Controller prompts and response payloads except standardized resource-limit
  errors.
- CORS redesign and authentication architecture.

## Git workflow

- Branch: `codex/005-backend-resource-controls`
- Commit: `fix: bound uploads and rate-limit ai endpoints`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Separate app construction from process startup

Create `backend/src/app.ts` containing Express construction, middleware, route
mounts, and the health endpoint. Export the app without listening. Reduce
`backend/src/server.ts` to environment loading, importing the app, selecting
the port, and calling `listen`.

Preserve the current route URLs and health response exactly.

This separation is required so Supertest can exercise middleware without
opening a TCP port.

**Verify**:

1. `npm run build --prefix backend` → exit 0.
2. Start the built server and request `/` → status 200 with the existing JSON
   message.

### Step 2: Define explicit, configurable limits

Create `backend/src/config/limits.ts` with parsed, bounded configuration:

- audio upload maximum default: 10 MiB;
- AI request window default: 15 minutes;
- per-user AI request maximum default: choose and document a conservative
  value such as 30 per window;
- optional environment overrides with names documented in comments and in an
  `.env.example` only if such a file is added in a separate approved docs
  change.

Reject invalid/negative environment values by falling back to safe defaults
and logging only the variable name, never its value.

Set Multer:

- `memoryStorage`;
- `limits.fileSize` to the configured maximum;
- `limits.files` to 1;
- a MIME allowlist covering the formats actually produced by the frontend
  (`audio/webm`) plus explicitly supported WAV/MPEG formats.

Return `415` for unsupported media types and `413` for oversized files.

**Verify**: backend build exits 0.

### Step 3: Add an authenticated per-user AI limiter

Install `express-rate-limit`. Create
`backend/src/middleware/rateLimits.ts` exporting a limiter configured with:

- `standardHeaders: true`;
- `legacyHeaders: false`;
- JSON `429` response with a stable, non-sensitive error message;
- key derived from `req.user.id`.

Mount it after `requireAuth`, never before, on every costly endpoint listed in
Current state. Keep cheap history/list endpoints outside the AI limiter.

For reading/listening submissions, either use the same limiter because they
may invoke AI explanations, or split deterministic grading from explanations
in a future plan. Do not silently disable explanations here.

**Verify**:
`rg -n 'requireAuth,.*aiRateLimit|requireAuth,\\s*$' backend/src/routes`
→ every listed costly route shows auth before the limiter.

### Step 4: Add centralized resource-error handling

Add an Express error handler after routes that recognizes:

- Multer `LIMIT_FILE_SIZE` → `413`;
- unsupported audio MIME type → `415`;
- rate-limit responses are already `429`;
- unknown errors pass to the existing/default 500 handling without exposing
  stack traces.

Do not return provider response bodies or credentials.

**Verify**: backend build exits 0.

### Step 5: Add offline integration tests

Create `backend/test/resource-controls.test.ts` using Supertest. Mock
`requireAuth` or the Supabase client so tests use a fixed synthetic user ID and
never call Supabase. Mock controllers/provider services so tests never call
OpenRouter, Groq, or ElevenLabs.

Cover:

- health endpoint still returns 200;
- protected endpoints still return 401 when the real auth middleware is used;
- a valid small `audio/webm` request passes upload middleware to the mocked
  controller;
- unsupported MIME returns 415;
- payload above the configured test limit returns 413;
- repeated requests from one synthetic user reach 429;
- a different synthetic user has an independent quota;
- response includes standard rate-limit headers.

Allow the limiter factory to accept test overrides instead of making dozens of
requests in the suite.

**Verify**:
`npm run test --prefix backend -- resource-controls.test.ts`
→ all cases pass offline.

### Step 6: Run full verification

Run package tests/build and root verification. Inspect the lockfile diff for
the intended limiter and its transitive dependencies only.

**Verify**: `npm run verify` → exit 0.

## Test plan

- Supertest integration coverage for `200`, `401`, `413`, `415`, and `429`.
- User-key isolation test.
- No live network, credential, or provider usage.
- Existing health response and route paths are regression-locked.
- Verification: focused backend tests plus root `verify`.

## Done criteria

- [ ] Audio memory usage is bounded by an explicit file-size limit.
- [ ] Unsupported audio MIME types are rejected before controller/provider use.
- [ ] Every costly route applies auth before the per-user limiter.
- [ ] `413`, `415`, and `429` responses are deterministic and tested.
- [ ] App construction is importable without opening a port.
- [ ] No test invokes Supabase or an AI/audio provider.
- [ ] Backend build, focused tests, and root verify pass.
- [ ] Only in-scope files and the plan-index status row changed.
- [ ] `plans/README.md` marks plan 005 `DONE`.

## STOP conditions

- Deployment uses multiple backend instances and the operator requires a
  globally consistent quota now; an external shared store must be selected
  before implementation.
- The product has documented per-tier quotas that conflict with the proposed
  defaults.
- Frontend clients upload a required audio MIME type not listed in the current
  source.
- Testing middleware requires real auth credentials or provider calls.
- Express app extraction changes any public route or health response.

## Maintenance notes

- In-memory limits are per process. Move to a shared store before horizontal
  scaling if quotas must be globally enforced.
- Rate limiting is abuse protection, not billing/accounting.
- Revisit the 10 MiB default when supported recording durations or codecs
  change.
- Dependency advisories affecting Multer remain a separate upgrade task; limits
  reduce exposure but do not replace patching.
