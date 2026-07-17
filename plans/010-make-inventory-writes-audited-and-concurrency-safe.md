# Plan 010: Make manual inventory writes audited and concurrency-safe

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 848e31d..HEAD -- src/lib/validation.ts src/lib/validation.test.ts src/lib/daily-inventory.ts src/lib/daily-inventory.integration.test.ts src/lib/role-actions/inventory-actions.ts src/lib/role-actions/admin-inventory.ts src/lib/role-actions/manager-inventory.ts src/app/admin/desserts/actions.ts src/app/manager/desserts/actions.ts src/app/manager/inventory/actions.ts src/app/manager/inventory/inventory-page.tsx src/components/use-inventory.ts src/components/use-inventory.test.ts src/app/admin/desserts/manage-desserts.tsx src/app/manager/desserts/manage-desserts-inventory.tsx plans/README.md; git -c status.branch=false status --short -- src/lib/validation.ts src/lib/validation.test.ts src/lib/daily-inventory.ts src/lib/daily-inventory.integration.test.ts src/lib/role-actions/inventory-actions.ts src/lib/role-actions/admin-inventory.ts src/lib/role-actions/manager-inventory.ts src/app/admin/desserts/actions.ts src/app/manager/desserts/actions.ts src/app/manager/inventory/actions.ts src/app/manager/inventory/inventory-page.tsx src/components/use-inventory.ts src/components/use-inventory.test.ts src/app/admin/desserts/manage-desserts.tsx src/app/manager/desserts/manage-desserts-inventory.tsx plans/README.md`
> Plans 006 and 007 are expected to have added the quality gate, integration
> harness, and index updates. The status command is required because `git diff`
> omits untracked files. For every other changed in-scope path, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/007-add-database-lifecycle-reporting-tests.md`
- **Category**: bug
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The dedicated manager inventory page sends an absolute quantity for every
dessert from a client snapshot, then writes through an unaudited upsert. The
admin and manager dessert pages use a separate audited writer, but that writer
does not lock rows or verify the quantity the editor originally saw. A sale or
second editor can therefore change stock while a form is open, after which the
stale absolute save silently overwrites the newer quantity and makes the audit
history and end-of-day stock unreliable.

After this plan, every manual stock edit uses one validated writer. Each dirty
row carries its observed `expectedQuantity`; the writer creates missing rows,
locks affected rows with PostgreSQL `FOR UPDATE`, rejects the whole batch as a
typed conflict when any expectation is stale, and otherwise writes the
`set_stock` audit and absolute quantities atomically. This is optimistic
concurrency control, not a schema migration, and it deliberately leaves order
deduction semantics unchanged.

## Current state

- `src/lib/daily-inventory.ts` — contains two absolute-write paths. The first is
  unaudited; the second audits but reads without a row lock or stale-value
  comparison.

  ```ts
  // src/lib/daily-inventory.ts:54-86
  export function upsertInventoryForDayEffect({ day, updates, now = new Date() }) {
	// ...
	yield* database.attempt("upsert daily inventory", (db) =>
		db.insert(dailyDessertInventoryTable).values(values).onConflictDoUpdate({
			target: [dailyDessertInventoryTable.day, dailyDessertInventoryTable.dessertId],
			set: { quantity: sql`excluded.quantity`, updatedAt: sql`excluded."updatedAt"` },
		}),
	);
  }

  // src/lib/daily-inventory.ts:106-121
  yield* database.attempt("set daily inventory with audit", (db) =>
	db.transaction(async (tx) => {
		const currentInventory = await tx
			.select({
				dessertId: dailyDessertInventoryTable.dessertId,
				quantity: dailyDessertInventoryTable.quantity,
			})
			.from(dailyDessertInventoryTable)
			.where(eq(dailyDessertInventoryTable.day, day));
		const currentMap = new Map(currentInventory.map((row) => [row.dessertId, row.quantity]));
  ```

