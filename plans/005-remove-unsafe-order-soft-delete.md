# Plan 005: Remove the unsafe order soft-delete path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat 848e31d..HEAD -- \
>   src/app/manager/orders/actions.ts \
>   src/lib/validation.ts \
>   src/lib/order-lifecycle.ts \
>   src/server/effect/cache-tags.ts \
>   CONTEXT.md
> git status --short -- \
>   src/app/manager/orders/actions.ts \
>   src/lib/validation.ts \
>   src/lib/order-lifecycle.ts \
>   src/server/effect/cache-tags.ts \
>   CONTEXT.md
> ```
>
> Expected result: no output from either command. The first command detects
> committed drift; the second detects staged, unstaged, or untracked in-scope
> work that the commit-range diff cannot see. Also record the full output of
> `git status --short` before editing so the final scope check can distinguish
> pre-existing unrelated work. If any in-scope file changed since this plan was
> written, compare the "Current state" excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The manager order module exports a soft-delete operation that hides an order
from order lists and revenue analytics by setting `orders.isDeleted`, but it
does not restore deducted inventory, write an inventory audit, or apply the
same-day/status safeguards used by cancellation. Static source inspection found
no UI or API caller, so the safest and smallest change is to remove this unused
entry point instead of defining a second reversal workflow. After this plan,
cancellation remains the sole operational way to reverse an order and continues
to restore inventory and record an audit atomically.

## Current state

- `src/app/manager/orders/actions.ts` — exports the unused `deleteOrder` server
  action and imports its lifecycle function and schema.

  ```ts
  // src/app/manager/orders/actions.ts:5-13
  import {
	cancelOrderAsNormalPath,
	createCompletedOrder,
	getCachedOrders as getCachedOrdersCore,
	serializeOrders,
	softDeleteOrder,
  } from "@/lib/order-lifecycle";
  import { cancelOrderSchema, createOrderWithLinesSchema, deleteOrderSchema } from "@/lib/validation";

  // src/app/manager/orders/actions.ts:48-52
  export async function deleteOrder(orderId: number) {
	await requireAuth();
	const { orderId: validatedOrderId } = deleteOrderSchema.parse({ orderId });
	await softDeleteOrder(validatedOrderId);
  }
  ```

- `src/lib/validation.ts` — defines validation used only by the server action
  being removed.

  ```ts
  // src/lib/validation.ts:44-46
  export const deleteOrderSchema = z.object({
	orderId: z.number().int().positive(),
  });
  ```

- `src/lib/order-lifecycle.ts` — defines a delete-only cache-tag type branch,
  refresh helper, Effect program, and exported Promise boundary. The Effect
  only flips `isDeleted`; it does not use a transaction or inventory audit.

  ```ts
  // src/lib/order-lifecycle.ts:52
  type OrderMutationTag = (typeof OrderTags.mutation)[number] | (typeof OrderTags.delete)[number];

  // src/lib/order-lifecycle.ts:96-98
  function refreshOrderMutationViewsAfterDelete(date: Date) {
	return refreshOrderMutationViewsEffect(date, OrderTags.delete);
  }

  // src/lib/order-lifecycle.ts:428-446
  function softDeleteOrderEffect(orderId: number) {
	return Effect.gen(function* () {
		const database = yield* Database;

		const [order] = yield* database.attempt("soft delete order", (db) =>
			db
				.update(ordersTable)
				.set({ isDeleted: true })
				.where(eq(ordersTable.id, orderId))
				.returning({ createdAt: ordersTable.createdAt }),
		);

		if (order) {
			yield* refreshOrderMutationViewsAfterDelete(order.createdAt);
			return;
		}

		yield* updateTagsEffect(OrderTags.delete);
	});
  }

  // src/lib/order-lifecycle.ts:533-535
  export async function softDeleteOrder(orderId: number) {
	await runOrderLifecycleOperation("deleteOrder", () => runNextAppEffect(softDeleteOrderEffect(orderId)));
  }
  ```

- `src/server/effect/cache-tags.ts` — contains a delete-only tag group and a
  delete-only exported helper. The helper has no source caller.

  ```ts
  // src/server/effect/cache-tags.ts:24-27
  export const OrderTags = {
	mutation: [CacheTag.orders, CacheTag.inventory, CacheTag.dashboard, CacheTag.analytics] as const,
	delete: [CacheTag.orders, CacheTag.dashboard, CacheTag.analytics] as const,
  } as const;

  // src/server/effect/cache-tags.ts:116-118
  export function updateOrderDeleteTagsEffect() {
	return updateTagsEffect(OrderTags.delete);
  }
  ```

- `CONTEXT.md` — currently describes cancellation as the normal reversal but
  also advertises the unsafe cleanup path.

  ```md
  <!-- CONTEXT.md:39-43 -->
  - Order:
    - Relevant statuses are `pending`, `completed`, and `cancelled`.
    - Completed, non-deleted orders are the source of truth for revenue analytics.
    - Order lifecycle covers reading manager Orders, creating completed Orders, cancelling Orders, and the soft-delete cleanup path.
    - Cancellation is the normal operational path for reversing an Order.
  ```

- `src/lib/order-lifecycle.ts:449-530` contains the safe reversal path. It locks
  the order, rejects deleted/already-cancelled/cross-day orders, restores stock,
  writes `order_cancelled` audit rows, and refreshes mutation views within the
  established lifecycle boundaries. Do not change it in this plan.
- `src/lib/order-lifecycle.test.ts:44-52` already verifies the operating-day
  rule used by cancellation. This removal does not introduce a new behavior
  that requires a new unit test.
- The following source search was run at planning time and found the delete
  symbols only in the four implementation files above. There was no UI, route,
  or other library caller:

  ```bash
  rg -n --hidden --glob '!node_modules' --glob '!.next' --glob '!plans/**' \
    'deleteOrder|softDeleteOrder|deleteOrderSchema|refreshOrderMutationViewsAfterDelete|OrderTags\.delete|updateOrderDeleteTagsEffect' \
    src scripts CONTEXT.md
  ```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm exec vitest run src/lib/order-lifecycle.test.ts` | exit 0; exactly one test file passes |
