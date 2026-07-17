# Plan 015: Align POS and server order limits with database capacity

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 848e31d..HEAD -- src/lib/order-limits.ts src/lib/validation.ts src/lib/validation.test.ts src/lib/pos-cart-behaviour/operations.ts src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts src/components/cart-line-presenter.tsx src/components/mobile-cart-sheet.tsx src/components/tablet-cart-sidebar.tsx src/hooks/use-long-press.ts plans/README.md`
> Plan 009 is expected to have replaced rich cart-line request validation with
> the minimal `{ baseDessertId, comboId?, quantity }` DTO and changed its tests.
> Plan 006 is expected to have made `pnpm check` green. Compare those expected
> changes with the excerpts below; any other semantic mismatch is a STOP
> condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/006-establish-green-quality-gate.md`, `plans/009-create-server-owned-order-snapshots.md`
- **Category**: bug
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The POS allows a cart line to reach 199 while the server rejects quantities
above 99. Delivery validation accepts up to ₹10,000 while PostgreSQL
`numeric(5,2)` can store at most ₹999.99. Both mismatches let the UI construct
an order that is rejected only during save, and the delivery mismatch can reach
a database overflow despite passing application validation.

Use the narrowest existing contract: maximum line quantity 99 and maximum
delivery cost ₹999.99. These values already match the server/badge convention
and current database capacity, so this plan needs no migration or product
expansion.

## Current state

- After Plan 009, `src/lib/validation.ts` must strictly validate a minimal
  request line containing IDs and quantity. At the planned commit, the rich
  line's quantity rule already showed the canonical server limit:

  ```ts
  // src/lib/validation.ts:14-25 at 848e31d
  const cartLineSchema = z.object({
	// rich fields removed by Plan 009
	quantity: z.number().int().min(1).max(99),
  });
  ```

  Plan 009 explicitly preserves `.min(1).max(99)` on its new strict minimal
  line schema. Do not reintroduce any removed client-authored names/prices.
- Delivery validation currently exceeds the persistence boundary:

  ```ts
  // src/lib/validation.ts:35-41
  deliveryCost: z
	.string()
	.regex(/^\d+(\.\d{1,2})?$/, "Invalid delivery cost format")
	.refine((val) => {
		const num = Number.parseFloat(val);
		return num >= 0 && num <= 10000;
	}, "Delivery cost must be between 0 and 10000"),
  ```

- `src/db/schema.ts:106-113` is authoritative persistence evidence:

  ```ts
  export const ordersTable = pgTable("orders", {
	// ...
	deliveryCost: numeric({ precision: 5, scale: 2 }).notNull().default("0.00"),
	total: numeric({ precision: 10, scale: 2 }).notNull(),
  });
  ```

  PostgreSQL `numeric(5,2)` permits three integer digits and two fractional
  digits, so its maximum positive value is `999.99`. Do not change the column.
- `src/lib/pos-cart-behaviour/operations.ts:15,42-47,135-165` uses a conflicting
  client limit:

  ```ts
  const MAX_CART_LINE_QUANTITY = 199;

  function incrementExistingLine(cart: CartLine[], cartLineId: string): CartLine[] {
	return cart.map((line) =>
		line.cartLineId === cartLineId && line.quantity < MAX_CART_LINE_QUANTITY
			? { ...line, quantity: line.quantity + 1 }
			: line,
	);
  }

  if (quantity > MAX_CART_LINE_QUANTITY)
	return { ok: false, cart, error: "Quantity cannot be greater than 199" };
  ```

  At exactly 199, repeated Add calls with stock still available silently
  resolve successfully without changing the line because the increment helper
  has no failure result.
- `src/components/cart-line-presenter.tsx:65-71,132-142` increments on a short
  tap or every 100 ms during long press and does not disable/stop at a client
  limit. `src/hooks/use-long-press.ts` invokes the presenter's `onCancel` for a
  short tap and `onFinish` after a long press; both the short-tap path and the
  interval therefore need local guards. Do not change the shared hook.