- `src/app/manager/inventory/actions.ts:28-44` — the dedicated manager action
  validates only `{ dessertId, quantity }`, then calls the unaudited writer.

  ```ts
  export async function upsertTodayInventory(updates: Array<{ dessertId: number; quantity: number }>) {
	await requireAuth();
	const { updates: validatedUpdates } = upsertInventorySchema.parse({ updates });
	// ...
	yield* upsertInventoryForDayEffect({ day, updates: validatedUpdates });
	yield* updateInventoryTagsEffect();
  }
  ```

- `src/app/manager/inventory/inventory-page.tsx:79-98` — every dessert is sent,
  even when the user edited only one row. No observed quantity accompanies the
  new absolute value.

  ```ts
  await saveInventoryMutation.mutateAsync(
	desserts.map((d) => ({
		dessertId: d.id,
		quantity: Number.parseInt(quantities[d.id] ?? "0", 10),
	})),
  );
  // refetch and report success
  ```

- `src/components/use-inventory.ts:43-54,96-111` — the shared admin/manager
  adapter already identifies dirty rows, but sends no `expectedQuantity` and
  treats any resolved action as success.

  ```ts
  const serverQty = serverQuantities.get(dessert.id) ?? 0;
  if (currentQty !== serverQty) changed.add(dessert.id);

  const updates = desserts
	.filter((d) => d.enabled && !d.hasUnlimitedStock && changedDessertIds.has(d.id))
	.map((d) => ({
		dessertId: d.id,
		quantity: Number.parseInt(quantities[d.id] ?? "0", 10),
	}));
  await onSave(updates);
  ```

- `src/lib/role-actions/inventory-actions.ts:18-31` — the role-aware writer
  authenticates but does not validate its input; it also invalidates the cache
  regardless of the domain result because there is no result today.

  ```ts
  async upsertInventoryWithAudit(updates: Array<{ dessertId: number; quantity: number }>) {
	const user = await requireUser();
	await runNextAppEffect(
		Effect.gen(function* () {
			yield* setInventoryWithAuditEffect({ day, updates, userId: user.id });
			yield* updateInventoryTagsEffect();
		}),
	);
  }
  ```

- `src/lib/validation.ts:131-138` validates the new quantity but has no
  expected quantity and permits duplicate dessert IDs.

  ```ts
  const inventoryUpdateSchema = z.object({
	dessertId: z.number().int().positive(),
	quantity: z.number().int().min(0).max(10000),
  });
  export const upsertInventorySchema = z.object({
	updates: z.array(inventoryUpdateSchema).min(1).max(1000),
  });
  ```

- `src/lib/order-lifecycle.ts:197-225` is the serialization behavior the
  manual writer must coordinate with. Order deductions lock the same
  `(day, dessertId)` rows before applying relative updates:

  ```ts
  const lockedInventory = await tx
	.select({
		dessertId: dailyDessertInventoryTable.dessertId,
		quantity: dailyDessertInventoryTable.quantity,
	})
	.from(dailyDessertInventoryTable)
	.where(and(eq(dailyDessertInventoryTable.day, day), inArray(dailyDessertInventoryTable.dessertId, dessertIds)))
	.for("update");
  ```

- `src/db/schema.ts:205-219` provides the unique key needed for conflict-free
  row initialization: `(day, dessertId)` is unique. `src/db/schema.ts:325-351`
  already supports `set_stock` audit rows with previous/new quantities and a
  user ID. The inventory `quantity` is a PostgreSQL `integer` with no database
  check constraint; relative order restoration can therefore leave an observed
  value outside the manual-write `0..10000` policy. `expectedQuantity` is an
  opaque comparison token and must round-trip any PostgreSQL integer even though
  the requested new `quantity` remains bounded. No schema column or migration
  is needed.
- Plan 007 creates `src/test/integration/database.ts`, a disposable PostgreSQL
  fixture, and `src/lib/order-lifecycle.integration.test.ts`. Reuse its URL
  guard, database layer, reset/close lifecycle, `@/db` mock, and fixed IST-day
  conventions. Do not create a second harness.
