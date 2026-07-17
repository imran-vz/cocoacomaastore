# Plan 011: Make order submission idempotent end to end

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report rather than improvising. When done,
> update only this plan's status row in `plans/README.md`.
>
> **Repository database model**: This internal application applies production
> schema changes with `drizzle-kit push` and does not track versioned migration
> SQL. Plan 008 remains skipped. Do not generate or commit migration SQL,
> Drizzle snapshots, a journal, or a migration runbook.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- src/db/schema.ts src/lib/types.ts src/lib/sanitize.ts src/lib/validation.ts src/lib/validation.test.ts src/lib/order-lifecycle.ts src/lib/order-lifecycle.test.ts src/lib/order-lifecycle.integration.test.ts src/app/manager/orders/actions.ts src/lib/pos-cart-behaviour/shapes.ts src/lib/pos-cart-behaviour/operations.ts src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts src/components/pos-home.tsx src/components/mobile-cart-sheet.tsx src/components/tablet-cart-sidebar.tsx scripts/run-integration-tests.sh plans/README.md`
> Plans 007, 009, and 010 are expected to change several listed paths. Proceed
> only after 007 and 009 are `DONE`, then reconcile all symbols with live code.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/007-add-database-lifecycle-reporting-tests.md`, `plans/009-create-server-owned-order-snapshots.md`
- **Category**: bug
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The order transaction commits before analytics/cache refresh, and the POS
clears only after a separate inventory refresh. A transport or refresh failure
can therefore retain the cart and let a retry create a second order and deduct
stock twice.

This plan gives each unchanged POS submission one stable identity, enforces it
with a unique database key and normalized request fingerprint, and returns the
committed order on retry without repeating item, stock, or audit effects.

## Required behavior

1. `POSHome` owns one `{ clientFingerprint, submissionId }` ref. It uses browser
   `crypto.randomUUID()` and reuses the ID while normalized minimal cart lines,
   quantities, sanitized customer name, and normalized delivery cost are
   unchanged. Input change rotates it on the next save; acknowledgement or
   explicit cart clear resets it.
2. The server validates `submissionId` as a UUID. The client fingerprint is
   retry bookkeeping, not a security boundary.
3. The server serializes an explicit deterministic structure containing the
   sanitized customer, two-decimal delivery cost, and Plan 009's validated
   minimal request lines. Sort lines by the complete stable ID/quantity tuple,
   then store the SHA-256 hex digest as `requestFingerprint`.
4. A unique `submissionId` claim wins once. The same ID plus same fingerprint
   returns the committed order with `replayed: true` before any side effects. A
   different fingerprint returns a specific safe error.
5. Creation returns `{ orderId, replayed, refreshWarning }`. Transaction commit
   determines success. Post-commit refresh failure is logged and returned as a
   warning rather than converting a sale into failure.
6. The POS clears immediately after durable acknowledgement. Inventory refresh
   happens afterward; refresh failure produces a warning toast.

## Commands

| Purpose | Command | Expected on success |
|---|---|---|
| Focused unit | `pnpm exec vitest run src/lib/order-lifecycle.test.ts src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts src/lib/validation.test.ts` | focused tests pass |
| Integration | `TEST_DATABASE_URL='<operator-supplied-loopback-url>' pnpm test:integration` | lifecycle/idempotency tests pass; DB dropped |
| Schema proof | `DATABASE_URL='<operator-supplied-empty-loopback-url>' pnpm exec drizzle-kit push --force` | final schema applies to verified-empty disposable DB |
| Gate | `pnpm check && git diff --check` | canonical checks and patch hygiene pass |

Never print or commit database URLs. Parse and verify the schema-proof URL as
loopback, non-system, parameter-safe, and empty before using `--force`.

## Scope

**In scope:**

