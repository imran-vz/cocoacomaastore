# Plan 007: Add disposable PostgreSQL lifecycle and reporting tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` only when that file is tracked and a reviewer has not
> told you they maintain the index. Never stage an otherwise-untracked index.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- package.json pnpm-lock.yaml vitest.config.ts vitest.integration.config.ts drizzle.integration.config.ts scripts/test-database-url.ts scripts/integration-db-lifecycle.ts scripts/run-integration-tests.sh src/test/test-database-url.test.ts src/test/integration/database.ts src/lib/order-lifecycle.ts src/lib/order-lifecycle.integration.test.ts src/lib/admin-reporting/admin-reporting.integration.test.ts src/app/manager/orders/actions.ts src/server/effect/cache-tags.ts .github/workflows/ci.yml plans/README.md; git -c status.branch=false status --short -- package.json pnpm-lock.yaml vitest.config.ts vitest.integration.config.ts drizzle.integration.config.ts scripts/test-database-url.ts scripts/integration-db-lifecycle.ts scripts/run-integration-tests.sh src/test/test-database-url.test.ts src/test/integration/database.ts src/lib/order-lifecycle.ts src/lib/order-lifecycle.integration.test.ts src/lib/admin-reporting/admin-reporting.integration.test.ts src/app/manager/orders/actions.ts src/server/effect/cache-tags.ts .github/workflows/ci.yml plans/README.md drizzle`
> The status command is required because `git diff` omits untracked files.
> Plan 005 is expected to have changed `src/lib/order-lifecycle.ts`,
> `src/app/manager/orders/actions.ts`, and `src/server/effect/cache-tags.ts`;
> Plan 006 is expected to have changed `package.json`,
> `.github/workflows/ci.yml`, and `plans/README.md`. Confirm those prerequisite
> outcomes below. Any pre-existing harness file or other unexpected in-scope
> change is a STOP condition; do not overwrite it.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/005-remove-unsafe-order-soft-delete.md`, `plans/006-establish-green-quality-gate.md`
- **Category**: tests
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

Order creation, stock deduction, cancellation, and analytics filtering are
transactional PostgreSQL behavior, but the current 38 tests exercise only pure
helpers and auth-before-database guards. A regression can therefore duplicate
stock, leave partial orders, cross the IST business-day boundary, or count
cancelled/deleted revenue while the unit suite remains green. This plan adds a
small integration foundation against a newly created local test database and
proves only those critical invariants.

The harness deliberately bootstraps an **empty disposable database** from
`src/db/schema.ts` using `drizzle-kit push`; it does not claim to test migration
replay. Therefore Plan 008 (versioned migrations) is not a prerequisite. When
Plan 008 lands, it should replace this one bootstrap command with migration
application; do not duplicate or invent migrations here.

## Current state

- `package.json:12-16` has only one Vitest command:

  ```json
  "lint": "biome check src",
  "test": "vitest run",
  "typecheck": "tsc --noEmit"
  ```

- `vitest.config.ts:4-12` selects Node but does not separate unit and database tests:

  ```ts
  export default defineConfig({
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
	test: { environment: "node" },
  });
  ```

- `src/db/index.ts:6-15` imports `DATABASE_URL` into a process-wide Postgres
  client at module load. Integration tests must mock `@/db` with their owned
  client and close it in `afterAll`; never point this singleton at an operator's
  normal `DATABASE_URL`.
- `scripts/clone-supabase-db.sh:68-85` is the repository safety precedent: it
  recognizes only `localhost`, `127.0.0.1`, or `[::1]` and refuses destructive
  work against other hosts. The integration harness must be stricter: require
  explicit `TEST_DATABASE_URL` and database name exactly `cocoacomaa_test` too.
- `dev.compose.yml:1-9` provides PostgreSQL 17.6 on local port 5432 with user
  `postgres`, password `password`, and maintenance database `postgres`. CI must
  use the same PostgreSQL version and a loopback URL.