- Effect database failures are represented by `BackendDatabaseError` in
  `src/server/effect/errors.ts:8-11`, whose `cause` retains the error thrown by
  the transaction callback. The typed conflict must be recovered from that
  cause only; unrelated database failures must still reject.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0; lockfile unchanged |
| Unit tests | `pnpm exec vitest run src/lib/validation.test.ts src/components/use-inventory.test.ts` | exit 0; only the 2 requested files run and all 6 new contract/adapter tests pass |
| Integration tests | `TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration` | exit 0; existing tests plus the new inventory integration file pass and the disposable DB is dropped |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0, no diagnostics |
| Aggregate gate | `pnpm check` | exit 0 |
| Patch hygiene | `git diff --check` | exit 0 |

No new package is needed. Use Plan 007's PostgreSQL 17.6 service and existing
Vitest, Drizzle, Effect, React Query, and Zod dependencies.

## Scope

**In scope** (the only files you should modify):

- `src/lib/validation.ts`
- `src/lib/validation.test.ts` (create)
- `src/lib/daily-inventory.ts`
- `src/lib/daily-inventory.integration.test.ts` (create)
- `src/lib/role-actions/inventory-actions.ts`
- `src/lib/role-actions/admin-inventory.ts` — only if an explicit return type is required
- `src/lib/role-actions/manager-inventory.ts` — only if an explicit return type is required
- `src/app/admin/desserts/actions.ts` — only if an explicit return type is required
- `src/app/manager/desserts/actions.ts` — only if an explicit return type is required
- `src/app/manager/inventory/actions.ts`
- `src/app/manager/inventory/inventory-page.tsx`
- `src/components/use-inventory.ts`
- `src/components/use-inventory.test.ts` (create)
- `src/app/admin/desserts/manage-desserts.tsx` — make its refetch adapter reject a failed/stale fallback
- `src/app/manager/desserts/manage-desserts-inventory.tsx` — make its refetch adapter reject a failed/stale fallback
- `plans/README.md` — update only Plan 010's status row at completion

**Out of scope** (do NOT touch):

- `src/db/schema.ts`, migration files/configuration, or any new schema column.
- `src/lib/order-lifecycle.ts` or any change to order validation, deduction,
  cancellation, audit semantics, pricing, or transaction boundaries.
- Inventory history UI, analytics compilation, dashboard cache policy, or
  changes to the existing inventory quantity range.
- A general-purpose repository layer, distributed lock, database isolation
  level change, retry loop, background job, or new dependency.
- Keeping the unaudited writer as a fallback or compatibility path.
- Production data, remote databases, or real credentials. Run integration
  tests only through Plan 007's guarded local `cocoacomaa_test` database.
- Plans 006/007 implementation or changes to their test harness, except adding
  the one new integration test file through its existing public fixture.

## Git workflow

- Branch: `feat/010-inventory-concurrency`
- Suggested commits:
  1. `fix: make manual inventory writes concurrency-safe` — all production and
     unit-test changes from Steps 2-6 together
  2. `test: cover concurrent inventory writes`
- Use Conventional Commits as shown above. Do not push or open a PR unless
  instructed. Stage no unrelated plans or user changes. Steps 2-6 are one
  atomic contract migration: the new required field and result union are not
  compatible with the old callers, so do not commit, deploy, or expect a clean
  repository-wide typecheck between those steps. The Step 6 typecheck is the
  first valid contract-wide gate.

Before each suggested commit, stage only that commit's in-scope files and run
`git diff --cached --check` plus `git diff --cached --name-only`. This is
required because unstaged `git diff --check` does not inspect newly created
files.

## Steps

### Step 1: Confirm prerequisites and the green baseline