- `src/db/schema.ts`
- `src/lib/validation.ts`
- `src/lib/validation.test.ts`
- `src/lib/order-lifecycle.ts`
- `src/lib/order-lifecycle.test.ts`
- `src/lib/order-lifecycle.integration.test.ts`
- `src/lib/admin-reporting/admin-reporting.integration.test.ts` (identity fixture adaptation only)
- `src/lib/daily-inventory.integration.test.ts` (identity fixture adaptation only)
- `src/app/manager/orders/actions.ts`
- `src/app/manager/orders/actions.test.ts`
- `src/lib/pos-cart-behaviour/shapes.ts`
- `src/lib/pos-cart-behaviour/operations.ts`
- `src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts`
- `src/components/pos-home.tsx`
- `src/components/mobile-cart-sheet.tsx`
- `src/components/tablet-cart-sidebar.tsx`
- `plans/README.md` (only Plan 011's status row)

**Read-only references:**

- `src/lib/types.ts` — Plan 009's minimal request type
- `src/lib/sanitize.ts` — canonical customer-name normalization
- `scripts/run-integration-tests.sh` — guarded push-based disposable harness

**Out of scope:**

- Plan 008, versioned migrations, generated SQL/metadata, or a migration runbook
- Analytics/cache redesign (Plan 013)
- Cancellation, inventory-edit concurrency, reports, invoices, or UI redesign
- Client-authored metadata removed by Plan 009
- Generic idempotency frameworks, persistent browser storage, offline queues,
  service workers, or cross-device retries
- Dependency upgrades or automatic production mutation

## Git workflow

- Branch: `feat/011-order-idempotency`
- Suggested commits:
  1. `feat(db): add order submission identity`
  2. `feat(orders): make order creation idempotent`
  3. `fix(pos): acknowledge committed orders before refresh`
- Do not push or open a pull request unless instructed.

## Steps

### Step 1: Confirm dependencies and baseline

Confirm Plans 007 and 009 are `DONE`, Plan 009 provides its minimal request and
server-owned resolution contract, and the disposable integration runner uses
`drizzle-kit push` rather than migration replay.

```bash
rg -q '007.*DONE' plans/README.md
rg -q '009.*DONE' plans/README.md
rg -n 'OrderRequestLine|ResolvedOrderLine|resolveOrderLines|computeResolvedOrderTotal' src/lib/order-lifecycle.ts src/lib/types.ts src/lib/pos-cart-behaviour
rg -n 'drizzle-kit push' scripts/run-integration-tests.sh
! rg -n 'db:migrate|drizzle/000' scripts/run-integration-tests.sh
pnpm check
TEST_DATABASE_URL='<operator-supplied-loopback-url>' pnpm test:integration
```

### Step 2: Add submission identity and prove the final schema

Add non-null `submissionId` and `requestFingerprint` columns to `ordersTable`
and a unique index on `submissionId`. Neither column gets a default. Exclude
both internal fields from public order details/list payloads.

Do not run `drizzle-kit generate` and do not add anything under `drizzle/`.
Apply the final schema only to a verified-empty disposable loopback database
using the schema-proof command. Assert both columns are non-nullable and the
unique index exists. Run `git status --short -- drizzle/` and require no output.

This fresh-schema proof does not prove the populated production transition and
does not authorize it; that is the operator checkpoint below.

### Step 3: Validate and fingerprint the normalized request

Add `submissionId: z.string().uuid()` to the create-order schema and carry it
through the action and lifecycle input. Implement a pure
`fingerprintOrderRequest(...)` that serializes explicit primitives only:

- sanitized customer name;
- normalized two-decimal delivery cost; and
- sorted `{ baseDessertId, comboId: comboId ?? null, quantity }` lines.

Return `createHash("sha256").update(JSON.stringify(value)).digest("hex")`.
Do not hash submission ID, rich client data, resolved catalog data, class
instances, or object insertion order.

Tests cover UUID rejection, line-order independence, equivalent normalization,
and sensitivity to every semantic field.

### Step 4: Claim or replay inside the transaction

Calculate the request fingerprint before catalog resolution. Attempt to insert
the order identity once. On unique conflict, query the winner by submission ID
inside the transaction:

- matching fingerprint: return its order with `replayed: true` immediately;
- different fingerprint: return a private conflict outcome mapped to a stable,
  safe public error;
- no visible winner: STOP; do not add sleep/retry loops without understanding
  the transaction semantics.

Only the winning path resolves the catalog, inserts items/modifiers, changes
inventory, and writes audits. Return a typed internal result containing the
order and replay flag.

Post-commit refresh runs for both a new order and a replay. Catch and log its
failure, setting `refreshWarning: true`; never convert the committed sale into
an action rejection.

### Step 5: Prove lifecycle idempotency in PostgreSQL

Integration tests, coordinated with deferred promises rather than sleeps, must
cover:

- two concurrent identical submissions: same order ID, one new/one replay;
- exactly one order/item/modifier, stock deduction, and audit effect;
- same ID with a different normalized request: safe failure, no mutation;
- same ID and same request after catalog mutation: original order replayed
  without fresh catalog resolution;
- lost-response retry after committed transaction;
- refresh failure: acknowledged sale with warning, then clean replay; and
- public readers never expose identity/fingerprint fields.

Keep all Plan 007, Plan 009, and Plan 010 integration tests green. Run the full
integration suite twice consecutively to expose cleanup or race flakiness.

### Step 6: Thread identity through the POS

Update action/adapter result types to return
`{ orderId, replayed, refreshWarning }`. `POSHome` owns retry identity and derives
its client fingerprint from the same normalized semantic inputs. The stable ID
is obtained immediately before save so both responsive cart surfaces share it.

Tests prove unchanged retries reuse the ID, changed input rotates it, explicit
clear resets it, successful acknowledgement resets it, and adapter errors do
not reset it.

### Step 7: Clear after acknowledgement, refresh afterward

For mobile and tablet flows:

1. await the durable save acknowledgement;
2. show ordinary success or “Order already saved” for a replay;
3. clear cart/form immediately, resetting identity;
4. close the mobile sheet as appropriate;
5. attempt inventory refresh; and
6. show refresh failure only as a warning.

Ensure the tablet explicit-clear control uses the identity-resetting callback.
Neither surface may show a failed-sale toast after durable acknowledgement.

### Step 8: Run the complete gate and commit

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format
pnpm exec vitest run src/lib/order-lifecycle.test.ts src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts src/lib/validation.test.ts
TEST_DATABASE_URL='<operator-supplied-loopback-url>' pnpm test:integration
TEST_DATABASE_URL='<operator-supplied-loopback-url>' pnpm test:integration
pnpm check
git diff --check
git status --short
```

Expected: all gates pass; lockfile is unchanged; no migration artifacts exist;
only Scope files changed. Stage only each commit's files and run
`git diff --cached --check` plus `git diff --cached --name-only` before each
Conventional Commit. Mark Plan 011 `DONE` only after all gates pass.

## Production rollout checkpoint (operator-owned)

The final schema adds non-null identity columns to existing orders, so it is not
safe for an unattended or mixed-version push. Repository execution stops at
source changes and disposable-database proof.

An operator must own the backup/change record and pause order writes. During
the pause, inspect the live diff; stage nullable columns if required; backfill
each legacy order deterministically with an operator-reviewed reserved value
such as `legacy-order:<id>` for both fields; verify no nulls/duplicates; then
apply the final checked-in schema with `drizzle-kit push`, deploy the matching
application, and smoke-test one new order plus an immediate same-ID replay
before resuming writes. The server continues accepting UUID submission IDs
only, so the legacy namespace cannot collide with new requests.

Commands and credentials belong in the operator change record, not the repo.
If verification fails before writes resume, keep the pause and execute the
reviewed rollback. After a new-version order is accepted, do not remove the
identity columns or redeploy the old writer; fix forward or deploy a reviewed
compatibility build.

## Done criteria

- [ ] New submissions use validated UUIDs; order identity and fingerprint are
      unique/non-null as required by the final schema.
- [ ] Fingerprints use Plan 009's normalized minimal request, not rich or mutable
      catalog data.
- [ ] Concurrent identical calls produce one durable set of side effects and
      replay one order ID.
- [ ] Different-request ID reuse fails without mutation; same-request replay
      survives catalog mutation.
- [ ] Action returns order ID, replay status, and refresh warning.
- [ ] Public order payloads expose neither internal field.
- [ ] POS identity reuse/rotation/reset and clear-before-refresh are tested.
- [ ] Refresh failure is a post-sale warning, never a failed sale.
- [ ] Final schema push succeeds on a guarded empty disposable database; no
      migration artifacts are created.
- [ ] Focused tests, two integration runs, lint, format, canonical check, and
      patch hygiene pass.
- [ ] Production rollout remains operator-owned with write pause, deterministic
      legacy backfill, verification, smoke test, and rollback/fix-forward record.
- [ ] Only scoped files changed and Plan 011 is `DONE`.

## STOP conditions

Stop and report if:

- Plan 007 or Plan 009 is incomplete, or the guarded push-based integration
  harness is failing.
- Plan 009 still trusts client display, price, modifier, or stock metadata.
- A database target is non-loopback/non-empty for repository verification, or a
  production push is requested without explicit operator ownership.
- Drizzle proposes unrelated/destructive schema changes.
- Existing orders cannot be backfilled deterministically without deleting or
  fabricating business data.
- Production cannot pause writes across backfill, push, deploy, and smoke test.
- The unique-conflict path cannot observe the winner under PostgreSQL
  `READ COMMITTED`, or tests require sleeps/retries to pass.
- Fingerprinting requires unstable serialization or mutable catalog state.
- Durable success cannot be separated from post-commit refresh failure without
  redesigning analytics; Plan 013 owns that redesign.
- Public APIs expose internal identity fields.
- Implementation needs persistent storage, a generic framework, new
  dependencies, or out-of-scope files.
- Any verification fails twice after one focused correction.

## Maintenance notes

- Never change the stored fingerprint algorithm in place; version future input
  semantics or preserve compatibility for existing submission IDs.
- Plan 013 may move refresh work off the response path but must preserve this
  durable acknowledgement/replay contract.
- Client IDs intentionally survive only retries within the mounted POS.
- Review the unique-conflict transaction branch, explicit serialization,
  production backfill boundary, and clear-before-refresh UI most closely.