- There is no tracked `drizzle/` migration directory. `drizzle.config.ts:9-15`
  points at `src/db/schema.ts`; production config rewrites port text and must not
  be reused by the test harness.
- `src/lib/order-lifecycle.ts:292-330` inserts the order and items, locks daily
  inventory with `FOR UPDATE` (`:197-225`), updates stock, and writes the audit
  in one transaction. Insufficient stock is detected after order/item inserts,
  so a real rollback test is required.
- `src/lib/order-lifecycle.ts:449-529` locks an order, enforces same operating
  day, marks it cancelled, restores inventory, and writes an audit in a
  transaction.
- `src/lib/ist-date.ts:22-37` represents an IST day as UTC boundaries and a UTC
  analytics key. Use a fixed instant well away from midnight in tests.
- `src/lib/admin-reporting/queries.ts:117-184` reads the current IST day's live
  orders and filters `status = completed` and `isDeleted = false`.
- `src/lib/recompute-day-analytics.ts:86-124` compiles daily totals and dessert
  totals with the same completed/non-deleted rule.
- Existing `src/lib/order-lifecycle.test.ts` tests only deduction aggregation,
  the pure cancellation-day predicate, and serialization. Existing
  `src/lib/admin-reporting/admin-reporting.test.ts` only proves admin auth runs
  before database access.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Start local DB | `docker compose -f dev.compose.yml up -d postgres` | PostgreSQL 17.6 container starts |
| Wait for local DB | `bash -c 'for i in {1..30}; do docker compose -f dev.compose.yml exec -T postgres pg_isready -U postgres -d postgres && exit 0; sleep 1; done; exit 1'` | exits 0 only after PostgreSQL accepts connections |
| Unit tests | `pnpm test` | exit 0; integration files are not collected |
| Integration tests | `TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration` | exit 0; 2 files and 5 integration tests pass; test DB is dropped afterward |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0, no diagnostics |
| Aggregate gate | `pnpm check` | exit 0; Plan 006's unit gate remains green |
| Shell syntax | `bash -n scripts/run-integration-tests.sh` | exit 0 |
| Patch hygiene | `git diff --check` | exit 0 |

No new package is needed. Reuse `postgres`, `drizzle-orm`, `drizzle-kit`, `tsx`,
and `vitest`, which are already declared in `package.json`.

## Scope

**In scope** (the only files you should modify):

- `package.json`
- `vitest.config.ts`
- `vitest.integration.config.ts` (create)
- `drizzle.integration.config.ts` (create)
- `scripts/test-database-url.ts` (create)
- `scripts/integration-db-lifecycle.ts` (create)
- `scripts/run-integration-tests.sh` (create)
- `src/test/test-database-url.test.ts` (create)
- `src/test/integration/database.ts` (create)
- `src/lib/order-lifecycle.integration.test.ts` (create)
- `src/lib/admin-reporting/admin-reporting.integration.test.ts` (create)
- `.github/workflows/ci.yml` — extend Plan 006's workflow only
- `plans/README.md` — update only Plan 007's status row at completion

**Out of scope** (do NOT touch):

- Product behavior, schemas, `src/db/index.ts`, lifecycle/reporting functions,
  auth, cache services, or production database configuration.
- `drizzle.config.ts`, production/remote database data, Supabase cloning, or any
  real credential. Never copy production data into this test database.
- Creating versioned migrations or testing migration replay; that belongs to
  Plan 008.
- Fixing the audited lifecycle defects. These tests establish the foundation;
  subsequent plans extend it while changing behavior.
- Browser/E2E tests, every reporting query, load benchmarks, or a generalized
  test-container abstraction.
- Dependency additions/upgrades and `pnpm-lock.yaml` changes.

## Git workflow

- Branch: `feat/007-add-database-lifecycle-reporting-tests`
- Suggested commits:
  1. `test: add disposable PostgreSQL harness`
  2. `test: cover order lifecycle and reporting persistence`
  3. `ci: run PostgreSQL integration tests`
- Do not push or open a PR unless instructed. Stage no unrelated plan files.

