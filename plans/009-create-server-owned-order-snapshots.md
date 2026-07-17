# Plan 009: Create server-owned order snapshots

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report rather than improvising. When done,
> update only this plan's status row in `plans/README.md`.
>
> **Repository database model**: This internal application currently has one
> production database, applies schema changes with `drizzle-kit push`, and does
> not track versioned migration SQL. Plan 008 remains skipped. Do not generate
> or commit migration SQL, Drizzle snapshots, a migration journal, or a
> migration runbook while executing this plan.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- src/db/schema.ts src/lib/types.ts src/lib/validation.ts src/lib/validation.test.ts src/lib/pos-cart-behaviour/shapes.ts src/lib/pos-cart-behaviour/operations.ts src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts src/app/manager/orders/actions.ts src/lib/order-lifecycle.ts src/lib/order-lifecycle.test.ts src/lib/order-lifecycle.integration.test.ts scripts/run-integration-tests.sh plans/README.md`
> Plans 006, 007, 010, and 014 are expected to have changed quality gates,
> integration coverage, inventory validation, and summaries. Preserve those
> changes. Semantic drift in the order request, catalog schema, inventory audit,
> or lifecycle is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/007-add-database-lifecycle-reporting-tests.md`
- **Category**: security
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The POS currently supplies names, prices, modifiers, stock policy, and final
unit prices. A crafted request can therefore create fabricated or zero-price
orders and bypass inventory deduction. Historical invoices also read mutable
catalog names, while cancellation restoration depends on current stock policy.

After this plan, the request contains only catalog identifiers and quantities.
One database transaction locks and resolves the active catalog, calculates
combo pricing, persists immutable display snapshots, calculates the total, and
records stock movement. Cancellation restores the movement recorded by the
original `order_deducted` audit regardless of later catalog edits.

## Required behavior

The shared request line is exactly:

```ts
export type OrderRequestLine = {
	baseDessertId: number;
	comboId?: number;
	quantity: number;
};
```

- Customer name and delivery cost remain request inputs. Names, prices,
  `cartLineId`, modifiers, combo name, and `hasUnlimitedStock` do not.
- Direct lines resolve an active base dessert and use its current price.
- Combo lines resolve the supplied combo, validate its base identity, lock all
  referenced catalog rows, and preserve the existing pricing rule:
  `overridePrice ?? base price + modifier price * combo quantity`.
- New order items snapshot the base dessert name, optional combo name, and each
  modifier name. They also snapshot whether inventory was actually deducted so
  cancellation can distinguish an unlimited-stock order from missing audit
  evidence. Readers construct the existing public nested dessert shape from
  snapshots so UI and invoice contracts do not change.
- `order_items.orderId` references orders with cascade deletion.
  `order_items.dessertId` and modifier dessert references restrict physical
  catalog deletion.
- Cancellation restores only positive deltas from the original order's
  `order_deducted` audit rows. It never consults current unlimited-stock state.
- Arithmetic must be exact and bounded to the existing numeric persistence
  capacity. Invalid, inactive, stale, mismatched, or insufficient-stock inputs
  roll back the entire transaction.

## Commands

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0; lockfile unchanged |
| Unit tests | `pnpm test` | all tests pass |
| Integration | `TEST_DATABASE_URL='<operator-supplied-loopback-url>' pnpm test:integration` | lifecycle/reporting tests pass; disposable DB is dropped |
| Schema proof | `DATABASE_URL='<operator-supplied-empty-loopback-url>' pnpm exec drizzle-kit push --force` | final schema applies only to verified-empty disposable DB |
| Quality gate | `pnpm check` | exit 0 |
| Build | `pnpm build` | exit 0 |

Never print or commit a database URL. The schema proof URL must be parsed and
verified as loopback, must identify a non-system database, must contain no
connection parameters that override host/database, and must be empty before
the push. `--force` is allowed only after those checks on that disposable DB.

## Scope

**In scope:**

- `src/db/schema.ts`
- `src/lib/types.ts`
- `src/lib/validation.ts`
- `src/lib/validation.test.ts`
- `src/lib/pos-cart-behaviour/shapes.ts`
- `src/lib/pos-cart-behaviour/operations.ts`
- `src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts`
- `src/app/manager/orders/actions.ts`
- `src/lib/order-lifecycle.ts`
- `src/lib/order-lifecycle.test.ts`
- `src/lib/order-lifecycle.integration.test.ts`
- `src/lib/admin-reporting/admin-reporting.integration.test.ts` (fixture fields
  required by the new non-null order-item snapshots only)
- `src/lib/combo-service.ts` (parent-first lock protocol for combo-item writes
  only)