- Both delivery inputs expose only `min` and `step`, not the database maximum:

  ```tsx
  // src/components/mobile-cart-sheet.tsx:320-329
  <Input type="number" step="0.01" min="0" value={field.state.value} ... />

  // src/components/tablet-cart-sidebar.tsx:229-238
  <Input type="number" step="0.01" min="0" value={field.state.value} ... />
  ```

- `src/components/mobile-cart-sheet.tsx:224,264` and
  `src/components/tablet-cart-sidebar.tsx:171` already cap aggregate item-count
  badges at 99/`99+`. This plan aligns each line's editable limit with 99; it
  does not cap total order items across different lines.
- `src/components/form-schema/cart.ts:3-6` validates delivery cost only as a
  string. The save buttons do not consume `form.state.canSubmit`, so expanding
  that form schema alone would not enforce the boundary. Use the HTML input
  attribute for client guidance and keep server validation authoritative.
- `src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts:42-102` is the focused
  pure test file for cart mutation/save behavior. Plan 009's
  `src/lib/validation.test.ts` is the focused request-schema test file.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0; lockfile unchanged |
| Focused tests | `pnpm exec vitest run src/lib/validation.test.ts src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts` | exit 0; all boundary and existing tests pass |
| Quality gate | `pnpm check` | exit 0 |
| Build | `pnpm build` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0, no diagnostics |
| Patch hygiene | `git diff --check` | exit 0 |

No dependency, schema, migration, or database command is needed.

## Scope

**In scope** (the only files you should modify):

- `src/lib/order-limits.ts` (create)
- `src/lib/validation.ts`
- `src/lib/validation.test.ts`
- `src/lib/pos-cart-behaviour/operations.ts`
- `src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts`
- `src/components/cart-line-presenter.tsx`
- `src/components/mobile-cart-sheet.tsx`
- `src/components/tablet-cart-sidebar.tsx`
- `plans/README.md` — update only Plan 015's status row at completion

**Out of scope** (do NOT touch):

- `src/db/schema.ts`, migrations, delivery column precision/scale, order total
  precision, or existing data.
- Plan 009's minimal request shape, server-owned price/catalog resolution,
  snapshots, cancellation logic, or schema artifacts.
- Per-combo modifier quantity limits, inventory quantities, order line-count
  limit, aggregate cart item count, product prices, or any unrelated numeric
  boundary that happens to use 99/10,000.
- A larger delivery requirement, new currency/money library, integer-cents
  rewrite, input redesign, or form framework refactor.
- Changing delivery rounding/formatting, totals, UPI/copy output, save error
  handling, or order persistence behavior beyond rejecting out-of-range input
  before PostgreSQL.
- DOM testing dependencies or broad component test infrastructure for two
  static input attributes/button states.
- `src/hooks/use-long-press.ts`; its current short-tap/long-press callback
  semantics are a read-only contract for the local presenter guards.

## Git workflow

- Branch: `feat/015-align-order-validation-boundaries`
- Suggested commits:
  1. `fix(orders): align quantity and delivery limits`
  2. `test(orders): cover order validation boundaries`
- Use Conventional Commits without co-author trailers. Do not push or open a PR
  unless instructed. Stage no unrelated plan files or user changes.

## Steps

### Step 1: Confirm prerequisites and exact persistence capacity

Run the drift check. Confirm Plans 006 and 009 are `DONE`, the strict minimal
Plan 009 line schema still uses quantity 1–99, and the order delivery column is
still `numeric(5,2)`. Create/switch to the branch and run the frozen baseline.

**Verify**:

- `rg -n '^\| 006 .* DONE|^\| 009 .* DONE' plans/README.md` → both rows are found.
- `rg -n 'quantity: z\.number\(\)\.int\(\)\.min\(1\)\.max\(99\)' src/lib/validation.ts` → the minimal order-line rule is found.
- `rg -n 'deliveryCost: numeric\(\{ precision: 5, scale: 2 \}\)' src/db/schema.ts` → exactly one match.
- `pnpm install --frozen-lockfile && pnpm check` → exit 0; lockfile unchanged.