## Steps

### Step 1: Confirm the prerequisite and baseline

Use an isolated worktree on the plan branch. Record the initial
`git -c status.branch=false status --short` so final status can be compared
without claiming pre-existing changes. Confirm Plans 005 and 006 are `DONE`,
the unsafe soft-delete path is absent, `pnpm check` passes, and
`.github/workflows/ci.yml` contains its `quality` job. Run the drift check.
Confirm neither a tracked nor untracked `drizzle/` directory exists; this
plan's bootstrap choice is invalid if versioned migrations have appeared.

**Verify**:

- `pnpm install --frozen-lockfile` → exit 0; lockfile unchanged.
- `rg -q '005.*DONE' plans/README.md` → Plan 005 is complete.
- `rg -q '006.*DONE' plans/README.md` → Plan 006 is complete.
- `! rg -n 'deleteOrder|softDeleteOrder|deleteOrderSchema|refreshOrderMutationViewsAfterDelete|OrderTags\.delete|updateOrderDeleteTagsEffect|delete:\s*\[CacheTag\.orders|soft-delete cleanup path' src scripts CONTEXT.md` → Plan 005's unsafe deletion path and delete-only support symbols are absent.
- `pnpm check` → exit 0.
- `test ! -e drizzle && test -z "$(git ls-files 'drizzle/**')"` → exit 0; no tracked or untracked migration directory exists.
- `rg -n '^  quality:|run: pnpm check' .github/workflows/ci.yml` → both Plan 006 lines are found.

### Step 2: Add the destructive-target safety gate

Create `scripts/test-database-url.ts` with a pure parser plus an environment
wrapper. It must:

1. Accept no fallback: missing/blank `TEST_DATABASE_URL` throws.
2. Parse only `postgres:` or `postgresql:` URLs.
3. Accept host only `localhost`, `127.0.0.1`, `::1`, or `[::1]`.
4. Require decoded database name exactly `cocoacomaa_test`.
5. Return the original target connection string plus a maintenance connection
   string using database `postgres`; never log either URL.

Create `src/test/test-database-url.test.ts` with five unit tests: accepts the
loopback test target; rejects a missing/blank value; rejects an unsupported
protocol; rejects `db.example.com`; rejects a loopback URL whose database is
`postgres`. Update `vitest.config.ts` to use
`include: ["src/**/*.test.ts"]` and `exclude: ["src/**/*.integration.test.ts"]`
so `pnpm test` remains database-free.

**Verify**:

- `pnpm exec vitest run src/test/test-database-url.test.ts` → 5 tests pass.
- `! pnpm exec vitest run src/lib/order-lifecycle.integration.test.ts` → the inner
  Vitest command reports no test files and exits nonzero, proving the existing
  integration file is excluded. (`vitest --list` is not a test-file listing
  option in the installed Vitest 4 CLI.)

### Step 3: Create and always destroy the disposable database

Create `drizzle.integration.config.ts`. It must call the safety wrapper, use
`src/db/schema.ts`, PostgreSQL dialect, and the validated test URL. Do not import
or copy the production port rewrite.

Create `scripts/integration-db-lifecycle.ts` with only `create` and `drop`
commands. Both validate the URL before connecting. Connect to the derived
`postgres` maintenance database; for `create`, terminate connections to the
exact test database, drop it if present, then create it; for `drop`, terminate
connections and drop it if present. The database identifier may be interpolated
only after the exact-name validation and must still be SQL-identifier quoted.
Run the database-level DDL as autocommit statements, not in a transaction.
Use one maintenance connection and always await its `end()` in `finally`, on
success or failure. Print generic lifecycle messages, never a URL.

Create `scripts/run-integration-tests.sh` using `set -euo pipefail`. It must:

1. Install cleanup and catchable `INT`/`TERM` handling before database creation,
   then validate/create the database.
2. Run `pnpm exec drizzle-kit push --config drizzle.integration.config.ts --force`
   against the new empty database.