| Full tests | `pnpm test` | exit 0; all tests pass |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Build | `pnpm build` | exit 0; Next.js build completes |
| Scoped Biome | `pnpm exec biome check src/app/manager/orders/actions.ts src/lib/validation.ts src/lib/order-lifecycle.ts src/server/effect/cache-tags.ts` | exit 0, no diagnostics |
| Removed-symbol gate | `rg -n 'deleteOrder|softDeleteOrder|deleteOrderSchema|refreshOrderMutationViewsAfterDelete|OrderTags\.delete|updateOrderDeleteTagsEffect|delete:\s*\[CacheTag\.orders|soft-delete cleanup path' src scripts CONTEXT.md` | exit 1 with no output |
| Cancellation-preservation gate | `rg -n 'export async function cancelOrder\(|export async function cancelOrderAsNormalPath\(|function cancelOrderAsNormalPathEffect\(' src/app/manager/orders/actions.ts src/lib/order-lifecycle.ts` | exit 0 with exactly three matches: the server action, Effect program, and lifecycle export |

The repository-wide `pnpm lint` baseline is currently red because of unrelated
formatting in `src/components/product-card.tsx`. Do not edit that file in this
plan. Use the scoped Biome command above as this plan's formatting/lint gate;
`pnpm typecheck`, `pnpm test`, and `pnpm build` remain repository-wide gates.

## Scope

**In scope** (the only implementation/documentation files you should modify):

- `src/app/manager/orders/actions.ts`
- `src/lib/validation.ts`
- `src/lib/order-lifecycle.ts`
- `src/server/effect/cache-tags.ts`
- `CONTEXT.md`
- `plans/README.md` — status-row update only after implementation

**Out of scope** (do NOT touch):

- `src/db/schema.ts` — retain `orders.isDeleted`; existing data and reporting
  filters may depend on it.
