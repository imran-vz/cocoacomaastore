# Order columns database cutover

This runbook covers the one-time transition that adds and backfills:

- `orders.submissionId`
- `orders.requestFingerprint`
- `order_items.baseDessertName`
- `order_items.inventoryDeducted`
- `order_item_modifiers.dessertName`

The checked-in Drizzle schema already describes the final state. The generated `drizzle/0000_sweet_jackal.sql` is a full-schema baseline for fresh databases and must never be applied to an existing database.

## Safety model

The supported command is:

```sh
pnpm db:cutover:order-columns <inspect|apply|verify>
```

It uses only `ORDER_COLUMNS_DATABASE_URL`; it does not fall back to `DATABASE_URL`, `.env`, or ambient `PGHOST`/`PGPORT` targeting. The URL must explicitly include a hostname, username, database, and direct port. Do not use a transaction pooler on port `6543`.

`apply` runs one transaction. It takes an advisory lock, takes `ACCESS EXCLUSIVE` locks on the three order tables, and takes `SHARE` locks on the catalog and audit sources. Those locks are held through preflight revalidation, backfill, constraints, index creation, postflight verification, and commit; ordinary reads of the three order tables therefore wait for the full apply transaction. The clone rehearsal must measure this lock window. For the current data volume, the atomic consistency boundary is safer than exposing an intermediate nullable schema.

The command never deletes rows, invents labels for orphaned records, uses current unlimited-stock settings as historical evidence, or applies the Drizzle baseline. Any unresolved orphan, identity collision, malformed/duplicate deduction audit, or contradictory partial backfill is a stop condition.

## Backfill rules

- Legacy submission IDs and request fingerprints use `legacy-order:<order id>`. Current public submissions accept UUIDs only, so clients cannot claim the reserved legacy namespace.
- Base and modifier names use the currently referenced `desserts.name`. This preserves the label visible at cutover; it cannot prove the original order-time label after historical catalog edits.
- `inventoryDeducted` is `true` only when one valid positive `order_deducted` audit exists for the same order and dessert on the order's IST operating day. Every item row sharing that pair receives the same value. Already-cancelled orders remain `true` when their original deduction audit exists.
- Existing non-null values from a partial rollout are preserved only when they form a complete valid pair/state. An incomplete identity pair, unexpected constraint/index, or populated inventory value that contradicts audit evidence aborts the transaction.

## Rehearse on a local clone

Do not use `cocoacomaa_test`: `pnpm test:integration` destroys and recreates that database.

1. Create a dedicated local database, such as `cocoacomaa_order_cutover_rehearsal`.
2. Clone the shared database into it with an explicit loopback target:

   ```sh
   LOCAL_DATABASE_URL='postgresql://postgres:password@localhost:5432/cocoacomaa_order_cutover_rehearsal' \
   pnpm db:clone:supabase
   ```

3. Point the cutover command only at that clone and inspect it:

   ```sh
   ORDER_COLUMNS_DATABASE_URL='postgresql://postgres:password@localhost:5432/cocoacomaa_order_cutover_rehearsal' \
   pnpm db:cutover:order-columns inspect
   ```

4. Resolve every reported blocker. Record the target, row counts, phase, and confirmation token.
5. Apply using the token from the immediately preceding inspection:

   ```sh
   ORDER_COLUMNS_DATABASE_URL='postgresql://postgres:password@localhost:5432/cocoacomaa_order_cutover_rehearsal' \
   ORDER_COLUMNS_CONFIRMATION_TOKEN='<token from inspect>' \
   COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT='BACKUP_VERIFIED_WRITES_PAUSED' \
   pnpm db:cutover:order-columns apply
   ```

6. Verify the committed state:

   ```sh
   ORDER_COLUMNS_DATABASE_URL='postgresql://postgres:password@localhost:5432/cocoacomaa_order_cutover_rehearsal' \
   pnpm db:cutover:order-columns verify
   ```

7. Confirm that pre-existing row counts and business data are unchanged and that the only intended schema additions are the five columns and `orders_submission_id_unique`.
8. Run the application against the clone and exercise:
   - a historical order and receipt;
   - one new UUID submission and an immediate same-ID replay;
   - finite-stock order cancellation and exact restoration;
   - unlimited-stock order cancellation without deduction evidence.
9. Inspect again and apply with the new token to prove the final state is a no-op.
10. Restore the clone and rehearse a partial rollout. Populate selected exact columns with sentinel values and confirm they are preserved. Separately introduce a submission collision or contradictory inventory flag and confirm `apply` rolls back without changing the database.

Record timings, lock duration, updated-row counts, and verification output in the operator change record, not in committed files.

## Production procedure

### Preconditions

- An operator owns the change window and exact target.
- A current backup exists and restoration has been verified.
- All order creation, cancellation, catalog mutation, and inventory-audit writers can be paused and drained.
- The clone rehearsal completed successfully against representative data.
- The application build that writes all five final columns is ready to deploy.

### Cutover

1. Pause every affected writer and drain in-flight transactions.
2. Take or refresh the approved backup and verify its restoration procedure.
3. Set `ORDER_COLUMNS_DATABASE_URL` to the exact direct production connection.
4. Run `inspect` after the pause. Confirm the displayed database identity and counts against the change record.
5. If preflight is ready, run `apply` with that inspection's token and the exact acknowledgement. A changed token, lock timeout, or blocker means stop and investigate; do not increase timeouts or rerun blindly.
6. Run `verify`. If the network failed near commit and the result is unknown, `verify` is the first action.
7. Run a strict Drizzle parity check against the same exact target by binding its separate configuration variable explicitly:

   ```sh
   DATABASE_URL="$ORDER_COLUMNS_DATABASE_URL" pnpm exec drizzle-kit push --strict
   ```

   Strict mode must show no change for these fields/index and no unrelated or destructive change. Do not confirm the prompt if any change is proposed; investigate the drift separately.
8. Deploy the matching application before resuming writes.
9. Smoke-test a historical read, new order, same-ID replay, finite-stock cancellation, and—where available—an unlimited-stock order.
10. Resume writers only after every check passes.

The old application must not resume writing after the cutover because its inserts omit the new required columns.

## Failure boundaries

- Before commit: the transaction rolls back. Keep writes paused, resolve the reported issue, run `inspect` again, and use the new token.
- Unknown commit result: run `verify`; never assume that a disconnected command rolled back.
- Cutover committed but deployment failed before any new-version write: keep writes paused. Prefer fixing the deployment. A rollback requires separate review and should retain the columns, data, and index while temporarily relaxing only the required constraints.
- After any new-version order is accepted: do not drop the columns or redeploy the old writer. Fix forward or deploy a reviewed compatibility build.

Credentials and production command output belong only in the operator change record. The command intentionally redacts raw connection and database errors.