3. Set `DATABASE_URL="$TEST_DATABASE_URL"` only on the Vitest child command and run
   `pnpm exec vitest run --config vitest.integration.config.ts`.
4. Use one `EXIT` cleanup path that always runs the drop command, preserves a
   prior create/schema/test/signal failure, converts cleanup failure into command
   failure when there was no prior failure, and never executes twice.

Add `"test:integration": "bash scripts/run-integration-tests.sh"` to
`package.json`. Create `vitest.integration.config.ts` with the existing alias,
Node environment, `include: ["src/**/*.integration.test.ts"]`,
`fileParallelism: false`, `maxWorkers: 1`, 15-second test timeout, and 30-second
hook/teardown timeouts. Set `isolate: true` so each file owns the client it
closes. Do not enable retries or force-exit.

**Verify**:

- `! env -u TEST_DATABASE_URL pnpm exec tsx scripts/integration-db-lifecycle.ts create` → exits 0 because the inner command refuses to run.
- `! TEST_DATABASE_URL='postgresql://test:test@db.example.com:5432/cocoacomaa_test' pnpm exec tsx scripts/integration-db-lifecycle.ts create` → refusal occurs before a connection attempt.
- `! TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/postgres' pnpm exec tsx scripts/integration-db-lifecycle.ts create` → refuses the wrong database name.
- `bash -n scripts/run-integration-tests.sh` → exits 0.

### Step 4: Add the owned integration database fixture

Create `src/test/integration/database.ts`. Revalidate `TEST_DATABASE_URL`, require
`DATABASE_URL` to equal it exactly, create an owned `postgres` client and Drizzle
instance with `src/db/schema.ts`, and export:

- `integrationDb` for test queries and the `@/db` mock.
- `integrationDatabaseLayer`, a `Layer.succeed(Database, ...)` whose `attempt`
  maps rejected promises to `BackendDatabaseError`, matching `Database.Live`.
- `resetIntegrationData()`, which truncates all tables in the disposable public
  schema with `RESTART IDENTITY CASCADE` before each test.
- `closeIntegrationDatabase()`, which awaits the owned client's `end()`.

The helper must never import the production `db` value. Each integration file
must mock `@/db` to return `integrationDb`, reset data in `beforeEach`, and close
its isolated owned client in `afterAll`. Its `next/cache` mock must return the
passed callback from `unstable_cache`; `revalidatePath`, `revalidateTag`, and
`updateTag` are no-ops. This preserves cached-call execution while preventing
framework cache side effects.

**Verify**: `pnpm typecheck` → exit 0.

### Step 5: Prove lifecycle transaction and locking invariants

Create `src/lib/order-lifecycle.integration.test.ts`. Freeze only `Date` at
`2026-07-15T12:00:00.000Z` with
`vi.useFakeTimers({ toFake: ["Date"], now: FIXED_NOW })`, restore real timers
after each test, and seed a test manager, one limited-stock dessert, and that
IST day's inventory. Do not fake Postgres/network timers. Dynamically import
the public lifecycle functions after mocks are installed. Add exactly these tests:

1. **Rollback:** inventory 1, request quantity 2. `createCompletedOrder` rejects;
   orders, items, and audit rows remain 0; inventory remains 1.
2. **Row locking:** inventory 1, concurrently request two quantity-1 orders with
   `Promise.allSettled`. Exactly one fulfills and one rejects; one completed
   order/audit exists and inventory is 0.
3. **Same-day cancellation:** inventory 2, create quantity 1, then call
   `cancelOrderAsNormalPath` with the persisted order ID (the public create
   function returns `void`). Status is `cancelled`, inventory returns to 2, and
   audit rows ordered by identity `id` are `order_deducted` (`2 -> 1`) then
   `order_cancelled` (`1 -> 2`). Do not order them by `createdAt`: the frozen
   clock gives both rows the same timestamp.

Use a minimal `CartLine` fixture: no combo, no modifiers, integer price, and
`hasUnlimitedStock: false`. Do not test post-commit cache failure/idempotency in
this foundation plan.