- `plans/README.md` (only Plan 009's status row)

**Read-only references:**

- `src/app/combos/actions.ts`
- `src/app/desserts/actions.ts`
- manager/admin order consumers and invoice model/tests
- `src/lib/recompute-day-analytics.ts`
- `scripts/run-integration-tests.sh`

**Out of scope:**

- Plan 008, versioned migrations, generated SQL, Drizzle metadata, or a
  migration runbook
- Idempotency keys and duplicate-submit behavior (Plan 011)
- Modifier revenue attribution or analytics redesign
- Arbitrary/custom modifiers
- Catalog-version or stale-price confirmation UI
- Repairing historical names that were already changed
- Dependency upgrades or any automatic production mutation

## Git workflow

- Branch: `feat/009-create-server-owned-order-snapshots`
- Suggested commits:
  1. `feat(db): add immutable order item snapshots`
  2. `fix(orders): resolve pricing and stock policy on server`
  3. `test(orders): cover authoritative order persistence`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Confirm the live contract and baseline

Confirm Plan 007 is `DONE`, `pnpm check` passes, and the disposable integration
runner creates its schema with `drizzle-kit push`. Confirm direct desserts have
no modifiers and combos are identified by `comboId` plus `baseDessertId`.

```bash
rg -q '007.*DONE' plans/README.md
rg -n 'drizzle-kit push' scripts/run-integration-tests.sh
! rg -n 'db:migrate|drizzle/000' scripts/run-integration-tests.sh
pnpm check
```

If an unexposed custom-modifier capability must be retained, STOP; do not invent
an identifier contract for it.

### Step 2: Add the final schema and prove it on an empty database

In `src/db/schema.ts`:

1. Add non-null `baseDessertName` to `orderItemsTable`.
2. Add non-null `inventoryDeducted` to `orderItemsTable`; it records the
   authoritative stock policy used by the order transaction and is not a
   public response field.
3. Add non-null `dessertName` to `orderItemModifiersTable`.
4. Add the order-item-to-order cascade foreign key.
5. Add the order-item-to-dessert restrictive foreign key.
6. Change the modifier dessert foreign key from cascade to restrict.

Do not run `drizzle-kit generate`. Do not add anything under `drizzle/`.

Before the disposable push, parse the URL with `new URL(...)`; allow only
`postgres:`/`postgresql:`, `localhost`/`127.0.0.1`/`::1`, a non-system database
name, and no `host`, `hostaddr`, `dbname`, `service`, or `servicefile` query
parameter. Query `pg_class` and require zero application relations. Then run
the schema proof command and assert all three snapshot columns are non-nullable, both
new order-item foreign keys exist, and modifier deletion is restrictive.

```bash
git diff -- src/db/schema.ts
git status --short -- drizzle/
test -z "$(git status --short -- drizzle/)"
git diff --check
```

Arrange operator-confirmed removal of the disposable database after evidence is
collected. This proof validates the final schema shape; it does not authorize a
production push.

### Step 3: Minimize and strictly validate the request

Add `OrderRequestLine`, replace the rich line validation with a strict object
containing only base ID, optional combo ID, and quantity, and keep current line
and quantity limits. Make the containing request strict.

At the POS adapter boundary, map each rich cart line to a fresh minimal object.
Keep the rich client model for display, copy, and UPI behavior. Update the server
action to accept only validated minimal lines. Do not support a legacy shape.

Tests must prove stripped fields are rejected, the adapter sends only minimal
references, and direct/combo cart behavior remains intact.

### Step 4: Resolve and lock the authoritative catalog

Inside the order transaction, resolve all request lines in bounded set-based
queries and lock the required dessert/combo rows. Use one parent-first protocol
for both order reads and `updateComboItems`: lock combo parents, then combo-item
children, then desserts, with stable ordering and a lock strength compatible
with foreign-key key-share locks. Validate active status, base/combo identity,
modifier membership and quantities, and duplicate line semantics. Calculate
authoritative unit prices and immutable names from that coherent locked catalog
state.

Do not perform one query per line or accept any client price/name/stock field.
Unit tests must cover direct price, additive combo price, override price,
mismatched base/combo, inactive/missing records, duplicate references, numeric
bounds, and complete rollback.

### Step 5: Persist snapshots and preserve the public read shape

Write base, combo, and modifier snapshot names with the authoritative prices.
Change order readers to use snapshots rather than live catalog joins while
constructing the same public `OrderDetails` shape expected by existing UIs and
invoice code. Ensure raw snapshot columns do not leak into public payloads.

Tests must prove later rename, soft deletion, price edits, and combo edits do
not change historical order display or invoice output.

### Step 6: Restore cancellation from the audit

For cancellation, load the original order's `inventoryDeducted` snapshots and
`order_deducted` audit rows in the same transaction. The distinct dessert IDs
marked as deducted must exactly equal the audit dessert IDs; an empty audit set
is valid only when every item is marked not deducted. Lock affected inventory
rows in stable order and restore each positive
`previousQuantity - newQuantity` delta exactly once. Reject missing, extra,
duplicate, or malformed evidence rather than consulting current catalog stock
policy.

Keep existing lifecycle state-transition and concurrency safeguards. Cover
unlimited-stock policy changes, repeated cancellation, malformed audit rows,
and transaction rollback.

### Step 7: Extend PostgreSQL integration coverage

Add cases for authoritative price/name persistence, invalid catalog rollback,
stable historical display after catalog mutation, exact cancellation from
audits, unlimited-only cancellation, missing finite-stock audit refusal,
foreign-key/restrict behavior, and direct-dessert plus combo-item update races
coordinated with deferred promises and PostgreSQL lock evidence rather than
sleeps. Preserve every Plan 007 and Plan 010 integration test.

```bash
TEST_DATABASE_URL='<operator-supplied-loopback-url>' pnpm test:integration
```

The runner must create the disposable schema with `drizzle-kit push` and drop
its exact test database afterward.

### Step 8: Run the complete gate and commit

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format
pnpm test
TEST_DATABASE_URL='<operator-supplied-loopback-url>' pnpm test:integration
pnpm check
pnpm build
git diff --check
git status --short
```

Expected: all commands pass; the lockfile is unchanged; no migration artifacts
exist; status lists only the scoped source, tests, and Plan 009 index row. Mark
the row `DONE` only after all gates pass.

## Production rollout checkpoint (operator-owned)

The final schema adds non-null columns and foreign keys to populated tables, so
it is not safe for an unattended or mixed-version push. Repository execution
stops at source changes and disposable-database proof.

For production, an operator must own a backup/change record and a write pause.
During the pause, inspect and resolve orphan counts without deleting or guessing
data; stage nullable snapshot columns if required by the live data; backfill
names from the best currently available catalog rows; derive
`inventoryDeducted` from the presence of that order/dessert's existing positive
`order_deducted` audit; verify no nulls/orphans or contradictory audit evidence;
then apply the final checked-in schema with `drizzle-kit push`, deploy the
matching application, and smoke-test one new order, historical read, and
cancellation before resuming writes. Commands and credentials belong in the
operator change record, not this repository.

If verification fails before writes resume, keep the pause and execute the
operator-reviewed database/application rollback. After a new-version order is
accepted, do not drop snapshots or redeploy the old writer; fix forward or use
a reviewed compatibility build.

## Done criteria

- [ ] Requests contain only customer/delivery input plus base ID, optional
      combo ID, and quantity.
- [ ] Pricing, stock policy, names, and modifiers are server-authoritative.
- [ ] Catalog resolution is coherent, locked, exact, and bounded.
- [ ] New rows contain immutable display snapshots and existing public readers
      and invoices use them without a payload-shape change.
- [ ] New rows snapshot whether inventory was deducted without exposing that
      internal field publicly.
- [ ] Cancellation requires complete audit evidence for every deducted dessert,
      restores exact positive deltas, and ignores current unlimited-stock state.
- [ ] Final schema push succeeds on a guarded empty disposable database; no
      migration SQL or Drizzle metadata is created.
- [ ] Unit, integration, lint, format, typecheck/check, and build gates pass.
- [ ] Production rollout remains operator-owned and records the write pause,
      backfill verification, smoke test, and rollback/fix-forward boundary.
- [ ] Only scoped files changed and Plan 009 is `DONE`.

## STOP conditions

Stop and report if:

- Plan 007 or the disposable integration harness is absent/failing.
- `scripts/run-integration-tests.sh` no longer uses a guarded push into its
  exact disposable test database.
- Any live order/item row is orphaned or cannot be backfilled from a catalog
  row; report counts and non-sensitive IDs, but do not delete or fabricate data.
- A database target is non-loopback/non-empty for repository verification, or a
  production push is requested without explicit operator ownership.
- Drizzle proposes unrelated/destructive schema changes.
- Live POS behavior requires arbitrary custom modifiers.
- Combo pricing no longer matches the documented rule.
- Existing deduction audits cannot prove exact positive restoration deltas.
- Production cannot pause writes for push, backfill verification, deploy, and
  smoke testing.
- Any verification fails twice after one focused correction, or a required fix
  touches an out-of-scope file.

## Maintenance notes

- Catalog rows remain mutable; order snapshots are the historical record.
- Future readers must prefer snapshots even when catalog relations exist.
- Disposable `drizzle-kit push` evidence is not permission to mutate production.
- Plan 011 may fingerprint the minimal validated request but must not
  reintroduce client-authored metadata.
