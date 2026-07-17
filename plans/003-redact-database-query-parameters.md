# Plan 003: Stop database timing logs from emitting query parameter values

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected
> result before moving on. If a "STOP conditions" item occurs, stop and report; do not improvise. When done, update
> this plan's row in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- src/db/index.ts src/db/query-logger.ts src/db/query-logger.test.ts`
> If any path changed, compare the excerpts below with live code. A behavioral mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The optional query-timing wrapper writes every raw SQL parameter to `console.log` or `console.error`. Parameters can
contain customer names, email addresses, session tokens, OAuth tokens, and password hashes. Diagnostics need the
normalized query, status, duration, and parameter count, but never the logger-owned parameter array. This plan
removes that unsafe field and locks the invariant down for the Promise, `.values()`, failed, transaction-scoped, and
nested-savepoint query paths. It also makes both supported enablement values (`"1"` and `"true"`) disable Drizzle's
development logger; otherwise `DB_QUERY_TIMING=true` still lets Drizzle stringify the same raw parameters.

## Current state

Relevant files:

- `src/db/query-logger.ts` — wraps postgres-js and logs slow or failed queries.
- `src/db/index.ts` — installs the wrapper on the shared client. Its Drizzle logger check recognizes only `"1"`,
  while `isQueryTimingEnabled()` also recognizes `"true"`; edit it to use the shared predicate.
- `src/db/schema.ts` — shows sensitive data that can enter query parameters; inspect only.
- `src/db/query-logger.test.ts` — does not exist; create it as a pure unit test with fake clients.
- `vitest.config.ts` — Node test environment with the `@` alias.

`src/db/query-logger.ts:39-65` currently emits the raw array:

```ts
function logQueryTiming({
	query,
	params,
	durationMs,
	status,
	error,
}: {
	query: string;
	params: unknown[];
	durationMs: number;
	status: QueryLogStatus;
	error?: unknown;
}) {
	if (!shouldLogQuery(durationMs, status)) return;

	const message = `[db] ${status} ${durationMs.toFixed(1)}ms ${normalizeQuery(query)}`;
	const details = {
		paramsCount: params.length,
		params,
	};

	if (status === "error") {
		console.error(message, { ...details, error });
		return;
	}

	console.log(message, details);
}
```

`src/db/query-logger.ts:82-97` passes `params` to both log branches. Keep this flow because the logger still needs
`params.length`; only remove the value-bearing `details.params` property:

```ts
logQueryTiming({
	query,
	params,
	durationMs: performance.now() - start,
	status: "ok",
});
```

`src/db/query-logger.ts:143-160` wraps clients supplied to transactions and savepoints:

```ts
if (typeof optionsOrCallback === "function") {
	return originalMethod((scopedClient) => optionsOrCallback(withQueryTiming(scopedClient)));
}

if (!callback) {
	return originalMethod(optionsOrCallback);
}

return originalMethod(optionsOrCallback, (scopedClient) => callback(withQueryTiming(scopedClient)));
```

`src/db/index.ts:12-15` currently has an enablement mismatch:

```ts
const client = withQueryTiming(postgres(connectionString, { prepare: false }));
export const db = drizzle(client, {
	schema,
	logger: process.env.NODE_ENV === "development" && process.env.DB_QUERY_TIMING !== "1",
});
```

With `DB_QUERY_TIMING=true` in development, `withQueryTiming` is enabled but the installed Drizzle 0.41.0
`DefaultLogger` is also enabled. That logger stringifies `params` into its console message. Reuse
`isQueryTimingEnabled()` in this expression so the wrapper and Drizzle logger cannot disagree; do not add new
environment spellings.

`node_modules/drizzle-orm/postgres-js/session.js` shows that projected Drizzle queries execute through
`client.unsafe(query, params).values()`. A test that only awaits `unsafe()` does not cover that distinct proxy branch.
Nested Drizzle transactions call `savepoint` on the client received from `begin`, so the savepoint test must follow
that nesting instead of calling a root-client savepoint directly.