- Any query that filters `orders.isDeleted = false` — legacy deleted rows must
  remain excluded exactly as they are today.
- `src/lib/order-lifecycle.test.ts` — no new behavior is being introduced; use
  the existing cancellation test as a regression gate.
- The cancellation transaction, its same-operating-day rule, inventory
  restoration, or audit behavior.
- Any attempt to restore, purge, or reclassify already soft-deleted orders.
- Dessert, combo, and UPI soft-delete behavior; this plan concerns orders only.
- UI work to add a replacement Delete control. No current source caller exists.
- The unrelated Biome failure in `src/components/product-card.tsx`.

## Git workflow

- Branch: `feat/005-remove-unsafe-order-soft-delete`
- Make one focused commit after all gates pass:
  `fix(orders): remove unsafe soft-delete path`
- Use Conventional Commits and do not add co-author trailers.
- Do NOT push or open a PR unless the operator explicitly instructs it.

## Rollback

- This change has no migration or data rewrite, so there is no database
  rollback or backfill step.
- Before commit, discard only this plan's edits if the removal is abandoned;
  do not overwrite any pre-existing work recorded by the preflight status.
- After commit, prefer a roll-forward fix that migrates any newly discovered
  caller to cancellation. Reverting the focused commit is mechanically safe,
  but it deliberately reintroduces the unsafe flag-only mutation and therefore
  requires explicit operator acceptance of that risk.

## Steps

### Step 1: Reconfirm that the delete path has no consumer

Before editing, run:

```bash
rg -n --hidden --glob '!node_modules' --glob '!.next' --glob '!plans/**' \
  'deleteOrder|softDeleteOrder|deleteOrderSchema|refreshOrderMutationViewsAfterDelete|OrderTags\.delete|updateOrderDeleteTagsEffect|soft-delete cleanup path' \
  src scripts CONTEXT.md
```

Expected result: matches are limited to the current-state definitions in:

- `src/app/manager/orders/actions.ts`
- `src/lib/validation.ts`
- `src/lib/order-lifecycle.ts`
- `src/server/effect/cache-tags.ts`
- `CONTEXT.md`

There must be no caller in a component, page, route, test, or other library.
Generated `.next` files are deliberately excluded and are not consumers.

**Verify**: run the command above → only the five listed files appear. If any
other file appears, STOP and report the external consumer.

### Step 2: Remove the server-action and validation entry points

In `src/app/manager/orders/actions.ts`:

1. Remove `softDeleteOrder` from the `@/lib/order-lifecycle` import.
2. Remove `deleteOrderSchema` from the `@/lib/validation` import.
3. Remove the exported `deleteOrder(orderId)` function in full.
4. Leave `getCachedOrders`, `createOrderWithLines`, `cancelOrder`, authentication,
   and database-unavailable error mapping unchanged.

In `src/lib/validation.ts`, remove only `deleteOrderSchema`. Leave
`createOrderWithLinesSchema`, `cancelOrderSchema`, and all non-order schemas
unchanged.

**Verify**:

```bash
rg -n 'deleteOrder|softDeleteOrder|deleteOrderSchema' \
  src/app/manager/orders/actions.ts src/lib/validation.ts
```

Expected result: exit 1 with no output.

### Step 3: Remove the lifecycle implementation and orphaned cache API

In `src/lib/order-lifecycle.ts`:

1. Narrow `OrderMutationTag` to `(typeof OrderTags.mutation)[number]`; do not
   broaden it to arbitrary strings.
2. Remove `refreshOrderMutationViewsAfterDelete` in full.
3. Remove `softDeleteOrderEffect` in full.
4. Remove the exported `softDeleteOrder` Promise boundary in full.
5. Do not change `cancelOrderAsNormalPathEffect`,
   `cancelOrderAsNormalPath`, order reads, analytics recomputation, or any
   remaining `ordersTable.isDeleted` checks.

In `src/server/effect/cache-tags.ts`:

1. Remove `OrderTags.delete`, retaining `OrderTags.mutation` unchanged.
2. Remove `updateOrderDeleteTagsEffect`; the planning-time search confirms it
   is orphaned once the lifecycle delete path is gone.
3. Do not change any other cache tag or helper.

**Verify**:

```bash
rg -n 'softDeleteOrder|refreshOrderMutationViewsAfterDelete|OrderTags\.delete|updateOrderDeleteTagsEffect|delete:\s*\[CacheTag\.orders' \
  src/lib/order-lifecycle.ts src/server/effect/cache-tags.ts
```

Expected result: exit 1 with no output.

Then run:

```bash
rg -n 'export async function cancelOrderAsNormalPath|function cancelOrderAsNormalPathEffect|OrderTags\.mutation' \
  src/lib/order-lifecycle.ts src/server/effect/cache-tags.ts
```

Expected result: exit 0; both cancellation symbols remain, and mutation-tag
references remain.

### Step 4: Make cancellation the documented sole reversal path

In the `Order` vocabulary section of `CONTEXT.md`:

1. Remove the phrase that includes "the soft-delete cleanup path" from the
   lifecycle description.
2. State explicitly that cancellation is the sole operational path for
   reversing an order.
3. Preserve the completed/non-deleted analytics rule and same-operating-day
   cancellation rule. Do not remove documentation of `isDeleted`, because the
   persisted column and legacy-row filters remain intentionally in place.

Target wording:

```md
- Order lifecycle covers reading manager Orders, creating completed Orders, and cancelling Orders.
- Cancellation is the sole operational path for reversing an Order.
```

**Verify**:

```bash
rg -n 'soft-delete cleanup path|sole operational path for reversing' CONTEXT.md
```

Expected result: exactly one match, for `sole operational path for reversing`.

### Step 5: Run all regression and removal gates

Run these commands in order:

```bash
pnpm exec biome check \
  src/app/manager/orders/actions.ts \
  src/lib/validation.ts \
  src/lib/order-lifecycle.ts \
  src/server/effect/cache-tags.ts
pnpm exec vitest run src/lib/order-lifecycle.test.ts
pnpm test
pnpm typecheck
pnpm build
rg -n 'deleteOrder|softDeleteOrder|deleteOrderSchema|refreshOrderMutationViewsAfterDelete|OrderTags\.delete|updateOrderDeleteTagsEffect|delete:\s*\[CacheTag\.orders|soft-delete cleanup path' src scripts CONTEXT.md
rg -n 'export async function cancelOrder\(|export async function cancelOrderAsNormalPath\(|function cancelOrderAsNormalPathEffect\(' \
  src/app/manager/orders/actions.ts src/lib/order-lifecycle.ts
```

Expected results:

- Scoped Biome, focused tests, full tests, typecheck, and build exit 0.
- The removed-symbol `rg` exits 1 with no output.
- The cancellation `rg` exits 0 with exactly three matches.

### Step 6: Finalize status, scope-check, and commit

After all Step 5 gates pass, update only Plan 005's row in `plans/README.md`
from `TODO` to `DONE`, unless the dispatcher explicitly said it owns the index.
Then run:

```bash
git diff --check
git diff --name-only HEAD
git status --short
git diff -- \
  src/app/manager/orders/actions.ts \
  src/lib/validation.ts \
  src/lib/order-lifecycle.ts \
  src/server/effect/cache-tags.ts \
  CONTEXT.md \
  plans/README.md
```

Expected results:

- `git diff --check` exits 0 with no output.
- `git diff --name-only HEAD` lists only the five in-scope implementation/docs
  files plus `plans/README.md` if this executor owns the status update. Unlike
  `git diff --name-only` without `HEAD`, this includes staged changes.
- `git status --short` contains no new out-of-scope entry relative to the
  preflight status. It also catches untracked files, which `git diff` omits.
- The displayed diff contains only the removals and documentation wording
  specified above. In particular, the `cancelOrder` action and
  `cancelOrderAsNormalPathEffect` body have no additions or modifications.

