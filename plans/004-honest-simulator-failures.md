# Plan 004: Stop the simulator from inventing scores after failures

> **Executor instructions**: Follow each step and verification gate. Stop and
> report on a STOP condition; do not improvise. Update `plans/README.md` when
> complete unless a reviewer maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat a7d0afd..HEAD -- frontend/app/simulator/page.tsx frontend/lib/simulator-results.ts frontend/test/simulator-results.test.ts`
> Plan 002 is expected to change the SSE loops in `simulator/page.tsx`. Confirm
> plan 002 is complete and adapt only the failure semantics described here.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/002-boundary-safe-sse.md`
- **Category**: bug
- **Planned at**: commit `a7d0afd`, 2026-07-31

## Why this matters

When any simulator grading request fails, the UI currently assigns a fixed
band score and advances as though grading succeeded. Listening and reading use
6.0, writing uses 6.0, and speaking uses 6.5. These values can appear in the
consolidated report even though no evaluator produced them. An assessment
product must distinguish a measured score from a failure.

This plan keeps the user on the failed step, presents a retryable error, and
permits the report/export only when all four real scores exist.

## Current state

- `frontend/app/simulator/page.tsx:250-253`:

  ```ts
  toast.error("Failed to grade Listening step. Moving forward with estimated 6.0.");
  setListeningScore(6.0);
  setStep("reading");
  ```

- `frontend/app/simulator/page.tsx:281-284` repeats this for reading.
- `frontend/app/simulator/page.tsx:346-350` repeats this for writing.
- `frontend/app/simulator/page.tsx:413-418` assigns 6.5 and finishes after a
  speaking failure.
- `frontend/app/simulator/page.tsx:860-866` already computes `overallScore` only
  when all four scores are non-null.
- The export path at line 659 nevertheless falls back to `6.0`; remove this
  secondary fabrication.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm run test --prefix frontend -- simulator-results.test.ts` | exit 0 |
| Build | `npm run build --prefix frontend` | exit 0 |
| Search fabricated scores | `rg -n 'estimated 6\\.0|set(Listening|Reading|Writing)Score\\(6\\.0\\)|setSpeakingScore\\(6\\.5\\)|overallScore !== null \\? overallScore : 6\\.0' frontend/app/simulator/page.tsx` | no matches |

## Scope

**In scope**:

- `frontend/app/simulator/page.tsx`
- `frontend/lib/simulator-results.ts` (create only if a pure helper materially
  improves testing)
- `frontend/test/simulator-results.test.ts` (create)

**Out of scope**:

- Scoring algorithms and backend graders.
- Simulator visual redesign or changing test content/timers.
- Adding a “skip section” product feature.
- Planner generation behavior.
- SSE framing, which belongs to plan 002.

## Git workflow

- Branch: `codex/004-honest-simulator-failures`
- Commit: `fix: keep simulator failures unscored and retryable`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Keep failed sections active and unscored

For listening, reading, writing, and speaking catch blocks:

- do not set a score;
- do not advance `step`;
- do not call `syncStudyRoadmap`;
- display a concise error stating that grading failed and the user can retry;
- rely on the existing `finally` block to clear `isProcessingStep`, re-enabling
  the action.

Preserve any typed answers, essay, and transcript so retry does not lose work.
Log the technical error where the existing code already does so, but do not
surface provider internals to the user.

**Verify**: run the fabricated-score search from the command table
→ no matches.

### Step 2: Make report/export validity explicit

Extract a small pure helper only if useful:

```ts
type ModuleScores = {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
};

export function hasCompleteScores(scores: ModuleScores): boolean;
```

Use the existing non-null `overallScore` as the authoritative report gate.
Remove the export fallback `overallScore !== null ? overallScore : 6.0`.
Instead, guard the export function: if the overall score is null, show an error
and return before creating report HTML.

Do not coerce a missing module to 6.0 when choosing the weakest module in the
export recommendation. That code may run only after all four scores are known.

**Verify**:
`rg -n '\\|\\| 6\\.0|\\? overallScore : 6\\.0' frontend/app/simulator/page.tsx`
→ no matches in report/export score handling.

### Step 3: Add regression tests

Prefer testing a pure `hasCompleteScores`/report-readiness helper rather than
mounting the 1,400-line page. Cover:

- all four numeric scores → report-ready;
- each individual null score → not ready;
- valid band 0 is treated as present, not as false/missing;
- no default score is introduced by the helper.

If keeping all logic inline makes this impossible, extract only the minimal
pure helper above; do not refactor unrelated simulator state.

**Verify**:
`npm run test --prefix frontend -- simulator-results.test.ts`
→ all cases pass.

### Step 4: Run build and manual failure smoke checks

With API calls mocked or the backend intentionally unavailable in a local test
environment, verify each section:

- error toast appears;
- current section remains visible;
- existing response content remains;
- action becomes enabled again;
- no report is displayed.

Do not submit real paid-provider requests for this verification.

**Verify**: `npm run build --prefix frontend` → exit 0.

## Test plan

- Unit tests for complete-score gating, including zero-band handling.
- Manual/local smoke test for retry state in all four sections.
- No real AI, Supabase write, microphone, or camera call.
- Verification: focused tests plus frontend build.

## Done criteria

- [ ] No simulator failure path assigns a numeric score.
- [ ] No failure path advances to the next step or report.
- [ ] Retry preserves user input.
- [ ] Export refuses incomplete results and has no 6.0 fallback.
- [ ] Focused tests and frontend build pass.
- [ ] Only in-scope files and the plan-index row changed.
- [ ] `plans/README.md` marks plan 004 `DONE`.

## STOP conditions

- Product requirements explicitly require a skip/estimated-score mode; report
  that requirement because it needs separate labeling and UX design.
- Plan 002 is incomplete or the simulator still uses ad-hoc SSE parsing.
- Keeping the failed step active requires changing backend response shapes.
- Tests can pass only by invoking live grading providers.

## Maintenance notes

- Missing scores must remain `null`, never a “reasonable” numeric default.
- If a future skip feature is added, reports must label skipped/ungraded
  sections and must not describe their values as official evaluation results.
- Review truthiness checks carefully because band 0 is a valid numeric score.