Create/switch to the plan branch, run the drift check, and confirm Plans 006 and
007 are `DONE` in `plans/README.md`. Confirm `pnpm check` is green and the Plan
007 integration command creates and drops only the disposable test database.

**Verify**:

- `rg -n '^\| 006 .* DONE|^\| 007 .* DONE' plans/README.md` → both plan rows are found.
- `pnpm install --frozen-lockfile && pnpm check` → exit 0; lockfile unchanged.
- Integration command from the Commands table → exit 0; the existing suite
  passes and `cocoacomaa_test` is dropped.

### Step 2: Define and test one optimistic-write contract

In `src/lib/validation.ts`, add required `expectedQuantity` to each inventory
update. Keep requested `quantity` at the existing integer `0..10000` bounds,
but validate `expectedQuantity` across the full signed PostgreSQL `integer`
range (`-2147483648..2147483647`). It is a comparison token copied from the
database, not a proposed valid stock level; narrowing it to the write policy
would prevent an operator from repairing an out-of-policy persisted value.
Refine the update array so each `dessertId` occurs at most once; a duplicate ID
must be a validation error, not left for PostgreSQL to resolve. Keep the current
non-empty and maximum-1000 limits.

In `src/lib/daily-inventory.ts`, make the shared TypeScript contract explicit:

```ts
export type InventoryUpdate = {
	dessertId: number;
	expectedQuantity: number;
	quantity: number;
};

export type InventoryWriteResult =
	| { ok: true; updatedCount: number }
	| {
			ok: false;
			code: "INVENTORY_CONFLICT";
			conflicts: Array<{
				dessertId: number;
				expectedQuantity: number;
				actualQuantity: number;
			}>;
	  };
```

The server-action result must remain a plain serializable discriminated union;
do not return an `Error`, Effect value, class instance, Map, Date, or database
row. Add `src/lib/validation.test.ts` with three tests: accepts the full shape
with an observed value outside the requested-quantity range, rejects a missing
`expectedQuantity`, and rejects duplicate dessert IDs.

**Verify**: `pnpm exec vitest run src/lib/validation.test.ts` → only this file
runs and exactly 3 tests pass.

### Step 3: Replace both writers with one locked, atomic writer

Delete `upsertInventoryForDayEffect`. Rework `setInventoryWithAuditEffect` as
the only absolute manual-stock writer. Inside one `db.transaction`:

1. Sort the distinct affected dessert IDs ascending. Use that canonical order
   for initialization and lock acquisition so two overlapping multi-row editor
   batches cannot deadlock merely because their payloads arrived in different
   orders. Insert zero-quantity rows for every affected `(day, dessertId)` with
   `ON CONFLICT DO NOTHING`. This ensures `FOR UPDATE` has a row to lock.
2. Select only those affected rows with both the day predicate and `inArray`
   dessert predicate, add an explicit ascending `dessertId` `orderBy`, then call
   `.for("update")`. Do not scan/lock the entire day's inventory. Assert that
   exactly one locked row exists for every requested ID; a missing row after
   initialization is an unexpected database failure, not an implicit quantity
   of zero.
3. Compare every locked quantity with its update's `expectedQuantity`. Preserve
   request order in the returned conflict list even though lock order is
   canonical.
4. If any differ, throw a private transaction rollback sentinel carrying all
   conflicts. This throw is required so rows inserted in step 1 also roll back;
   returning a conflict directly from the transaction would wrongly commit
   those inserts. Recover only that sentinel from `BackendDatabaseError.cause`
   outside the transaction and return `{ ok: false, code:
   "INVENTORY_CONFLICT", conflicts }`. Re-fail every other database error.
5. If no conflicts exist, ignore exact no-ops (`quantity ===
   expectedQuantity`), insert one `set_stock` audit per changed row, and update
   those rows to the absolute new quantity in the same transaction. Use the
   locked/expected value for `previousQuantity`, the requested value for
   `newQuantity`, the authenticated user ID, and the existing note convention.
   Check that the update affected every changed ID; any mismatch is an
   unexpected failure that rolls back stock and audits, not a partial success.