### Step 2: Add only the two genuinely shared order limits

Create `src/lib/order-limits.ts` with exactly these named exports:

```ts
export const MAX_ORDER_LINE_QUANTITY = 99;
export const MAX_DELIVERY_COST = 999.99;
```

Do not add a configuration object, class, currency abstraction, environment
variable, or constants for unrelated 99-valued fields. These two constants are
shared because each crosses an actual server/client boundary.

In Plan 009's strict minimal line schema, replace only the literal `.max(99)`
with `.max(MAX_ORDER_LINE_QUANTITY)`. In delivery refinement, replace 10,000
with `MAX_DELIVERY_COST` and make the stable user-facing message say
`Delivery cost must be between 0 and 999.99`. Preserve the existing decimal
format regex, string request type, lower bound, and Plan 009 `.strict()` calls.

**Verify**:

- `rg -n 'MAX_ORDER_LINE_QUANTITY|MAX_DELIVERY_COST' src/lib/order-limits.ts src/lib/validation.ts` → both constants are defined and used by server validation.
- `rg -n -A 10 'deliveryCost: z' src/lib/validation.ts | rg -n '10000|between 0 and 10000'` → no matches, exit 1; the unrelated inventory maximum outside this block remains untouched.
- `pnpm typecheck` → exit 0.

### Step 3: Align cart mutation behavior at 99

In `src/lib/pos-cart-behaviour/operations.ts`, remove the local 199 constant
and import `MAX_ORDER_LINE_QUANTITY`. Use one derived stable error message:

```ts
const QUANTITY_LIMIT_MESSAGE =
	`Quantity cannot be greater than ${MAX_ORDER_LINE_QUANTITY}`;
```

Apply the limit consistently:

1. For an existing direct-dessert or combo line, return `{ ok: false, cart,
   error: QUANTITY_LIMIT_MESSAGE }` when its quantity is already 99 instead of
   silently returning success with an unchanged cart. Find/check the matching
   line before the existing remaining-stock failure so the stable order-limit
   error wins when a finite-stock line is simultaneously at quantity and stock
   99; do not otherwise change stock calculations or errors.
2. In `updateCartLineQuantity`, after preserving `quantity <= 0` removal and
   the missing-line no-op, reject a requested quantity above 99 before applying
   the stock-availability clamp. Keep all valid 1-99 inventory-cap behavior
   unchanged.
3. Keep the increment helper simple: it may increment only after the caller has
   passed the explicit limit check. Delete every 199 literal/message.

Do not cap the sum across lines. Do not change how stock availability is
calculated or how a valid 1–99 quantity is serialized by Plan 009.

**Verify**:

- `rg -n '199|MAX_CART_LINE_QUANTITY' src/lib/pos-cart-behaviour` → no matches, exit 1.
- `rg -n 'MAX_ORDER_LINE_QUANTITY|QUANTITY_LIMIT_MESSAGE' src/lib/pos-cart-behaviour/operations.ts` → shared limit and stable error are found.
- Focused tests command → existing tests pass before new cases are added.

### Step 4: Keep POS controls inside the same limits

In `src/components/cart-line-presenter.tsx`, import
`MAX_ORDER_LINE_QUANTITY`. Disable the Plus button when the line is already 99
and add a disabled style plus an `aria-label` without changing layout. Guard
both increment paths with the same constant:

1. In `createQuantityHandler`, the `onCancel` callback is the short-tap path.
   If its proposed increment would exceed 99, do not update `quantityRef` and
   do not call `updateQuantity`. This guard is required even with `disabled`
   because a second tap can arrive before React commits the 99 render. Since
   this handler also serves decrement, make the condition explicitly
   `delta > 0 && newQty > MAX_ORDER_LINE_QUANTITY`; do not block decrement.