Sensitive examples are `orders.customerName` (`src/db/schema.ts:106-113`), `user.email`
(`src/db/schema.ts:244-255`), `session.token` (`src/db/schema.ts:264-280`), and account access, refresh, ID, and
password fields (`src/db/schema.ts:285-300`). Never copy real values into tests or plan output; use fake sentinels.

Test/style conventions:

- Import Vitest helpers directly; see `src/lib/admin-reporting/admin-reporting.test.ts:1`.
- Colocate tests and import source through `@`; see `src/lib/order-lifecycle.test.ts:1-2`.
- Vitest runs in Node (`vitest.config.ts:10-12`).
- Biome uses tabs, double quotes, organized imports, and 120-column JavaScript lines (`biome.json`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm exec vitest run src/db/query-logger.test.ts` | exit 0; 1 file, 5 tests pass after Step 2 |
| Scoped check | `pnpm exec biome check src/db/index.ts src/db/query-logger.ts src/db/query-logger.test.ts` | exit 0; no diagnostics |
| Typecheck | `pnpm typecheck` | exit 0; no errors |
| Full tests | `pnpm test` | exit 0; all tests pass |
| Patch hygiene | `git diff --check` | exit 0 |

Do not use `pnpm lint` as this plan's gate. At `848e31d` it already fails on formatting in
`src/components/product-card.tsx`; Plan 006 owns that baseline. Use the scoped Biome check and do not edit that file.
No dependency installation or database access is needed.

## Scope

**In scope** (only these files may be modified):

- `src/db/query-logger.ts`
- `src/db/index.ts`
- `src/db/query-logger.test.ts` (create)
- `plans/README.md` status row only, unless the reviewer owns the index

**Out of scope**:

- `src/db/schema.ts`, migrations, dependencies, and postgres-js/Drizzle configuration beyond the existing logger
  boolean in `src/db/index.ts`
- Adding or removing accepted environment values or changing threshold behavior (`DB_QUERY_TIMING`,
  `DB_SLOW_QUERY_MS`)
- Query normalization, message text, timing precision, status, slow-query rules, and parameter count
- Query execution parameters, return values, and error propagation
- Redaction of SQL query text, database Error objects, or third-party tracing attributes
- A logging/observability redesign
- Existing formatting failures, including `src/components/product-card.tsx`

## Git workflow

- Branch: `feat/003-redact-database-query-parameters`
- Preferred single commit after all checks pass: `fix(db): redact query timing parameters`.
- If commits are split, do not commit a red test. Valid examples: `test(db): cover redacted query timing logs` and
  `fix(db): redact query timing parameters`.
- Use Conventional Commits without co-author trailers. Do not push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add focused regression tests with fake clients

Create `src/db/query-logger.test.ts`. Import `withQueryTiming` from `@/db/query-logger`. Do not import `@/db` or
`src/db/index.ts`, because that would require `DATABASE_URL` and a real database.

Use a fresh fake client per test because `withQueryTiming` records wrapped clients in a module-level `WeakSet`.
Its `unsafe` returns a real resolved/rejected Promise. For the `.values()` case, attach a `values` method that returns
a separate real Promise. Fake `begin` invokes its callback with a fresh transaction client. That transaction client
owns `savepoint`, which invokes its callback with a fresh nested client; this matches Drizzle's actual nesting. No
other postgres-js behavior is needed.

Setup and teardown:

- `vi.stubEnv("DB_QUERY_TIMING", "1")` and `vi.stubEnv("DB_SLOW_QUERY_MS", "0")` so every query logs.
- Spy on `console.log` and `console.error` with no-op implementations.
- Restore spies and call `vi.unstubAllEnvs()` after each test.
- Use distinct fake strings such as `not-a-real-session-token`; never use real personal or credential data.

Add exactly five tests:

1. **Successful direct Promise query**: override `DB_QUERY_TIMING` to `"true"`, await `unsafe` with two sentinels,
   and assert the result is unchanged. `console.log` gets a message containing `[db] ok`, numeric `N.Nms`, and
   normalized query text; details equal `{ paramsCount: 2 }`; serialized calls contain neither sentinel;
   `console.error` is unused. Using `"true"` locks down the second supported enablement value that `src/db/index.ts`
   must also honor.
2. **Successful `.values()` query**: call and await `unsafe(...).values()` with one sentinel. Assert the rows are
   unchanged, details equal `{ paramsCount: 1 }`, the sentinel is absent, and the underlying `values` method is
   called once. This covers the path Drizzle uses for projected rows.
3. **Failed direct query**: reject with an Error and one sentinel. Assert the same Error is rethrown; `console.error`
   gets `[db] error`, duration, and normalized query; details equal `{ paramsCount: 1, error }`; calls have no
   `params` property/sentinel; `console.log` is unused.
4. **Transaction-scoped query**: execute `unsafe` in a `begin` callback. Assert `{ paramsCount: 1 }`, no sentinel,
   and unchanged result.
5. **Nested-savepoint query**: call `savepoint` on the transaction client supplied to a `begin` callback, then
   execute `unsafe` on the nested client. Assert `{ paramsCount: 1 }`, no sentinel, and unchanged result. Do not put
   `savepoint` on the root fake merely to make this test pass.

Use exact equality for details so any extra property fails. Match duration shape rather than mocking the global
performance clock. Stringify captured calls and assert the relevant sentinel is absent to cover nested objects.

**Verify red state**:
`pnpm exec vitest run src/db/query-logger.test.ts` → tests compile/run, but redaction assertions fail specifically
because current details include `params`. Fix test-harness failures before proceeding. Do not commit the red state.

### Step 2: Remove raw values and align logger enablement

In `logQueryTiming` in `src/db/query-logger.ts`, replace only the details object with:

```ts
const details = {
	paramsCount: params.length,
};
```

Do not remove/rename the `params` argument, alter `observeQuery`, touch the array passed to `originalUnsafe`, or
change the error branch. This preserves query text, status, timing, parameter count, results, and original errors.

Export the existing `isQueryTimingEnabled()` function without changing its body. In `src/db/index.ts`, import it
alongside `withQueryTiming` and replace only the Drizzle logger condition with:

```ts
logger: process.env.NODE_ENV === "development" && !isQueryTimingEnabled(),
```

This is not a new flag behavior: it makes the existing Drizzle logger use the same `"1"`/`"true"` predicate as the
wrapper. Do not create another predicate or change when the timing wrapper itself is installed.

**Verify**: `pnpm exec vitest run src/db/query-logger.test.ts` → exit 0; all 5 tests pass.

### Step 3: Run scoped and repository checks

Run in order:

1. `pnpm exec biome check src/db/index.ts src/db/query-logger.ts src/db/query-logger.test.ts` → exit 0. If formatting
   is required, run the same command with `--write` on only these three paths, then rerun without it.
2. `pnpm typecheck` → exit 0.
3. `pnpm test` → exit 0; full suite passes, including 5 new tests.
4. `git diff --check` → exit 0.
5. `git diff -- src/db/index.ts src/db/query-logger.ts src/db/query-logger.test.ts` → only one production-field
   removal, shared-predicate export/use, and tests.
6. `rg -n 'logger: process.env.NODE_ENV === "development" && !isQueryTimingEnabled\(\)' src/db/index.ts` → exactly
   one match.
7. `git status --short` → this executor changed nothing beyond the three source/test paths and permitted index row.

If a full-suite failure is unrelated to these paths, record the command/output and stop. Do not repair unrelated code.

## Test plan

- Create `src/db/query-logger.test.ts` with 5 pure unit tests and no database/environment file.
- Cover direct success/error, preserving results and Error identity.
- Cover the `.values()` proxy path used by projected Drizzle queries.
- Assert status, timing shape, normalized query text, and parameter count remain.
- Assert fake parameter values never occur in captured console arguments.
- Cover `begin` and a realistically nested `begin` → `savepoint` scoped client.
- Exercise `DB_QUERY_TIMING=true` and verify `src/db/index.ts` uses the same predicate to disable Drizzle logging.
- Focused gate: `pnpm exec vitest run src/db/query-logger.test.ts` → 5 pass.
- Regression gate: `pnpm test` → all pass.

## Done criteria

- [ ] Success emits `{ paramsCount }`; error emits `{ paramsCount, error }`; neither emits `params`.
- [ ] Query text, normalization, status, duration, and parameter count are unchanged.
- [ ] Results are unchanged and failed queries rethrow the same Error.
- [ ] Direct Promise success/error, `.values()` success, `begin`, and nested `savepoint` tests exist and prove
      sentinels are absent.
- [ ] `DB_QUERY_TIMING=true` enables timing while disabling Drizzle's development logger through the same predicate.
- [ ] Focused Vitest exits 0 with 5 passing tests.
- [ ] Scoped Biome check, `pnpm typecheck`, `pnpm test`, and `git diff --check` exit 0.
- [ ]
      `! rg -U 'const details = \\{\\n\\s+paramsCount: params\\.length,\\n\\s+params,' src/db/query-logger.ts`
      exits 0 with no match.
- [ ] No source outside `src/db/index.ts`, `src/db/query-logger.ts`, and `src/db/query-logger.test.ts` was modified.
- [ ] `plans/README.md` is updated unless the reviewer owns it.
- [ ] The pre-existing `product-card.tsx` lint issue was not changed.

## Risks and rollout

- Removing `details.params` may affect an external log parser even though no repository code consumes it. Preserve
  the stable message, status, duration, normalized query, and `paramsCount`; call out the intentional field removal
  in release notes if log consumers exist.
- The console-call assertions prove this wrapper does not add parameter values. They do not sanitize SQL literals,
  values embedded by a database Error, or Drizzle/OpenTelemetry trace attributes; those remain explicitly out of
  scope and must not be described as covered by this change.
- No schema/data migration or coordinated client deployment is required. Deploy the code before enabling timing with
  either supported value. Verify a synthetic, non-sensitive query produces `paramsCount` without a `params` field
  and, for `DB_QUERY_TIMING=true` in development, produces no second Drizzle `Query: ... -- params:` line.

## Rollback

Prefer a forward fix. If timing instrumentation causes an operational problem, first set `DB_QUERY_TIMING=0` and
redeploy in a non-development environment so both the timing wrapper and Drizzle's development logger are off. Only
then revert the implementation commit while investigating. Do not restore raw parameter logging as a diagnostic
workaround, and do not use this rollback in development where the fallback Drizzle logger emits parameters.

## STOP conditions

Stop and report; do not improvise if:

- Live `logQueryTiming`, `observeQuery`, `wrapScopedClientMethod`, or `withQueryTiming` behavior differs from above.
- Code/tests intentionally depend on raw parameter values in console output. Report the consumer; do not preserve or
  replace the leak with partial, masked, hashed, or sampled values.
- Tests require a real database, `DATABASE_URL`, or `src/db/index.ts`; the fake-client seam should avoid all three.
- Keeping `paramsCount` appears to require logging, serializing, hashing, or copying values; count the existing array.
- Scoped-client testing requires changing production callback semantics instead of correcting the fake.
- Aligning the two existing enablement checks requires accepting a new environment spelling or broader DB wiring
  changes instead of reusing `isQueryTimingEnabled()`.
- The fix requires query/error redaction, dependencies, or any out-of-scope file.
- An in-scope check cannot be fixed without scope expansion, or focused verification fails twice.
- Full tests fail only because of unrelated pre-existing/concurrent work. Capture evidence and stop.
- Actual credentials/personal data are discovered. Do not copy them into output; report only path and data category
  through the secure channel.

## Maintenance notes

- Future structured loggers/exporters must never attach query parameter values to emitted events.
- Review complete console argument objects, not only formatted messages; scoped tests must use distinct sentinels.
- Query text and database Error objects remain unchanged by design. Callers must parameterize values rather than
  interpolate secrets. Redacting SQL literals or Error payloads is a separate security decision.
- Retaining `params` long enough to compute `params.length` is acceptable; emission is the security boundary.
- Plan 006 owns repository-wide lint baseline cleanup.