6. Return `{ ok: true, updatedCount }`, where `updatedCount` equals the number
   of changed/audited rows. An empty direct effect call returns
   `{ ok: true, updatedCount: 0 }` without opening a transaction; server actions
   still reject empty batches through the schema.

Keep integer validation at the server-action boundary; do not silently turn
NaN, negative, fractional, or infinite input into zero. Preserve `now` injection
for deterministic tests. The manual writer and `applyOrderInventoryMovement`
will then serialize through the same PostgreSQL row locks without changing the
order code.

**Verify**:

- `rg -n 'export function upsertInventoryForDayEffect' src/lib/daily-inventory.ts` → no matches, exit 1. The old app import is removed in Step 4.
- `rg -n 'orderBy|\.for\("update"\)|INVENTORY_CONFLICT|expectedQuantity' src/lib/daily-inventory.ts` → finds canonical lock ordering, the lock, typed conflict, and comparison contract.
- Do not run the repository-wide typecheck yet; old action/client contracts are
  intentionally incompatible until Step 6.

### Step 4: Route every server action through the authoritative writer

In `src/lib/role-actions/inventory-actions.ts`, authenticate first, then parse
`{ updates }` with `upsertInventorySchema`. Call
`setInventoryWithAuditEffect` with only validated updates. Return its
`InventoryWriteResult` to the caller. Invalidate inventory tags only for an
`ok: true` result; a conflict rolled back all writes and needs no invalidation.
Do not catch or relabel authentication, validation, cache, or unexpected
database failures as inventory conflicts.

In `src/app/manager/inventory/actions.ts`, remove the direct Effect/database
writer imports and delegate `upsertTodayInventory` to the same manager
role-action module used by the manager dessert editor. Preserve the exported
action name for its existing client. Ensure the admin and manager role wrappers
and dessert action wrappers return the discriminated union rather than
discarding it; rely on inference unless an explicit annotation is necessary.

**Verify**:

- `rg -n 'upsertInventoryForDayEffect|setInventoryWithAuditEffect' src/app` → no matches, exit 1; app actions do not bypass the role layer.
- `rg -n 'upsertInventorySchema\.parse' src/lib/role-actions/inventory-actions.ts` → exactly one central boundary validation is found.
- Do not run the repository-wide typecheck yet; the clients migrate in Steps 5-6.

### Step 5: Send only dirty rows with their observed quantities

In `src/components/use-inventory.ts`, export a small pure
`buildDirtyInventoryUpdates` helper. It must consider only enabled,
limited-stock desserts, compare the parsed UI quantity to the latest
`serverQuantities` baseline, and return only changed rows in this shape:

```ts
{
	dessertId,
	expectedQuantity: serverQuantities.get(dessertId) ?? 0,
	quantity: parsedInputQuantity,
}
```

Parse the complete input string without integer coercion (for example, reject
blank input and use `Number`, not `Number.parseInt`). A fractional or otherwise
invalid value must remain invalid for Zod to reject; `1.5` must never silently
become `1`, and a blank must never silently become `0`.

Use this one derived array to build `changedDessertIds`, `hasChanges`, and the
save payload so the dirty-state indicator cannot diverge from the server
request. Change `onSave` to return `Promise<InventoryWriteResult>`.

After every resolved save result, refetch inventory and refresh the local
baseline only from a successful refetch. The admin and manager dessert-page
`onRefetch` adapters must inspect the React Query results and throw on either
`error`; they must not use the old `data ?? inventoryRows` fallback and claim it
is freshly loaded. For success, keep the existing success toast. For
`INVENTORY_CONFLICT`, do not show success: display a clear message such as
"Inventory changed while you were editing. Latest stock was loaded; review and
save again." The refresh intentionally replaces stale form values with the
latest server quantities. If a resolved success cannot be refetched, say the
save completed but the latest stock could not be loaded. If a conflict cannot
be refetched, say that a conflict occurred and ask the user to refresh; never
claim newer stock was loaded. A thrown save action retains the generic failure
path.