**Verify**: run the integration command from the Commands table → lifecycle file
reports 3 passing tests and the database is dropped on exit.

### Step 6: Prove IST reporting and analytics filters

Create `src/lib/admin-reporting/admin-reporting.integration.test.ts`. Mock
`server-only`, make `@/lib/auth/guards`'s `requireAdmin` resolve, and make the
`next/cache` `unstable_cache` mock return its callback. Freeze only `Date` at the
same fixed instant with the Date-only fake-timer configuration above. Add exactly
two tests:

1. **Current IST-day live report:** derive the boundaries with
   `getStartOfDayIST(FIXED_NOW)` and `getEndOfDayIST(FIXED_NOW)`. Seed active
   completed orders at the exact start and one millisecond before the end, plus
   cancelled, deleted, one millisecond before the start, and exactly-at-end rows.
   Add matching order items. Call `getAdminDashboardReport("2026-07-15")` and
   assert `dayOrdersCount`, `dayRevenue`,
   `dayItemsSold`, and the final live `dailyRevenue` point include only the two
   active completed in-boundary orders.
2. **Daily compiler filtering:** seed completed-active, cancelled, deleted, and
   outside-day orders/items. Run `recomputeDayAnalyticsEffect` with
   `integrationDatabaseLayer`; assert `analytics_daily_revenue` and
   `analytics_daily_dessert_revenue` contain only the completed, non-deleted,
   in-boundary order's count, revenue, and quantity.

Do not assert stock cards, audit presentation, monthly/weekly reports, missing
day detection, cache keys, or every row shape.

**Verify**: run the integration command → 2 files and 5 tests pass; cleanup logs
that `cocoacomaa_test` was dropped.

### Step 7: Run integration tests in CI

Extend Plan 006's `.github/workflows/ci.yml` without changing its `quality` job.
Add a separate `integration` job with `needs: quality`, `ubuntu-latest`, a
15-minute timeout, and a `postgres:17.6-alpine` service. Configure the service
with test-only `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=password`,
`POSTGRES_DB=postgres`, port 5432, and a `pg_isready` health check. Set job-level:

```yaml
TEST_DATABASE_URL: postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test
```

Repeat the checkout, pnpm 11.0.6, Node 24.x, and frozen-install steps from the
quality job, then run `pnpm test:integration`. Add no repository secret,
production URL, build/deploy step, or remote service.

**Verify**:

- `rg -n 'integration:|postgres:17\.6-alpine|TEST_DATABASE_URL:|run: pnpm test:integration' .github/workflows/ci.yml` → all four integration-job elements are found.
- `rg -n 'SUPABASE|REMOTE_DATABASE_URL|secrets\.' .github/workflows/ci.yml` → no matches, exit 1.

### Step 8: Run final gates and commit

Run all local gates with the local Postgres service. Review the diff; update only
Plan 007's index status to `DONE`, then make the suggested Conventional Commits.

**Verify**:

- `pnpm check` → exit 0; integration files are not collected.
- Integration command → exit 0; exactly 5 integration tests pass and cleanup succeeds.
- `docker compose -f dev.compose.yml exec -T postgres psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'cocoacomaa_test'"` → prints nothing after the integration command, independently confirming cleanup.
- `pnpm typecheck && pnpm lint && bash -n scripts/run-integration-tests.sh && git diff --check` → exit 0.
- `git diff --exit-code -- pnpm-lock.yaml` → exit 0.
- `git -c status.branch=false status --short` → compared with the recorded
  baseline, adds only in-scope files plus the executor-owned status-row edit.

Before each suggested commit, stage only that commit's in-scope files and run
`git diff --cached --check` plus `git diff --cached --name-only`; this is required
because unstaged `git diff --check` does not inspect newly created files. Never
stage an otherwise-untracked `plans/README.md`.

## Test plan

- Five unit tests make the destructive database guard executable policy,
  including the protocol restriction.
