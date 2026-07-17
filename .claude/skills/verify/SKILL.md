---
name: verify
summary: Drive the guarded database cutover CLI against disposable Docker PostgreSQL.
---

# Verify runtime changes

For database cutover changes, verify through the package CLI against an ephemeral PostgreSQL container. Never use a shared `DATABASE_URL`.

1. Start `postgres:17.6` with a random loopback port, `POSTGRES_PASSWORD=password`, and `POSTGRES_DB=cocoacomaa_test`; always trap `docker rm -f`.
2. Build the current schema with:

   ```sh
   TEST_DATABASE_URL="$url" pnpm exec drizzle-kit push --config drizzle.integration.config.ts --force
   ```

3. Use `docker exec -i <container> psql ...` to remove the five cutover columns and seed a small legacy order, two finite-stock item rows sharing one audit pair, one unlimited item, and one modifier.
4. Drive the surface:
   - `ORDER_COLUMNS_DATABASE_URL="$url" pnpm db:cutover:order-columns inspect`
   - extract its confirmation token;
   - run `apply` with the token and `BACKUP_VERIFIED_WRITES_PAUSED` acknowledgement;
   - run `verify`;
   - query the migrated rows with `psql` and capture JSON evidence.
5. Probe stale-token rejection by changing a source row after inspection. Probe partial-state rejection by making exactly one identity field null and confirming `inspect` reports a blocker.
6. Also run the CLI without a mode, without its dedicated URL, and with port `6543` to capture guard behavior.

Do not substitute unit tests or typecheck for this runtime observation. Keep the Docker URL local and explicit: username, host, direct port, and database name.