Add `src/components/use-inventory.test.ts` with three Node-compatible tests for
the pure helper: it emits only a changed limited/enabled row with the correct
expected and new quantities; and it excludes unchanged, disabled, and
unlimited-stock rows; and it does not truncate a fractional input or coerce a
blank input to zero. Do not add a DOM/test-renderer dependency merely to test
the hook.

The existing admin and manager dessert pages at
`src/app/admin/desserts/manage-desserts.tsx:101-106` and
`src/app/manager/desserts/manage-desserts-inventory.tsx:103-108` already pass
their role actions into `useInventory`; confirm both typecheck against the new
return contract.

**Verify**:

- `pnpm exec vitest run src/components/use-inventory.test.ts` → only this file runs and exactly 3 tests pass.
- `rg -n 'expectedQuantity' src/components/use-inventory.ts` → the dirty-row payload includes the baseline.
- `rg -n 'data \?\?' src/app/admin/desserts/manage-desserts.tsx src/app/manager/desserts/manage-desserts-inventory.tsx` → no stale-result fallback remains, exit 1.
- The dedicated manager page still has the old contract until Step 6, so run
  the repository-wide typecheck there.

### Step 6: Move the dedicated manager page onto the same client adapter

Refactor `src/app/manager/inventory/inventory-page.tsx` to use `useInventory`
instead of its local `useMutation`, all-desserts payload, duplicated quantity
state, and duplicated toast handling. Supply:

- `desserts` and the queried `inventoryRows`;
- `upsertTodayInventory` as `onSave`; and
- an `onRefetch` adapter that awaits `refetchInventory()` and returns
  `{ desserts, inventory: latestRows }`. Inspect the refetch result and throw
  its error instead of falling back to old query data.

Bind table inputs, Save disabled state, spinner, changed count (if shown), and
save handler to the hook result. This page must now send only dirty rows with
`expectedQuantity` and receive the same conflict/refetch feedback as both
dessert editors. Disable stock inputs for unlimited-stock desserts because the
shared helper intentionally excludes them; do not leave an editable control
whose value can never be saved. Remove imports made unused by the refactor; do
not redesign the page.

**Verify**:

- `rg -n 'useMutation|mutateAsync|toast\.' src/app/manager/inventory/inventory-page.tsx` → no matches, exit 1.
- `rg -n 'useInventory|onSave: upsertTodayInventory|onRefetch:' src/app/manager/inventory/inventory-page.tsx` → all three integration points are found.
- `pnpm lint && pnpm typecheck` → exit 0.

### Step 7: Prove rollback and serialization in real PostgreSQL

Create `src/lib/daily-inventory.integration.test.ts` on Plan 007's existing
fixture. Use the same `@/db` and Next cache mocks, reset data before each test,
close the owned client after the file, and freeze only `Date` at the Plan 007
fixed IST instant. Seed the minimum manager, desserts, and daily inventory rows.
Run `setInventoryWithAuditEffect` with `integrationDatabaseLayer`; use the
public order lifecycle path for the order race.

Add exactly four tests:

1. **Successful audited write:** expected 5, set 8. Assert the result is
   `ok: true` with one update, persisted quantity is 8, and one `set_stock`
   audit records 5 → 8 and the manager user.
2. **Atomic conflict rollback:** submit one existing stale row and one missing
   row in the same batch. Assert `INVENTORY_CONFLICT` reports the existing
   row's actual quantity, neither inventory value changes, the missing bootstrap
   row does not remain, and no audit is written.
3. **Two reversed multi-row manual saves:** seed two rows and concurrently
   submit batches containing the same IDs in opposite payload orders, both
   using the same observed quantities but different new quantities. Exactly one
   whole batch succeeds and one is a typed conflict; neither rejects with a
   deadlock/database error, both final quantities belong to the same winning
   batch, and exactly two matching `set_stock` audits exist.