Stage only those reviewed files and create the single Conventional Commit
specified in "Git workflow". The status-row update belongs in the same commit;
do not leave it as a post-commit worktree change.

## Test plan

No new test file is required because this plan removes an unused operation and
does not introduce a replacement behavior. Regression coverage consists of:

- `src/lib/order-lifecycle.test.ts` continuing to pass, including the same-day
  cancellation rule.
- The full test suite continuing to pass.
- Typecheck and Next.js build proving there are no stale source imports or
  server-action references.
- Removed-symbol searches proving the unsafe path cannot be called from source.
- Cancellation-preservation searches proving the safe reversal action, Effect
  program, and exported lifecycle boundary remain present.

The focused unit test checks the operating-day helper; it does not execute the
database transaction or prove stock restoration/audit writes. For this removal,
that behavior is protected by the Step 6 diff review requiring the cancellation
body to remain unchanged. Database-backed lifecycle coverage is added by Plan
007 rather than expanded into this small removal.

Verification:

```bash
pnpm exec vitest run src/lib/order-lifecycle.test.ts
pnpm test
pnpm typecheck
pnpm build
```

Expected result: all four commands exit 0.

## Done criteria

- [ ] `deleteOrder`, `softDeleteOrder`, `softDeleteOrderEffect`,
      `deleteOrderSchema`, `refreshOrderMutationViewsAfterDelete`,
      `OrderTags.delete`, its `delete: [CacheTag.orders, ...]` group entry, and
      `updateOrderDeleteTagsEffect` have no `src`, `scripts`, or `CONTEXT.md`
      matches.
- [ ] The manager `cancelOrder` server action and its lifecycle implementation
      remain unchanged and discoverable by the cancellation-preservation gate.
- [ ] `orders.isDeleted` and existing reporting/read filters remain unchanged.
- [ ] `CONTEXT.md` identifies cancellation as the sole operational reversal
      path without deleting the non-deleted analytics rule.
- [ ] The scoped Biome command exits 0.
- [ ] `pnpm exec vitest run src/lib/order-lifecycle.test.ts` exits 0 with
      exactly one test file executed.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm build` exits 0.
- [ ] No files outside the in-scope list are modified, apart from this plan and
      the `plans/README.md` status row.
- [ ] One commit exists with message
      `fix(orders): remove unsafe soft-delete path`.
- [ ] `plans/README.md` status row is updated unless the dispatcher owns it.

## STOP conditions

Stop and report back; do not improvise if any of these occurs:

- Any component, page, route, test, library, or other source file outside the
  definitions listed in "Current state" imports or calls `deleteOrder` or
  `softDeleteOrder`. This means the no-consumer assumption is false and the
  external contract needs an explicit migration decision.
- An in-scope current-state excerpt no longer matches after the drift check.
- Removing the path appears to require a database migration, changing
  `orders.isDeleted`, or editing existing `isDeleted = false` query filters.
- Cancellation or its same-operating-day/inventory-audit behavior is absent or
  must be changed to make the removal compile.
- A generated `.next` manifest is the only remaining match; do not edit build
  output. Clean/rebuild it through `pnpm build` instead.
- A verification command fails twice after one reasonable correction attempt.
- The fix requires modifying a file outside Scope, including the unrelated
  `src/components/product-card.tsx` lint failure.

## Maintenance notes

- Retaining `orders.isDeleted` is deliberate. Historical deleted rows and
  reporting filters are a separate data-retention concern, not permission to
  reintroduce an operational delete action.
- All future order reversals should extend the cancellation transaction so
  stock, audit logs, status, and analytics stay consistent. Do not add another
  flag-only delete mutation.
- Reviewers should confirm this PR contains no schema/query changes and that
  `OrderTags.mutation` still invalidates orders, inventory, dashboard, and
  analytics after cancellation.
- If a hard-delete or administrative cleanup workflow is later required, design
  its retention, inventory, revenue, audit, authorization, and historical-day
  rules explicitly as a separate plan.
