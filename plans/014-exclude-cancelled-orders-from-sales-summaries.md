# Plan 014: Exclude cancelled orders from sales summaries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` only if that file is tracked and a reviewer has not told you
> they maintain the index. An untracked index remains dispatcher-owned.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- src/lib/order-sales-summary.ts src/lib/order-sales-summary.test.ts src/app/admin/orders/orders-page.tsx src/app/manager/orders/orders-page.tsx plans/README.md; git -c status.branch=false status --short -- src/lib/order-sales-summary.ts src/lib/order-sales-summary.test.ts src/app/admin/orders/orders-page.tsx src/app/manager/orders/orders-page.tsx plans/README.md`
> The second command is required because the commit-range diff does not report
> working-tree or untracked files. Record the full worktree status as a baseline
> so unrelated pre-existing changes are not attributed to this plan.
> Plan 006 is expected to have changed `plans/README.md`. If either order page
> changed, compare the current summary and rendering code with the excerpts
> below. If its status semantics or summary fields differ, STOP and report.
> If either new helper path already exists or any implementation path has
> working-tree changes, STOP and reconcile ownership before editing. If
> `plans/README.md` is untracked, do not add or modify it for this plan.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/006-establish-green-quality-gate.md`
- **Category**: bug
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The Admin Orders page includes cancelled item quantities and cancelled order
totals in its “Items” and “Revenue” cards, and the Manager Orders page includes
cancelled quantities in “Items Sold.” That makes operational sales summaries
increase even when a sale is reversed. Cancelled records must remain visible in
history, and both pages' order-count cards must continue to count every visible
record; only sales quantities and revenue should exclude cancelled orders.

## Current state

- `src/app/admin/orders/orders-page.tsx` derives both sales values from every
  visible order:

  ```tsx
  // src/app/admin/orders/orders-page.tsx:88-93
  const totalItems = orders.reduce(
	(acc, order) => acc + order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
	0,
  );

  const totalRevenue = orders.reduce((acc, order) => acc + Number(order.total), 0);
  ```

  Its order card remains `orders.length`, while the list renders the unfiltered
  `orders` array:

  ```tsx
  // src/app/admin/orders/orders-page.tsx:114-127,146-148
  <p className="text-xl font-bold tabular-nums">{orders.length}</p>
  // ...
  <p className="text-xl font-bold tabular-nums">{totalItems}</p>
  // ...
  {orders.map((order) => (
  ```

- `src/app/manager/orders/orders-page.tsx` repeats the all-status item
  reduction:

  ```tsx
  // src/app/manager/orders/orders-page.tsx:335-338
  const totalItems = orders.reduce(
	(acc, order) => acc + order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
	0,
  );
  ```

  The Manager cards and history currently use:

  ```tsx
  // src/app/manager/orders/orders-page.tsx:365-384
  <CardTitle className="text-xs font-medium text-muted-foreground">Total Orders</CardTitle>
  // ...
  <div className="text-xl font-bold">{orders.length}</div>
  // ...
  <CardTitle className="text-xs font-medium text-muted-foreground">Items Sold</CardTitle>
  // ...
  {orders.map((order) => <OrderCard ... />)}
  ```

- `SerializedOrderDetails` already exposes every field needed by a pure helper:

  ```ts
  // src/lib/order-lifecycle.ts:40-50
  export type OrderDetails = Omit<Order, "isDeleted"> & {
	orderItems: OrderItemWithDessert[];
  };

  export type SerializedOrderDetails = Omit<OrderDetails, "createdAt"> & {
	createdAt: string;
  };
  export type SerializedOrders = SerializedOrderDetails[];
  ```

  `Order.status` is `"pending" | "completed" | "cancelled"`, and `total` is a
  numeric string (`src/db/schema.ts:106-128`).
- The requested page rule is deliberately narrower than analytics: skip only
  `cancelled`. Therefore both `completed` and visible `pending` records
  contribute to these page-level sales cards. `CONTEXT.md:37-43` documents all
  three statuses, while `CONTEXT.md:133` and `:195` reserve the stricter
  completed/non-deleted rule for analytics.
- There are no order-page component tests. Use a small library helper as the
  unit-test seam. `src/lib/order-lifecycle.test.ts:1-4` is the local Vitest
  import/structure exemplar.

## Target shape

Create one helper used by both pages:

```ts
type OrderSalesSummaryInput = Pick<SerializedOrderDetails, "status" | "total"> & {
	orderItems: ReadonlyArray<{ quantity: number }>;
};

export function summarizeOrderSales(
	orders: readonly OrderSalesSummaryInput[],
): { itemsSold: number; revenue: number };
```

The function iterates once, skips an order only when
`order.status === "cancelled"`, sums each remaining line quantity into
`itemsSold`, and converts each remaining numeric-string `total` with `Number()`
before adding it to `revenue`. It does not return an order count; both pages
must keep using `orders.length`, making the history-count rule explicit.