4. **Order deduction versus manual save:** with stock 5, concurrently create a
   quantity-1 completed order and submit manual 5 → 10. The order succeeds. If
   manual wins the lock first, it succeeds and final stock is 9; if the order
   wins first, manual returns a conflict with actual quantity 4 and final stock
   is 4. Assert final stock is never 10 and audit rows match the observed valid
   serialization. Do not make the test depend on which transaction wins.

The last two tests must use actual concurrent promises and the real PostgreSQL
client pool. Do not mock transactions/locks, add sleeps/retries, weaken the
assertions, or export production internals for testing. Run the integration
command twice; both runs must pass rather than relying on one favorable
schedule.

**Verify**: run the integration command from the Commands table twice → both
runs exit 0; the new file reports exactly 4 passing tests each time, all
pre-existing integration tests pass, and the disposable database is dropped
after each run.

### Step 8: Run final gates and commit

Run the full local gates with PostgreSQL available. Review the diff, update only
Plan 010's index status to `DONE`, and make the suggested Conventional Commits.

**Verify**:

- `pnpm check` → exit 0.
- Integration command → exit 0; all integration tests pass and cleanup succeeds.
- `pnpm typecheck && pnpm lint && git diff --check` → exit 0.
- After staging each proposed commit, `git diff --cached --check` → exit 0 and
  `git diff --cached --name-only` lists only that commit's in-scope files.
- `rg -n 'upsertInventoryForDayEffect' src` → no matches, exit 1.
- `git diff --exit-code -- src/db/schema.ts drizzle.config.ts drizzle/ pnpm-lock.yaml` → exit 0; no schema, migration/config, or dependency drift.
- `git status --short` → only in-scope files plus pre-existing untracked plan files.

## Test plan

- Three validation tests lock the public payload shape and duplicate-ID rule.
- Three pure adapter tests prove every UI sends only dirty, enabled,
  limited-stock rows, includes the observed quantity, and does not coerce
  invalid numeric input into a different stock value.
- Four PostgreSQL integration tests prove successful audit persistence, full
  rollback on any stale row, serialization between two editors, and
  serialization between a manual write and the existing order deduction.
- Existing unit/integration suites remain green; no DOM library, schema push,
  migration, or mock lock substitutes for the database assertions.

## Done criteria

- [ ] `upsertInventoryForDayEffect` is deleted and no app action has a direct unaudited absolute-write path.
- [ ] Every manual inventory action authenticates and validates `dessertId`, `expectedQuantity`, `quantity`, batch bounds, and duplicate IDs through one role-action boundary.
- [ ] Clients send only dirty rows and use the latest fetched quantity as `expectedQuantity`.
- [ ] The writer initializes missing affected rows, locks only affected rows in canonical order, verifies lock/update coverage, and compares every expectation before writing stock or audits.
- [ ] Any stale row returns a serializable `INVENTORY_CONFLICT`, rolls back the entire batch including missing-row initialization, and writes no audit.
- [ ] A successful changed row writes exactly one `set_stock` audit and its absolute quantity atomically.
- [ ] All three inventory editors refetch on conflict and, after a successful refresh, clearly tell the user that newer stock was loaded.
- [ ] A failed refetch never replaces the baseline with stale fallback data or claims that newer stock was loaded; unlimited stock is not presented as editable on the dedicated page.
- [ ] Real PostgreSQL tests prove two-editor and order-versus-editor serialization without sleeps or retries.
- [ ] `pnpm check`, `pnpm test:integration`, `pnpm typecheck`, `pnpm lint`, and `git diff --check` all exit 0.
- [ ] No schema, migration, order lifecycle, dependency, or lockfile change exists.
- [ ] Plan 010 is `DONE` in `plans/README.md`, unless the dispatcher owns the index.

## Rollback and rollout

