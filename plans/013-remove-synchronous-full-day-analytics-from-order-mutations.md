# Plan 013: Remove full-day analytics compilation from order mutations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update only this plan's status row in
> `plans/README.md`, unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- src/lib/order-lifecycle.ts src/lib/order-lifecycle.integration.test.ts src/lib/analytics-jobs.ts src/lib/analytics-jobs.test.ts src/lib/admin-reporting/queries.ts src/lib/admin-reporting/admin-reporting.integration.test.ts CONTEXT.md docs/adr/0003-precompute-analytics-from-completed-orders.md plans/README.md; git -c status.branch=false status --short -- src/lib/order-lifecycle.ts src/lib/order-lifecycle.integration.test.ts src/lib/analytics-jobs.ts src/lib/analytics-jobs.test.ts src/lib/admin-reporting/queries.ts src/lib/admin-reporting/admin-reporting.integration.test.ts CONTEXT.md docs/adr/0003-precompute-analytics-from-completed-orders.md plans/README.md`
> The status command is required because `git diff` omits untracked tests.
> Plans 007 and 011 are expected to change the lifecycle integration tests and
> order creation refresh contract. Proceed only after both are `DONE`; compare
> all excerpts and preserve Plan 011's durable acknowledgement semantics.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: `plans/007-add-database-lifecycle-reporting-tests.md`, `plans/011-make-order-submission-idempotent.md`
- **Category**: perf
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

Every order creation, replay, and cancellation currently rebuilds revenue,
per-dessert revenue, and end-of-day stock for the entire IST day before the
request finishes. The work grows with daily order/audit volume and delays the
POS even though current-day dashboard revenue views already read live source
tables. Removing this inline compilation keeps mutations fast while the
existing 00:10 IST Trigger repair window remains the authoritative compiler for
closed days. The EOD stock reader must also stop including the still-open
current day; otherwise invalidation would expose a stale compiled row.

## Current state

- `src/lib/order-lifecycle.ts:19,85-98` couples full-day compilation and cache
  invalidation:

  ```ts
  import { recomputeDayAnalyticsEffect } from "@/lib/recompute-day-analytics";

  function refreshOrderMutationViewsEffect(date: Date, tags = OrderTags.mutation) {
	return Effect.gen(function* () {
		yield* recomputeDayAnalyticsEffect(date);
		yield* updateTagsEffect(tags);
	});
  }
  ```

- Creation awaits that path after commit at `src/lib/order-lifecycle.ts:333`;
  cancellation awaits it after commit at line 529. Plan 011 changes creation so
  a post-commit refresh failure returns the committed order with
  `refreshWarning: true`; this plan must preserve that result contract.
- `recomputeDayAnalyticsEffect` performs multiple full-day source scans/writes:
  daily revenue at `src/lib/recompute-day-analytics.ts:86-109`, dessert revenue
  at lines 111-124, and EOD stock at lines 126-164. The compiler itself remains
  correct and in scope for scheduled jobs, not removal.
- `src/lib/analytics-jobs.ts:34-54` computes the prior seven closed analytics
  days, explicitly excluding the current IST day, and recomputes each from
  source tables. Lines 78-87 then revalidate analytics caches.
- `src/trigger/analytics.ts:5-25` already schedules that daily repair at
  `10 0 * * *` using `Asia/Calcutta`, i.e. 00:10 IST. Do not change the schedule
  or seven-day repair window.
- Current-day dashboard reads are already live:
  - `src/lib/admin-reporting/queries.ts:117-184` reads completed, non-deleted
    current-day orders/items directly and combines them with closed-day weekly
    aggregates.
  - lines 287-365 read closed chart days from analytics but append the current
    IST day from `orders`.
  - lines 257-285 exclude the current IST day from missing-analytics warnings.
- `src/lib/admin-reporting/queries.ts:629-670` is the exception to that boundary:
  `getEodStockTrends` currently includes the current IST analytics day from
  `analytics_daily_eod_stock`. Once inline compilation is removed, that row
  would be stale or absent. EOD stock is meaningful only for closed days, so the
  query must return the most recent requested number of closed days and exclude
  the current day.
- Historical/closed dashboard dates continue to read compiled analytics.
- `src/lib/order-lifecycle.ts:480-482` permits cancellation only on the current
  operating day. Therefore interactive cancellation cannot change a closed
  historical analytics day.
- `src/server/effect/cache-tags.ts:26-29` gives order mutations the `orders`,
  `inventory`, `dashboard`, and `analytics` tags. Keep this catalog unchanged;
  mutations must still await `updateTagsEffect` so current live views are not
  served from stale caches.
- `CONTEXT.md:144-150` and ADR 0003 lines 19, 26-27 incorrectly require inline
  recomputation and must be updated with the new boundary.
- Plan 007 provides disposable PostgreSQL lifecycle/reporting tests and a
  closed-day compiler test. Plan 011 adds idempotency and defines creation's
  post-commit warning behavior. This plan extends those tests; it does not
  replace either foundation.

## Required behavior contract

1. A create or same-day cancel transaction commits source-of-truth order,
   inventory, and audit rows exactly as before.
2. After commit, the request awaits `updateTagsEffect(OrderTags.mutation)`.
   No call to `recomputeDayAnalyticsEffect` occurs in the request path.
3. Creation retains Plan 011 semantics: cache invalidation failure is logged and
   returned as `refreshWarning: true` for the durably committed order. Do not
   rename the field or turn it back into a failed sale.
4. Cancellation retains its live post-commit cache semantics from the dependency
   state: invalidation is awaited and any failure is surfaced, never detached.
   Do not add `void`, an unawaited promise, or silently swallow it. The public
   promise may therefore reject after the cancellation committed; that rejection
   must not be described or tested as a transaction rollback.
5. Current IST-day dashboard stats/chart data come from live source tables and
   update after tag invalidation; closed days come from compiled tables.
6. EOD stock trends read only compiled closed days: a request for `days = N`
   covers `[current IST day - N, current IST day)` and never returns a current-day
   compiled row. The response shape is unchanged.
7. The 00:10 IST task recompiles the previous seven closed days from completed,
   non-deleted source orders and inventory audits, then revalidates analytics
   caches. A compilation failure rejects the task before cache revalidation;
   the overwrite-based retry/window remains the recovery path.

Cache-tag updates are not atomic: an exception can occur after an earlier tag
was updated. Do not add an in-request retry loop. Creation's warning and
cancellation's rejection preserve the existing signal while source-table
writes remain committed; TTL expiry, a later mutation, or operator recovery can
heal any temporarily stale cache entry.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused unit | `pnpm exec vitest run src/lib/analytics-jobs.test.ts` | only the closed-day window tests run and pass |
| Integration | `TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration` | lifecycle/reporting/compiler tests pass; DB dropped |
| Unit gate | `pnpm check` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0 |

No dependency or database migration is required. `pnpm build` is not a gate for
this plan: Plan 006 deliberately deferred an environment-free production build,
and Plan 011 preserves that deferral. Do not invent credentials or broaden this
plan to solve the tracked build-environment contract.

## Scope

**In scope:**

- `src/lib/order-lifecycle.ts`
- `src/lib/order-lifecycle.integration.test.ts`
- `src/lib/analytics-jobs.ts` — export the existing pure window helper only
- `src/lib/analytics-jobs.test.ts` (create)
- `src/lib/admin-reporting/queries.ts` — make EOD stock closed-day-only
- `src/lib/admin-reporting/admin-reporting.integration.test.ts`
- `CONTEXT.md`
- `docs/adr/0003-precompute-analytics-from-completed-orders.md`
- `plans/README.md` (only Plan 013's final status row)

**Read-only verification inputs:**

- `src/lib/recompute-day-analytics.ts`
- `src/trigger/analytics.ts`
- `src/server/effect/cache-tags.ts`

**Out of scope:**

- Changing analytics compiler SQL, schemas, tables, Trigger schedules,
  repair-window length, monthly compilation, cache tag membership, or reporting
  response shapes beyond excluding the open day from the EOD stock query
- Adding a queue, outbox, background promise, `after()`, cron service, retry loop,
  or any fire-and-forget mutation work
- Changing order transaction, idempotency, pricing, inventory, or cancellation
  eligibility semantics
- Making historical cancellation possible
- Removing precomputed analytics or making every historical report query live
- Production/Trigger deployment changes and dependency updates

## Git workflow

- Branch: `feat/013-decouple-order-analytics`
- Commits:
  1. `perf(orders): remove inline analytics compilation`
  2. `test(analytics): cover live and closed-day boundaries`
  3. `docs(analytics): document scheduled compilation boundary`
- Do not push or open a PR unless instructed.

Before each commit, stage only that commit's in-scope files and run
`git diff --cached --check` plus `git diff --cached --name-only`. This is
required because unstaged `git diff --check` does not inspect newly created
files.

## Steps

### Step 1: Confirm dependencies and the live/compiled boundary

Confirm Plans 007 and 011 are `DONE`. Run existing unit and integration gates.
Read the live lifecycle after Plan 011 and identify its exact creation warning
catch; record its tests before editing. Confirm the Trigger schedule and current
reporting branches still match Current state.

**Verify**:

```bash
rg -n '^\| 007 .* DONE|^\| 011 .* DONE' plans/README.md
rg -n 'refreshWarning' src/lib/order-lifecycle.ts src/lib/order-lifecycle.integration.test.ts
rg -n 'pattern: "10 0 \* \* \*"|timezone: "Asia/Calcutta"' src/trigger/analytics.ts
rg -n 'isEndDateToday|fetch live data from orders table|lt\(analyticsDailyRevenueTable.day, currentAnalyticsDayParam\)' src/lib/admin-reporting/queries.ts
rg -n 'getEodStockTrends|lte\(analyticsDailyEodStockTable.day, endDayParam\)' src/lib/admin-reporting/queries.ts
pnpm check
TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration
```

Expected: both dependency rows, warning contract, 00:10 schedule,
live-current-day revenue branches, and the current compiled EOD inclusion are
present; all baseline tests pass.

### Step 2: Separate awaited invalidation from scheduled compilation

In `src/lib/order-lifecycle.ts`:

1. Remove the `recomputeDayAnalyticsEffect` import.
2. Replace `refreshOrderMutationViewsEffect` and date-taking wrappers with one
   narrowly named `invalidateOrderMutationCachesEffect(tags = OrderTags.mutation)`
   that returns `updateTagsEffect(tags)`. It does not need an `Effect.gen`.
3. After successful create/replay and cancellation transactions, await that
   effect through the existing Next runtime exactly where the old refresh was
   awaited. Do not pass `order.createdAt`; compilation no longer occurs.
4. Keep Plan 011's creation catch/result intact, but update log/message wording
   from analytics/cache “refresh” to cache invalidation while preserving
   `refreshWarning` for compatibility.
5. Preserve cancellation's awaited failure behavior from the live dependency
   state; do not silently catch or detach cache failures.

Do not call the scheduled compiler from an action, Trigger client, or new helper.

**Verify**:

```bash
! rg -n 'recomputeDayAnalyticsEffect|recompute-day-analytics' src/lib/order-lifecycle.ts
rg -n 'invalidateOrderMutationCachesEffect|updateTagsEffect\(tags\)' src/lib/order-lifecycle.ts
! rg -n 'void .*invalidate|void .*updateTags|setTimeout.*analytics|queueMicrotask' src/lib/order-lifecycle.ts
pnpm typecheck
```

Expected: lifecycle has no compiler dependency, uses one awaited invalidation
helper, contains no detached work, and typecheck passes.

### Step 3: Lock the closed-day repair window with a unit test

Export the existing pure `getClosedAnalyticsDays` from
`src/lib/analytics-jobs.ts`; do not change its implementation, default seven
days, `compileDailyAnalyticsTaskEffect`, or cache revalidation.

Create `src/lib/analytics-jobs.test.ts` with a fixed scheduled instant of
`2026-07-14T18:40:00.000Z` (00:10 IST on July 15). Assert the default window is
exactly the normalized analytics days `2026-07-08` through `2026-07-14`, in
ascending order, and never includes `2026-07-15`. Add one custom `days = 1`
assertion returning only July 14. Use real timers; the helper accepts `now`.

Also retain a static schedule assertion in final verification rather than
mocking Trigger.dev.

**Verify**: focused unit command → exactly the new window tests pass.

### Step 4: Prove mutations invalidate but never compile

Extend `src/lib/order-lifecycle.integration.test.ts` using the mocks/fixtures
from Plans 007 and 011:

- make the `next/cache` `updateTag` mock observable;
- provide a `recomputeDayAnalyticsEffect` spy that fails the test if called (or,
  if the module is no longer loaded, assert its hoisted spy remains at zero);
- create an order, then cancel it on the same fixed IST operating day;
- assert both operations complete their existing result contracts;
- assert the compiler spy was called zero times;
- assert each operation resolves only after every tag in `OrderTags.mutation`
  was passed to `updateTag`, in catalog order;
- assert no revenue, dessert-revenue, or EOD-stock analytics row was written by
  either mutation.

Update Plan 011's post-commit warning test so it injects a cache invalidation
failure, not a compiler failure. It must still prove the order is committed,
retry returns the same ID, and `refreshWarning` is true without duplicate stock
or audit writes. Add a cancellation failure assertion too: make `updateTag`
throw, assert the public cancellation promise rejects, then query the database
to prove the cancellation, restored inventory, and cancellation audit committed.
This distinguishes the intentionally different post-commit failure contracts.

**Verify**: integration command twice consecutively → all tests pass, compiler
call count remains zero, and cleanup succeeds both times.

### Step 5: Prove live-current and compiled-closed read boundaries

In `src/lib/admin-reporting/queries.ts`, change `getEodStockTrends(days)` to use
the current normalized IST analytics day as an exclusive upper bound and the
day `days` days earlier as its inclusive lower bound. Use the existing `lt`
import and name the exclusive parameter `currentDayParam`. Do not change its
return shape, cache key, revalidation interval, or tags.

Extend `src/lib/admin-reporting/admin-reporting.integration.test.ts` with three
focused assertions:

1. **Current day stays live:** seed a deliberately stale/incorrect
   `analytics_daily_revenue` row for the current analytics day plus current-day
   completed/cancelled source orders. Assert `getAdminDashboardReport` stats and
   final daily chart point match completed, non-deleted source orders, not the
   stale aggregate. Change a current order to cancelled and call again through
   the test's cache-bypass mock; the live values must update without compiling.
2. **EOD stock is closed-day-only:** seed EOD aggregate rows for the current IST
   day and the previous closed day. Call `getCachedEodStockTrends` through the
   existing auth/cache-bypass mocks and assert the stale current-day row is
   excluded while the closed row is returned. For a small `days` value, also
   seed a row exactly at the inclusive lower bound and one immediately before
   it; assert only the in-window row is returned.
3. **Closed compiler repairs from source truth:** for the previous closed IST
   day, seed completed/non-deleted and excluded source rows, run
   `recomputeDayAnalyticsEffect`, and assert daily/dessert aggregates plus EOD
   stock derived from the day's first/last inventory audit rows. Change the
   source truth by cancelling a counted order and appending a later audit row,
   run it again, and assert all three read models are overwritten to the new
   totals/closing stock rather than accumulated.

Do not add browser tests or expand into monthly reporting.

**Verify**:

```bash
rg -n 'lt\(analyticsDailyEodStockTable.day, currentDayParam\)' src/lib/admin-reporting/queries.ts
TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration
```

Expected: all three boundary/repair assertions and existing tests pass.

### Step 6: Update domain documentation and ADR 0003

Replace `CONTEXT.md:144-150`'s “Inline recompute workflow” with a mutation/
compilation boundary that states:

- order creation and same-day cancellation update source tables and await cache
  tag invalidation only;
- current IST-day dashboard metrics/chart points read live source tables;
- EOD stock trends expose only closed IST days;
- the 00:10 IST Trigger task recomputes the previous seven closed days;
- closed historical analytics cannot be changed by interactive cancellation
  because cancellation is same-operating-day only;
- operator-triggered repair for the current seven-day window remains available
  through the existing Trigger path.

Update ADR 0003 Decision/Consequences to remove the statements that mutation
paths recompute analytics. Record that `analytics_*` tables are closed-period
read models repaired from source truth by Trigger, current-day revenue views are
live, EOD stock excludes the open day, and mutations synchronously invalidate
relevant caches. Keep status `Accepted`; this is a refinement of the same
precomputation decision, not a new subsystem.

Do not claim analytics are real-time for closed periods or that cache
invalidation runs asynchronously.

**Verify**:

```bash
! rg -n 'Inline recompute|after order mutations|Mutation paths must recompute|batch and inline' CONTEXT.md docs/adr/0003-precompute-analytics-from-completed-orders.md
rg -n '00:10|previous seven closed|current IST-day|closed.*EOD|EOD.*closed|cache.*invalidat' CONTEXT.md docs/adr/0003-precompute-analytics-from-completed-orders.md
git diff --check
```

Expected: obsolete inline claims are absent and both documents state the
mutation, current-day, EOD, schedule, and cache boundaries.

### Step 7: Run final gates and commit

Run the focused unit tests, integration suite twice, then:

```bash
pnpm check
pnpm typecheck
pnpm lint
rg -n 'pattern: "10 0 \* \* \*"|timezone: "Asia/Calcutta"' src/trigger/analytics.ts
! rg -n 'recomputeDayAnalyticsEffect|recompute-day-analytics' src/lib/order-lifecycle.ts
git diff --check
git status --short
```

Expected: every command exits 0; only Scope files are modified. Make the three
Conventional Commits from Git workflow, using the staged checks there. Mark only
Plan 013's index row `DONE` after every gate passes. Do not push.

## Test plan

- Unit tests freeze the 00:10 IST repair input and prove the seven-day window
  contains only closed days.
- Lifecycle integration tests prove create/cancel await tag invalidation, never
  invoke compilation, and preserve Plan 011 cache-warning/idempotency behavior.
- Reporting integration tests prove current-day cards/chart use live source
  rows even with stale aggregates, EOD stock excludes the open day, and
  closed-day compilation remains an overwrite-from-source repair.
- Full unit, integration, type, and lint gates remain green.

## Done criteria

- [ ] `src/lib/order-lifecycle.ts` has no import/call to the daily analytics
      compiler and no detached background work.
- [ ] Creation and cancellation await all existing order mutation cache tags.
- [ ] Plan 011's committed-order `refreshWarning` behavior is preserved for
      cache invalidation failure and remains idempotent on retry.
- [ ] Cancellation invalidation failure rejects after commit, with persisted
      status, inventory restoration, and audit proving it was not rolled back.
- [ ] Current-day dashboard stats/chart use live completed, non-deleted orders.
- [ ] EOD stock trends return only the requested closed-day window and never a
      stale current-day compiled row.
- [ ] Daily job remains 00:10 IST and repairs exactly the previous seven closed
      analytics days before cache revalidation.
- [ ] Closed-day compiler tests prove overwrite-from-source behavior.
- [ ] No analytics compiler SQL/schema, schedule, tag catalog, reporting shape,
      dependency, queue, or migration changes.
- [ ] CONTEXT and ADR 0003 describe the live-current/scheduled-closed boundary.
- [ ] Focused tests, two integration runs, check, typecheck, and lint pass.
- [ ] Only Scope files changed; branch and commits match Git workflow.
- [ ] Plan 013's index row is `DONE`, unless the reviewer owns index updates.

## STOP conditions

Stop and report; do not improvise if:

- Plan 007 or Plan 011 is incomplete, red, or its lifecycle result/cache warning
  contract differs materially from this plan;
- current-day dashboard stats or chart points no longer read source tables;
- cancellation can affect a previous operating day;
- the daily Trigger job no longer runs at 00:10 IST, no longer repairs the prior
  seven closed days, or lacks its cache revalidation step;
- any current-day compiled analytics reader remains after the planned EOD stock
  boundary is applied;
- cache invalidation cannot be awaited without changing the public action
  contract, or a proposed fix uses fire-and-forget work;
- closed-day source-truth tests expose an existing compiler correctness bug;
  report it separately rather than expanding this performance plan;
- implementation requires analytics SQL/schema changes, a queue, scheduler
  deployment, new dependency, migration, or file outside Scope;
- a verification fails twice after one reasonable correction.

## Rollout and rollback boundary

This repository plan does not deploy the application or Trigger tasks. Before a
separate production rollout removes inline compilation, an operator must confirm
that the deployed `daily-analytics` schedule is enabled, has a recent successful
00:10 IST run, and can be manually triggered through the existing authenticated
operator path. A code-level static schedule assertion is not proof of deployed
health. If that cannot be confirmed, the repository artifacts may be completed
but rollout remains blocked.

No schema or source data changes are introduced. To roll back the repository
change, revert this plan's three commits in reverse order without reverting
Plans 007 or 011. That restores inline compilation and the former EOD query
boundary together. If a production rollout is separately authorized and cache
invalidation or scheduled repair is unhealthy, roll back the application to the
previous compatible revision through the approved release process; do not alter
analytics rows manually. The next successful scheduled/manual overwrite repairs
any affected day within the seven-day repair window. The existing operator CLI
cannot target an older window. If more than seven closed days were missed, stop
and arrange an approved one-off dated repair; do not widen the recurring window
or claim the current CLI repaired those days.

## Maintenance notes

- `recomputeDayAnalyticsEffect` remains the one closed-day compiler used by the
  Trigger repair task and operator-triggered repair. Do not fork its SQL.
- Current-day correctness depends on both live reporting branches and awaited
  `orders`/`dashboard` cache invalidation; reviewers should scrutinize both.
- EOD stock is a closed-day read model. Reintroducing a current-day EOD point
  would also require a live source implementation; cache invalidation alone
  cannot make a compiled current-day row fresh.
- The seven-day repair window deliberately heals missed/retried Trigger runs.
  Changing its length or schedule requires a separate operational decision.
- If historical order mutation is ever introduced, this assumption breaks; that
  feature must enqueue or synchronously request an explicit closed-day repair.
- A future queue/outbox may be justified for other workloads, but is unnecessary
  for this closed-day scheduled compiler and is intentionally excluded here.
