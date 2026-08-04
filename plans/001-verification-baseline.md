# Plan 001: Establish a repeatable verification baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update this plan's status row in
> `plans/README.md`, unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a7d0afd..HEAD -- package.json frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/test backend/package.json backend/package-lock.json backend/vitest.config.ts backend/test`
> If an in-scope file changed since this plan was written, compare the current
> code with the excerpts below. On a material mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / DX
- **Planned at**: commit `a7d0afd`, 2026-07-31

## Why this matters

There is currently no working one-command regression check. The backend's
`test` script intentionally exits with an error, the frontend has no test
script, and the existing frontend lint command fails on 178 findings. The next
plans change authentication, streaming, simulator scoring, and request
boundaries; those changes should not land without deterministic tests.

This plan adds Vitest to both packages, small smoke tests around existing pure
utilities, and root commands that build and test both packages. It does not
attempt the unrelated full lint cleanup.

## Current state

- `package.json` is only a development runner. It has no build, test, or verify
  command.
- `frontend/package.json:5-9` currently contains:

  ```json
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
  ```

- `backend/package.json:7-12` currently contains:

  ```json
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc && cp -r src/data dist/data",
    "start": "node dist/server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
  ```

- `backend/src/utils/bandScore.ts` is a pure scoring utility and is the safest
  backend test seed.
- `frontend/lib/utils.ts` exports the pure `cn(...)` class-name helper and is
  the safest frontend test seed.
- Package management is npm with one lockfile per package. Preserve that
  convention.
- Recent commits use Conventional Commit prefixes such as `fix:`, `chore:`,
  and `feat:`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install frontend test dependencies | `npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event --prefix frontend` | exit 0; frontend manifest and lockfile updated |
| Install backend test dependencies | `npm install --save-dev vitest supertest @types/supertest --prefix backend` | exit 0; backend manifest and lockfile updated |
| Frontend build | `npm run build --prefix frontend` | exit 0 |
| Backend build | `npm run build --prefix backend` | exit 0 |
| All tests | `npm test` | exit 0 |
| Full baseline | `npm run verify` | exit 0 |

## Scope

**In scope**:

- `package.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/vitest.config.ts` (create)
- `frontend/test/setup.ts` (create)
- `frontend/test/utils.test.ts` (create)
- `backend/package.json`
- `backend/package-lock.json`
- `backend/vitest.config.ts` (create)
- `backend/test/bandScore.test.ts` (create)

**Out of scope**:

- All production `.ts` and `.tsx` files.
- ESLint configuration and the existing 178 lint findings.
- Browser E2E tooling; component and integration coverage will be added by the
  behavior plans.
- CI workflow creation. First establish commands that CI can call.

## Git workflow

- Branch: `codex/001-verification-baseline`
- Use one logical commit: `test: establish frontend and backend verification baseline`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Install and configure Vitest in both packages

Run the two install commands from the table. Add:

- `frontend/vitest.config.ts` using `defineConfig`, the `jsdom` environment,
  `frontend/test/setup.ts`, and the existing `@/*` alias pointing at the
  frontend directory.
- `frontend/test/setup.ts` importing
  `@testing-library/jest-dom/vitest`.
- `backend/vitest.config.ts` using the Node environment.

Add `"test": "vitest run"` and `"test:watch": "vitest"` to each package. Do
not change existing dependency versions except changes npm must make to resolve
the new dev dependencies.

**Verify**:
`npm run test --prefix frontend -- --passWithNoTests && npm run test --prefix backend -- --passWithNoTests`
→ both commands exit 0.

### Step 2: Add deterministic seed tests

Create `frontend/test/utils.test.ts` and cover:

- merging ordinary class names;
- Tailwind conflict resolution, for example later `px-*` winning;
- conditional false values being omitted.

Create `backend/test/bandScore.test.ts` and cover:

- zero and invalid totals return band 0;
- a perfect result returns band 9;
- representative scaled five-question results;
- raw scores are clamped to the valid range.

Use table-driven cases where that improves readability. Import the real
utilities; do not copy their implementation into tests.

**Verify**:
`npm run test --prefix frontend && npm run test --prefix backend`
→ both suites pass with at least three assertions each.

### Step 3: Add root build, test, and verify commands

Update root `package.json`:

- `build` runs the frontend and backend builds;
- `test` runs both package test suites;
- `verify` runs `build` followed by `test`.

Do not add root dependencies or a root lockfile.

**Verify**: `npm run verify` → exit 0; both builds and both test suites run.

## Test plan

- `frontend/test/utils.test.ts`: three focused tests of `cn`.
- `backend/test/bandScore.test.ts`: boundary and representative scoring cases.
- Structural pattern: standard Vitest `describe`/`it`/`expect`; there are no
  existing tests to copy.
- Verification: `npm test` → all new tests pass.

## Done criteria

- [ ] `npm run verify` exits 0.
- [ ] Both package manifests expose `test` and `test:watch`.
- [ ] Root manifest exposes `build`, `test`, and `verify`.
- [ ] Both lockfiles reflect only the required test dependencies and npm's
      transitive resolution.
- [ ] No production source file changed.
- [ ] `git status --short` lists only the in-scope files and the plan-index
      status update.
- [ ] `plans/README.md` marks plan 001 `DONE`.

## STOP conditions

- An existing test framework or hidden CI configuration is discovered that
  would make a second test runner inappropriate.
- Installing the listed tools requires changing production dependency major
  versions.
- Either existing production build fails before test-related changes.
- A test can pass only by reading real `.env` credentials or calling a live
  network service.

## Maintenance notes

- Keep unit tests offline and deterministic. Later plans may mock Supabase and
  browser APIs, but must never require production credentials.
- The full lint command remains a known failing check. Do not silently add it
  to `verify` until the separate lint cleanup makes it green.
- A future CI workflow should run `npm ci` in each package and then
  `npm run verify`.