No percentage, average, or ratio is needed. Consequently there is no runtime
division. Empty and all-cancelled test cases cover zero-sales inputs: both
numeric result fields must be finite zero, never `NaN`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0; lockfile unchanged |
| Focused tests | `pnpm exec vitest run src/lib/order-sales-summary.test.ts` | 3 tests pass |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Quality gate | `pnpm check` | exit 0; Plan 006 made lint/test/typecheck green |
| Patch hygiene | `git diff --check` | exit 0 |

No new dependency, database, migration, browser, integration-test harness, or
production build is required. The frozen install is workspace setup only.
Plan 006 explicitly deferred `pnpm build` until build-time environment
requirements are reproducible from tracked configuration.

## Scope

**In scope (the only files to modify):**

- `src/lib/order-sales-summary.ts` (create)
- `src/lib/order-sales-summary.test.ts` (create)
- `src/app/admin/orders/orders-page.tsx`
- `src/app/manager/orders/orders-page.tsx`
- `plans/README.md` (only the Plan 014 status row, and only when the tracked
  index is executor-owned)

**Out of scope:**

- Filtering, hiding, deleting, or changing the order-history arrays or cards
- Changing Admin “Orders” or Manager “Total Orders”; both remain
  `orders.length`, including cancelled records
- Changing per-order item badges, line items, struck-through totals, invoices,
  cancellation controls, queries, APIs, cache behavior, or order lifecycle
- Changing database schemas, order statuses, analytics tables/queries, or the
  completed-only analytics rule
- Treating pending orders as cancelled or completed-only. This plan follows the
  explicit “exclude cancelled” rule and includes pending sales in page cards.
- Adding percentages, averages, memoization, a React hook, or a generalized
  reporting abstraction

## Git workflow

- Branch: `feat/014-exclude-cancelled-sales-summaries`
- One commit: `fix(orders): exclude cancelled orders from sales summaries`
- Do not push or open a pull request unless explicitly instructed.

## Steps

### Step 1: Confirm the green prerequisite and unchanged semantics

Create/switch to the branch, run the drift check, and confirm Plan 006 is
`DONE`. Verify the live pages still use `orders.length` for order counts,
render the unfiltered `orders.map(...)` history, and calculate the three sales
values with the excerpts above.

**Verify**:

```bash
rg -q '006.*DONE' plans/README.md
rg -n 'orders.length|orders.map' src/app/admin/orders/orders-page.tsx src/app/manager/orders/orders-page.tsx
pnpm check
```

Expected: Plan 006 is done, both pages contain `orders.length` and `orders.map`,
and the quality gate passes.

### Step 2: Add the pure summary helper and regression tests

Create `src/lib/order-sales-summary.ts` with the exact input and result shape in
“Target shape.” Import `SerializedOrderDetails` with `import type`. Use a simple
loop or reduction; do not mutate orders or their items and do not add status
configuration.

Create `src/lib/order-sales-summary.test.ts` with exactly these three tests:

1. **Mixed statuses:** completed order with multiple item lines, pending order,
   and a cancelled order with conspicuously large quantity/revenue. Assert the
   result includes completed plus pending only and equals exact expected
   `{ itemsSold, revenue }` values.
2. **Empty input:** assert `{ itemsSold: 0, revenue: 0 }` and both values satisfy
   `Number.isFinite`.
3. **All cancelled:** include at least two cancelled orders and assert the same
   finite-zero result, proving no cancelled value leaks into sales and the
   zero-sales case cannot produce `NaN`.

Use small structural fixtures containing only `status`, `total`, and line
`quantity`; the helper's narrow input type intentionally avoids fabricating
irrelevant order fields.

**Verify**:

```bash
pnpm exec vitest run src/lib/order-sales-summary.test.ts
pnpm typecheck
```

Expected: exactly 3 focused tests pass and TypeScript accepts both the helper
contract and fixtures.

### Step 3: Use the helper on the Admin Orders page

In `src/app/admin/orders/orders-page.tsx`, import
`summarizeOrderSales` from `@/lib/order-sales-summary`. Replace only the two
all-status reductions with:

```ts
const salesSummary = summarizeOrderSales(orders);
```

Render `salesSummary.itemsSold` in “Items” and
`salesSummary.revenue.toFixed(0)` in “Revenue.” Leave `orders.length`, loading
states, date/query behavior, and `orders.map(...)` unchanged.

**Verify**:

```bash
pnpm exec vitest run src/lib/order-sales-summary.test.ts
pnpm typecheck
rg -n 'orders.length|orders.map|salesSummary.itemsSold|salesSummary.revenue.toFixed' src/app/admin/orders/orders-page.tsx
```

Expected: tests and typecheck pass; all four expected Admin expressions are
present, proving history/count semantics remain separate from sales summary.

### Step 4: Use the same helper on the Manager Orders page

Import `summarizeOrderSales` in
`src/app/manager/orders/orders-page.tsx`. Replace only the page-level
`totalItems` reduction with the shared helper. Render its `itemsSold` value in
the “Items Sold” card. Do not change the `totalItems` local inside `OrderCard`;
that is a historical per-order badge and must continue showing cancelled order
contents.