2. In the long-press interval, when the next quantity would exceed 99, clear
   the interval and do not update `quantityRef` or call `updateQuantity`.

Keep decrement/removal behavior unchanged. Do not add client-side clamping;
server validation remains the final authority.

In both delivery inputs, add `max={MAX_DELIVERY_COST}` beside the existing
`min="0"` and `step="0.01"`. Import the same constant; do not duplicate the
`999.99` literal or clamp/mutate the user's text. HTML attributes are guidance;
the server remains authoritative for manually crafted requests.

Do not change `cartFormSchema`: its state is not currently used to gate either
save button, and a form-wide validation redesign would exceed this bug fix.

**Verify**:

- `rg -n 'max=\{MAX_DELIVERY_COST\}' src/components/mobile-cart-sheet.tsx src/components/tablet-cart-sidebar.tsx` → exactly two matches.
- `rg -n 'delta > 0 && newQty > MAX_ORDER_LINE_QUANTITY|nextQty > MAX_ORDER_LINE_QUANTITY|disabled=|aria-label=' src/components/cart-line-presenter.tsx` → both increment guards, the native disabled state, and the accessible label are found; inspect that neither over-limit branch mutates the ref or calls `updateQuantity`.
- `pnpm lint && pnpm typecheck` → exit 0.

### Step 5: Add focused boundary and over-limit tests

Extend Plan 009's `src/lib/validation.test.ts` using its existing minimal valid
request fixture. Add exactly three cases:

1. quantity 99 with delivery cost `"999.99"` parses successfully;
2. quantity 100 is rejected;
3. delivery cost `"1000.00"` is rejected with the new stable delivery message.

Extend `src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts` with exactly two
cases using controlled stock inputs:

1. `updateCartLineQuantity` accepts 99, then rejects 100 with the 99-limit
   message and leaves the prior cart unchanged;
2. adding the same dessert/combo at an existing quantity 99 returns a failed
   mutation with the same message and does not increment. A table-driven direct
   and combo assertion may live in this single test; cover both high remaining
   stock and finite stock exactly equal to 99 so the intended error precedence
   cannot regress.

Do not add snapshots or component/DOM tests. The pure mutation tests plus
static attribute checks cover this small boundary change.

**Verify**:

- `pnpm exec vitest run src/lib/validation.test.ts` → the three new boundary cases and all Plan 009 validation cases pass.
- `pnpm exec vitest run src/lib/pos-cart-behaviour/pos-cart-behaviour.test.ts` → the two new cart-limit cases and all existing cases pass.
- Focused tests command from the Commands table → exit 0.

### Step 6: Run final gates and commit

Run the full repository gate and production build. Review the diff; update only
Plan 015's index status to `DONE`, then make the suggested Conventional Commits.

**Verify**:

- `pnpm check && pnpm build` → exit 0.
- `pnpm install --frozen-lockfile` → exit 0; no lockfile diff.
- `git diff --exit-code -- src/db/schema.ts drizzle.config.ts drizzle/ pnpm-lock.yaml` → exit 0; no schema, migration, config, or dependency change.
- `rg -n '199|num <= 10000|between 0 and 10000' src/lib/validation.ts src/lib/pos-cart-behaviour src/components/mobile-cart-sheet.tsx src/components/tablet-cart-sidebar.tsx` → no obsolete order-limit match, exit 1.
- `git diff --check` → exit 0.
- `git status --short` → only in-scope files plus pre-existing untracked plans.

## Test plan

- Server schema tests prove exact acceptance at quantity 99/₹999.99 and
  rejection immediately above both boundaries.
- Pure POS mutation tests prove quantity 99 is reachable, quantity 100 is not,
  and repeated Add at the maximum returns a visible failure rather than silent
  success.
- Scoped source checks prove both delivery inputs use the shared maximum and no
  order-path 199/10,000 literal remains.
- `pnpm check` and `pnpm build` cover Plan 009's request adapter and all client
  component imports without adding a DOM test dependency.