- Three lifecycle integration tests cover rollback, competing row locks, and
  same-day restoration with audit evidence.
- One live-report integration test covers both inclusive/exclusive IST
  boundaries and completed/non-deleted filtering.
- One compiler integration test covers the canonical analytics filter at daily
  and per-dessert persistence layers.
- `pnpm test` remains fast/database-free; `pnpm test:integration` owns setup and
  cleanup; CI runs both through separate jobs.

## Done criteria

- [ ] A missing/blank, unsupported-protocol, remote-host, or wrongly named `TEST_DATABASE_URL` is rejected before connection/destructive SQL.
- [ ] The test database is newly created, schema-pushed, and dropped on success,
      test failure, or catchable `INT`/`TERM` shell exit; no claim is made for
      `SIGKILL` or host failure.
- [ ] No production/remote URL fallback exists and no URL is logged.
- [ ] `pnpm test` excludes integration files and passes.
- [ ] `pnpm test:integration` runs exactly 5 focused tests and passes against PostgreSQL 17.6.
- [ ] Rollback, concurrent stock locking, same-day cancellation, current IST-day boundaries, and analytics filters are asserted from persisted rows.
- [ ] Integration clients are explicitly closed; no retry/force-exit hides leaked handles.
- [ ] CI provisions only a loopback disposable PostgreSQL service and runs the separate integration command.
- [ ] No dependency, lockfile, product schema, production behavior, or production DB configuration changes.
- [ ] Plan 007 is `DONE` in `plans/README.md`, unless the dispatcher owns the index.
- [ ] `git diff --cached --check` passes for every commit, including new files.
- [ ] If a push or pull request is authorized, the hosted `CI / integration`
      job passes; otherwise hosted verification is recorded as pending.

## Rollback

This plan changes only test/CI infrastructure and creates no production data or
schema. If an interrupted local run leaves the disposable database behind, run
`TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm exec tsx scripts/integration-db-lifecycle.ts drop`;
never use another database name or remote host. Revert the
plan's commits in reverse order to remove the CI job, integration tests, and
harness. If `CI / integration` was separately made a required repository check,
update that external branch-protection rule before removing the workflow so
merges are not blocked by a check that no longer exists.

## STOP conditions

Stop and report; do not improvise if:

- Plan 006 is not complete, its workflow/`pnpm check` shape differs, or its gates are red.
- Versioned migrations now exist. Reassess this plan with Plan 008; do not keep a parallel schema-push bootstrap silently.
- `drizzle-kit push` cannot build a fresh empty database from `src/db/schema.ts`, requests remote access, needs seed data/extensions, or reports destructive changes after fresh creation.
- The supplied URL is not loopback/exactly `cocoacomaa_test`, or the database user cannot create/drop that test database. Never relax the guard or use an existing database.
- Cleanup cannot terminate connections/drop the test database. Report the generic database name; do not print credentials.
- Testing the public lifecycle paths requires exporting private production internals or changing runtime behavior; the planned `@/db`, auth, and cache mocks should be sufficient.
- The concurrent test remains nondeterministic on a second run. Do not add retries or weaken “exactly one succeeds.”
- Freezing only `Date` interferes with Postgres I/O, or tests pass only by faking all timers.
- CI policy forbids service containers or requires a different approved PostgreSQL setup.
- Any step requires production data, secrets, a remote database, new dependencies, or out-of-scope files.
- A verification fails twice after one reasonable correction.

## Maintenance notes

- This harness proves schema behavior, not migration replay. Plan 008 should make
  migrations the integration bootstrap once a tracked history exists, then
  remove `drizzle-kit push --force` from the runner.
- The fixed database name intentionally prevents ambiguous destructive targets;
  do not run two local integration commands concurrently against the same server.
- Extend these files when later order-authority, inventory-concurrency, and
  idempotency plans land. Keep the suite focused on persisted invariants.
- Reviewers should scrutinize the URL guard, EXIT-trap status preservation,
  explicit client shutdown, and boundary timestamps before test assertions.