This is a schema-free application change, but the payload and return contracts
change together. Deploy all production changes from Steps 2-6 as one release;
do not roll out the server writer before every client sends
`expectedQuantity`, and do not roll out result-aware clients against an old
action that returns `void`. The two suggested commits must be deployed or
reverted together. Confirm the hosting path provides a single-version cutover
or build-sticky routing for Server Actions; otherwise use a maintenance window
for the release rather than allowing new clients to call an old writer.

To roll back, revert the integration-test commit and then the combined
production commit. This restores the old clients and actions in the same
release; it does not require data repair or a database rollback. Audit rows
already committed by the new writer are valid history and must not be deleted.
If rollback is prompted by a suspected lost update or audit mismatch, stop
manual inventory editing first, retain the audit rows, and reconcile the
affected day from orders plus audit history before reopening writes. A cache
invalidation failure occurs after the database transaction and cannot roll back
an already committed stock/audit change; treat an ambiguous client error as a
reason to refetch before retrying.

## STOP conditions

Stop and report; do not improvise if:

- Plans 006 or 007 are not complete, their commands differ materially, their
  gates are red, or the disposable PostgreSQL fixture is unavailable.
- Any current-state excerpt no longer matches the live code, or another plan
  has already changed the inventory payload/writer/locking behavior.
- `BackendDatabaseError.cause` does not preserve the private rollback sentinel.
  Do not convert all database failures to conflicts or commit bootstrap rows to
  avoid the problem.
- Drizzle cannot express `INSERT ... ON CONFLICT DO NOTHING`, affected-row
  `SELECT ... FOR UPDATE` with deterministic ordering, and the audit/update in
  one transaction without raw unsafe interpolation.
- The integration test discovers order deduction does not lock the same row, or
  a valid interleaving can persist stock 10 after a quantity-1 order succeeds.
- Either concurrency test remains nondeterministic on a second run. Do not add
  retries, sleeps, or assertions that allow a lost update.
- Correctness requires a schema column, advisory/distributed lock, isolation
  level change, order-lifecycle edit, or migration. Those are explicit scope
  changes requiring a new design decision.
- A server-action result cannot serialize the planned union, or a conflict can
  be represented only by throwing a generic error to the client.
- The deployment platform cannot prevent new result-aware clients from reaching
  the old unaudited action during rollout/rollback and no maintenance window or
  build-sticky routing is available. Do not accept a mixed-version unsafe-write
  window.
- Any UI caller cannot supply an observed quantity from its current fetched
  baseline; do not substitute a second preflight read outside the transaction.
- Any test or command would access a remote/production database, real secret,
  or non-`cocoacomaa_test` database.
- A verification fails twice after one reasonable correction, or the fix
  requires a file outside the in-scope list.

## Maintenance notes

- `expectedQuantity` is an optimistic-concurrency token. Any future inventory
  editor, bulk import, or API must preserve it and route through the same writer;
  a fresh server read performed just before writing defeats stale-editor
  detection.
- Missing rows are initialized inside the same transaction because PostgreSQL
  can lock rows, not absence. Conflict must throw within that transaction so
  initialization also rolls back.
- Reviewers should scrutinize transaction ordering, affected-row predicates,
  sentinel-only error recovery, all-or-nothing audit behavior, and the two valid
  order/manual interleavings.
- The existing order lifecycle has no explicit multi-row lock order. This plan
  proves the order/manual interaction for one inventory row and makes
  editor/editor batches deterministic, but it does not claim that a multi-item
  order racing a multi-row manual batch can never choose a PostgreSQL deadlock
  victim. Eliminating that operational failure would require a separately
  reviewed `order-lifecycle.ts` ordering change, which is out of scope here;
  PostgreSQL still rolls back the deadlock victim rather than permitting a lost
  update.
- This plan does not address order idempotency, synchronous analytics refresh,
  stock-history presentation, or schema-based row versions. Those remain
  separate findings/plans.