Leave Manager `orders.length`, `orders.map(...)`, cancellation, refresh, and
loading behavior unchanged. Calling the helper once and ignoring `revenue` is
acceptable; do not create a manager-only second helper.

**Verify**:

```bash
pnpm exec vitest run src/lib/order-sales-summary.test.ts
pnpm typecheck
rg -n 'orders.length|orders.map|summarizeOrderSales|salesSummary.itemsSold' src/app/manager/orders/orders-page.tsx
test "$(rg -c 'const totalItems = order.orderItems.reduce' src/app/manager/orders/orders-page.tsx)" = "1"
```

Expected: tests and typecheck pass; the shared helper supplies the page card,
the history/count expressions remain, and exactly one per-card `totalItems`
calculation remains.

### Step 5: Run the full gate and commit

```bash
pnpm install --frozen-lockfile
git diff --exit-code -- pnpm-lock.yaml
pnpm check
git diff --check
! rg -n 'const totalItems = orders.reduce|const totalRevenue = orders.reduce' src/app/admin/orders/orders-page.tsx src/app/manager/orders/orders-page.tsx
! rg -n 'orders\.(filter|flatMap)' src/app/admin/orders/orders-page.tsx src/app/manager/orders/orders-page.tsx
git -c status.branch=false status --short
```

Expected: all commands pass; the lockfile is unchanged; old all-status page
reductions and order-array filtering are absent; compared with the recorded
baseline, this plan adds only the four implementation paths and, when
applicable, the tracked Plan 014 index-row edit. Update Plan 014's row to `DONE`
only when the tracked index is executor-owned.

Stage only those implementation paths and the executor-owned index row, then
run `git diff --cached --check`, `git diff --cached --name-only`, and
`git diff --cached`. The cached name list must contain exactly the four
implementation paths plus `plans/README.md` when applicable, and the cached
diff must contain the two new files in full. Commit with the message above.

## Test plan

- `src/lib/order-sales-summary.test.ts` covers completed/pending/cancelled
  mixing, multiple line quantities, empty input, and all-cancelled finite zeros.
- Existing `src/lib/order-lifecycle.test.ts` remains the type/serialization
  regression suite; no lifecycle behavior changes.
- `pnpm typecheck` proves both `SerializedOrders` arrays and client pages accept
  the narrow helper contract, while `pnpm check` supplies the repository's
  environment-free lint, typecheck, and full-unit-test gate established by
  Plan 006.
- No database or component-render test is justified because the defect is a
  deterministic reduction and the DOM labels/rendering remain unchanged.

## Done criteria

- [ ] Admin “Items” and “Revenue” exclude cancelled orders.
- [ ] Manager “Items Sold” excludes cancelled orders.
- [ ] Completed and pending visible orders contribute to page sales summaries.
- [ ] Cancelled orders still render in both history lists.
- [ ] Admin “Orders” and Manager “Total Orders” still use `orders.length`.
- [ ] Empty and all-cancelled inputs return finite numeric zeros.
- [ ] `pnpm exec vitest run src/lib/order-sales-summary.test.ts` reports 3
      passing tests.
- [ ] `pnpm check`, `git diff --check`, and `git diff --cached --check` exit 0.
- [ ] The lockfile is unchanged, and the cached diff contains only the four
      implementation paths plus the tracked, executor-owned Plan 014 index row
      when applicable.
- [ ] Plan 014's index row is `DONE` only when the tracked index is
      executor-owned; an untracked or dispatcher-owned index is untouched.

## STOP conditions

Stop and report; do not improvise if:

- Plan 006 is not complete or the quality baseline is not green.
- Either page no longer receives `SerializedOrders`, uses server-computed
  summary values, filters its history, or no longer renders the excerpts above.
- Product intent is to count only `completed` orders rather than all
  non-cancelled (`completed` plus `pending`) orders. That is a different status
  rule and requires an explicit decision before changing the helper.
- “Orders” or “Total Orders” is meant to become a completed/non-cancelled count;
  this plan intentionally preserves all visible records.
- The fix requires query, API, lifecycle, schema, analytics, card, invoice, or
  cancellation changes.
- Numeric totals are no longer decimal strings or item quantities are no longer
  numbers; do not add coercion or validation without reassessing the contract.
- A reviewer requires `pnpm build` before the tracked build-time environment
  contract deferred by Plan 006 exists; do not invent credentials or fake
  build configuration.
- A verification fails twice after one focused correction, or an out-of-scope
  file must change.

## Rollback

This change has no schema, migration, persisted-data, API, or cache effects. If
the non-cancelled page-summary rule must be withdrawn after merge, revert the
single plan commit. That restores the prior card reductions and removes the
pure helper/tests; cancelled order records themselves are never changed.

## Maintenance notes

- Future page-level sales cards should use `summarizeOrderSales`; per-order
  history displays should continue reading the order directly.
- Reviewers should verify the helper skips exactly `cancelled`, not every status
  other than `completed`, and that neither page filters the order array.
- If pending orders later gain a distinct financial meaning, update the domain
  decision first and change the helper plus mixed-status test together.
- Analytics intentionally remains completed/non-deleted and is not coupled to
  this operational page helper.