## Rollout and rollback boundary

- Deploy the shared constants, server validation, cart mutations, and POS
  controls as one application change, with the new server validation active no
  later than the new client. An old client reaching the new server is safe
  because the server rejects over-limit input. Do not treat a new client's HTML
  delivery `max` as protection while an old server is still serving actions:
  the custom save flow does not enforce native form validity, so that direction
  retains the pre-existing database-overflow risk until the new server is live.
- No database or data rollback is required. To back out before release, revert
  the Plan 015 source/tests/index change together. After release, rollback
  reopens the known delivery-overflow and silent quantity-limit bugs, so prefer
  a forward fix unless the new 99/999.99 product contract itself is wrong.
- Do not remove only `order-limits.ts` or revert only one consumer: that creates
  broken imports or restores a client/server mismatch. Orders rejected by this
  change never reach persistence and need no repair.

## Done criteria

- [ ] `MAX_ORDER_LINE_QUANTITY` is 99 and is used by both strict server request validation and POS cart mutation/control code.
- [ ] `MAX_DELIVERY_COST` is 999.99 and is used by server validation plus both POS delivery input `max` attributes.
- [ ] Quantity 99 and delivery ₹999.99 are accepted; 100 and ₹1,000.00 are rejected in focused tests.
- [ ] An existing line at 99 cannot be incremented by Add or direct cart
      mutation; the Plus button is disabled and both its short-tap and
      long-press paths refuse to dispatch quantity 100.
- [ ] Plan 009's strict minimal request DTO and server-owned order semantics remain unchanged.
- [ ] No order-path 199/10,000 literal or contradictory error message remains.
- [ ] No database schema, migration, dependency, lockfile, or unrelated numeric boundary changed.
- [ ] `pnpm check`, focused tests, `pnpm build`, and `git diff --check` all pass.
- [ ] Plan 015 is `DONE` in `plans/README.md`, unless the dispatcher owns the index.

## STOP conditions

Stop and report; do not improvise if:

- Plan 006 or Plan 009 is incomplete/red, or Plan 009's live DTO is not the
  strict `{ baseDessertId, comboId?, quantity }` request described here.
- Product requirements require a line quantity above 99. That needs an explicit
  contract/UI decision rather than weakening the server silently.
- Product requirements require a delivery cost above ₹999.99. The current
  `numeric(5,2)` column cannot represent it; stop for a reviewed schema/migration
  plan instead of rounding, clamping, or increasing validation alone.
- The order delivery column is no longer `numeric(5,2)`, another active order
  intake path uses different limits, or the currency/scale is no longer INR
  with two decimal places.
- Plan 009's minimal request test cannot be extended without reintroducing
  client-owned pricing/catalog fields.
- A valid 1–99 quantity no longer has the current inventory semantics, or
  fixing the maximum requires changing stock calculations/order deduction.
- Enforcing the Plus-button maximum requires changing `useLongPress` globally;
  keep the guard local or stop.
- `useLongPress` no longer routes a short tap through `onCancel` and a completed
  long press through `onFinish` as described above; re-audit the presenter
  interaction rather than guessing at new callback semantics.
- A verification fails twice after one reasonable in-scope correction, or the
  fix requires a file outside the in-scope list.

## Maintenance notes

- `MAX_ORDER_LINE_QUANTITY` is a per-line request limit, not the total quantity
  of an order, an inventory limit, or a combo modifier limit. Do not reuse it
  merely because another field currently uses 99.
- `MAX_DELIVERY_COST` mirrors a persistence constraint. Any future increase
  must change and migrate `orders.deliveryCost` first, then update this constant
  and its exact-boundary tests in the same change.
- HTML `max` and a disabled Plus control improve the POS experience but are not
  security boundaries. Keep strict server validation and tests authoritative.
- Reviewers should scrutinize the Plan 009 DTO preservation, check ordering in
  `updateCartLineQuantity`, both short-tap and long-press increment guards, and
  the absence of schema drift.
