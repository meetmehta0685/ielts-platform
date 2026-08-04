# Plan 002: Make all SSE consumers boundary-safe

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result. Stop and report when a
> STOP condition occurs; do not improvise. Update the status row in
> `plans/README.md` when complete unless a reviewer maintains the index.
>
> **Drift check (run first)**:
> `git diff --stat a7d0afd..HEAD -- frontend/lib/sse.ts frontend/test/sse.test.ts frontend/app/chat/page.tsx frontend/app/writing/page.tsx frontend/app/speaking/page.tsx frontend/app/simulator/page.tsx`
> Plan 001 is expected to add test infrastructure but not touch these paths. If
> any listed production file changed, compare it with the excerpts below and
> stop on a material mismatch.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/001-verification-baseline.md`
- **Category**: bug
- **Planned at**: commit `a7d0afd`, 2026-07-31

## Why this matters

Every frontend stream consumer assumes each `ReadableStream.read()` call ends
on an SSE line boundary. HTTP chunking provides no such guarantee. A JSON event
split across chunks is currently caught and discarded, which can remove model
tokens or the final `{done: true}` event. Writing and speaking can therefore
report failure after a successful backend evaluation, chat content can be
garbled, and the simulator can miss its real band score.

The backend already demonstrates the correct buffering pattern in
`backend/src/services/openrouter.ts:98-136`. This plan centralizes that behavior
for the frontend and switches all four consumers to it.

## Current state

- `frontend/app/writing/page.tsx:333-369` currently does:

  ```ts
  const { value, done } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  const lines = chunk.split("\n");
  // ...
  const data = JSON.parse(dataStr);
  // parse failures are ignored
  ```

- The same unbuffered pattern appears at:
  - `frontend/app/chat/page.tsx:218-245`
  - `frontend/app/speaking/page.tsx:453-493`
  - `frontend/app/simulator/page.tsx:311-337`
  - `frontend/app/simulator/page.tsx:377-403`
- Backend events use one `data: ...` line followed by a blank line and terminate
  with `data: [DONE]`.
- These requests are authenticated POSTs, so native `EventSource` is not a
  replacement.
- Frontend imports use the `@/` alias. Put reusable protocol logic under
  `frontend/lib`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npm run test --prefix frontend -- sse.test.ts` | exit 0 |
| Type/build check | `npm run build --prefix frontend` | exit 0 |
| Focused lint | `npm run lint --prefix frontend -- lib/sse.ts test/sse.test.ts` | exit 0 for the new helper and tests |

## Scope

**In scope**:

- `frontend/lib/sse.ts` (create)
- `frontend/test/sse.test.ts` (create)
- `frontend/app/chat/page.tsx`
- `frontend/app/writing/page.tsx`
- `frontend/app/speaking/page.tsx`
- `frontend/app/simulator/page.tsx`

**Out of scope**:

- Backend streaming implementation and event shapes.
- Changing endpoints from POST to GET or changing authentication.
- UI redesigns, prompt changes, model changes, or persistence behavior.
- Unrelated React-hook/lint cleanup in the four large page files.

## Git workflow

- Branch: `codex/002-boundary-safe-sse`
- Commit: `fix: preserve split server-sent events in frontend streams`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Add one reusable SSE data reader

Create `frontend/lib/sse.ts` exporting an async generator with this contract:

```ts
export async function* readSseData(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string>
```

Required behavior:

1. Use one `TextDecoder` with `{ stream: true }`.
2. Keep an accumulated string buffer between reads.
3. Process only complete newline-delimited lines; retain the final partial
   line for the next read.
4. Strip a trailing `\r` so both LF and CRLF work.
5. Yield only the value after the first `data:` prefix, removing at most one
   optional leading space.
6. Preserve JSON contents exactly; do not trim inside JSON strings.
7. Flush `decoder.decode()` and process a final unterminated `data:` line when
   the stream ends.
8. Release/cancel the reader in a `finally` block only as supported by the Web
   Streams API; do not hide a consumer exception.

The helper parses SSE framing only. It must not JSON-parse events and must not
special-case `[DONE]`.

**Verify**: `npm run build --prefix frontend` → exit 0.

### Step 2: Lock the protocol behavior with adversarial chunk tests

Create `frontend/test/sse.test.ts`. Build in-memory
`ReadableStream<Uint8Array>` instances and cover:

- two complete events in one chunk;
- one JSON event split inside the `data:` prefix and again inside its JSON;
- CRLF framing;
- a multibyte UTF-8 character split across byte chunks;
- `[DONE]`;
- a final event without a newline;
- a consumer exception propagates instead of being swallowed.

Assert the exact ordered strings yielded by the generator.

**Verify**: `npm run test --prefix frontend -- sse.test.ts`
→ all named cases pass.

### Step 3: Replace every ad-hoc reader loop

In chat, writing, speaking, and both simulator evaluation paths:

- import `readSseData` from `@/lib/sse`;
- keep the existing `response.body` null guard;
- replace `reader`/`decoder`/`chunk.split("\n")` loops with:

  ```ts
  for await (const dataStr of readSseData(response.body)) {
    if (dataStr === "[DONE]") continue;
    const data = JSON.parse(dataStr);
    // existing token/done/error handling
  }
  ```

- Do not wrap `JSON.parse` and application error handling in a catch that
  silently ignores all exceptions. Framing is now complete; invalid server
  JSON or `{error: ...}` must reach the existing outer error UI.
- Preserve the current accumulation, result mapping, query invalidation, and
  toast behavior.

**Verify**:

1. `rg -n 'chunk\\.split\\(\"\\\\n\"\\)|reader\\.read\\(\\)' frontend/app/{chat,writing,speaking,simulator}/page.tsx`
   → no matches in the five replaced stream loops.
2. `npm run build --prefix frontend` → exit 0.

### Step 4: Run focused quality gates

Run lint on the new helper and its tests. The four large page files already
contain known lint failures, so use the production build as their automated
gate and inspect the diff for newly introduced lint patterns. Do not expand
this plan into a whole-file lint refactor.

**Verify**:
`npm run test --prefix frontend -- sse.test.ts && npm run build --prefix frontend`
→ exit 0.

## Test plan

- New `frontend/test/sse.test.ts` with at least seven cases listed above.
- No real backend or AI provider calls.
- The critical regression is a `{done:true}` event split at every plausible
  boundary still being yielded once and in full.
- Verification: `npm run test --prefix frontend -- sse.test.ts`.

## Done criteria

- [ ] All five frontend SSE loops use `readSseData`.
- [ ] No stream loop discards JSON parse failures as “chunk boundary” errors.
- [ ] Split-prefix, split-JSON, CRLF, UTF-8, `[DONE]`, and unterminated-final
      cases pass.
- [ ] `npm run build --prefix frontend` exits 0.
- [ ] No backend response shape changed.
- [ ] Only in-scope files and the plan-index status row changed.
- [ ] `plans/README.md` marks plan 002 `DONE`.

## STOP conditions

- The backend event shape has changed from single-line `data:` messages.
- A consumer now requires multi-line SSE `data:` field concatenation; report
  this before expanding the parser contract.
- Plan 001 is not complete or frontend tests cannot run offline.
- Fixing a consumer requires changing backend payloads or database behavior.

## Maintenance notes

- Any future streaming page must use `readSseData`; reviewers should reject
  new `chunk.split("\n")` readers.
- If the backend later emits named events, IDs, or retry directives, extend the
  parser with dedicated tests rather than parsing them ad hoc in pages.
- Review cancellation behavior when adding user-visible “Stop generating.”
