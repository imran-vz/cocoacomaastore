# Plan 008: Establish a safe, versioned database migration workflow

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update only this plan's status row in
> `plans/README.md`, unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- package.json README.md src/db/schema.ts drizzle.config.ts drizzle.integration.config.ts scripts/clone-supabase-db.sh scripts/test-database-url.ts scripts/integration-db-lifecycle.ts scripts/run-drizzle-local.sh scripts/run-integration-tests.sh docs/database-migrations.md drizzle/ plans/README.md`
> If any listed path changed, compare the "Current state" excerpts against the
> live files before proceeding. Changes to `src/db/schema.ts`,
> `drizzle.config.ts`, or the Drizzle dependency versions are a STOP condition
> until this plan is re-reviewed against the new state.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/006-establish-green-quality-gate.md`, `plans/007-add-database-lifecycle-reporting-tests.md`
- **Category**: migration
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The application schema exists only as TypeScript plus an unversioned
`drizzle-kit push` command. There is no tracked migration history, so schema
changes cannot be reviewed, replayed on a fresh database, or deployed safely
to an existing Supabase/PostgreSQL environment. This plan first establishes who
already owns migrations; if this repository is confirmed as the owner, it
records the current schema as a reviewed baseline and adds guarded tooling and
an operator-owned procedure for adopting existing environments without
replaying baseline `CREATE` statements against live tables.

This plan does **not** apply or authorize any production/shared-environment
database mutation.

## Current state

- `drizzle.config.ts` points Drizzle Kit at the application schema and an empty,
  currently untracked output directory:

  ```ts
  // drizzle.config.ts:9-15
  export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: dbURL,
	},
  });
  ```

- `drizzle.config.ts:3-7` requires `DATABASE_URL` even for commands such as
  `generate` and `check`. Use the deliberately local dummy URL shown below for
  commands that do not connect.
- `package.json:9-11` exposes clone, push, and studio only:

  ```json
  "db:clone:supabase": "bash scripts/clone-supabase-db.sh",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
  ```

- `package.json:36,65` currently uses `drizzle-orm ^0.41.0` and
  `drizzle-kit ^0.31.10`. Do not upgrade either package in this plan.
- `src/db/schema.ts` declares 19 PostgreSQL tables. Representative definitions
  include `dessertsTable` at lines 5-29, `ordersTable` at lines 106-126,
  Better Auth tables at lines 244-323, and analytics tables through line 513.
- No migration artifact exists now or historically at the planned commit:

  ```text
  $ git ls-files | rg '(^|/)(drizzle|migrations|supabase)(/|$)'
  # no output
  $ git log --all --name-only --format= -- 'drizzle/**' 'supabase/migrations/**' '**/migrations/**' | sed '/^$/d' | sort -u
  # no output
  ```

- `README.md:26-28` documents only cloning the Supabase `public` schema into a
  local database.
- `scripts/clone-supabase-db.sh:68-85` establishes the repository's loopback
  host policy: only `localhost`, `127.0.0.1`, or `[::1]` is a local target. Its
  regex is not anchored to the parsed URL host, however, so do not copy it into
  new safety tooling; text such as `?next=postgresql://localhost/db` can make a
  remote URL match. Parse the URL and inspect its protocol and hostname.
- `.gitignore` does not ignore `drizzle/`; generated migrations can be tracked.
- Plan 007 creates a guarded disposable PostgreSQL integration runner, but its
  initial bootstrap uses `drizzle-kit push --force` because no migration history
  exists yet. Once this baseline is tracked, this plan owns replacing that
  temporary bootstrap with full migration replay and removing the now-unused
  `drizzle.integration.config.ts`.
- Plan 006 deliberately excludes `pnpm build` until the repository has a
  tracked build-time environment contract. This tooling-only plan does not add
  that contract, so build is not an acceptance gate here.
- Recent commits use imperative subjects. This plan uses Conventional Commits
  as required by the repository task instructions.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0; lockfile unchanged |
| Migration consistency | `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cocoacomaa_generation pnpm db:check` | exit 0 |
| Shell syntax | `bash -n scripts/run-drizzle-local.sh` | exit 0, no output |
| Lint | `pnpm lint` | exit 0; Plan 006 made the baseline green |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Tests | `pnpm test` | all tests pass |
| Integration tests | `TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration` | full tracked history applies, tests pass, disposable DB is dropped |

Required local tools for the database checks are `psql` and `pg_dump`. Use the
same `pg_dump` executable/version for both sides of the schema comparison.

## Scope

**Files the executor may modify:**

- `package.json`
- `scripts/run-drizzle-local.sh` (create)
- `scripts/run-integration-tests.sh`
- `drizzle.integration.config.ts` (delete after the runner no longer uses push)
- `drizzle/0000_baseline.sql` (generate, then review)
- `drizzle/meta/_journal.json` (generate)
- `drizzle/meta/0000_snapshot.json` (generate)
- `README.md`
- `docs/database-migrations.md` (create)
- `plans/README.md` (only Plan 008's final status row)

**Read-only inputs — inspect but do not modify:**

- `src/db/schema.ts`
- `drizzle.config.ts`
- `scripts/clone-supabase-db.sh`
- `scripts/test-database-url.ts`
- `scripts/integration-db-lifecycle.ts`

**Out of scope:**

- Applying migrations or changing the migration ledger in production, preview,
  staging, or any other shared environment
- Writing a SQL script that marks the baseline as applied
- Changing application tables, columns, constraints, indexes, or seed data
- Drizzle/PostgreSQL dependency upgrades
- Supabase RLS policies, functions, triggers, extensions, or objects outside
  what the current schema and baseline represent
- `pnpm-lock.yaml`, application source, and `scripts/clone-supabase-db.sh`

## Git workflow

- Complete Step 1 before creating a branch or editing files.
- After ownership is confirmed, create branch
  `feat/008-establish-versioned-database-migrations`.
- Use one commit: `chore(db): establish versioned migration baseline`.
- Do not push or open a pull request unless the operator explicitly asks.

## Steps

### Step 1: Confirm migration ownership before changing the repository

Run the two history commands from "Current state" and search documentation:

```bash
rg -n "migration|migrate|db:push|Supabase" README.md docs scripts package.json .github 2>/dev/null || true
```

Ask the operator, in writing:

1. Which system is the authoritative migration owner for every existing
   Supabase/PostgreSQL environment: this repository, Supabase CLI files in
   another location, another repository, or a manual DBA process?
2. Which environments already contain the current schema?
3. Who is the named database operator/reviewer responsible for the one-time
   migration-ledger baseline, and what approved change process will they use?

Proceed only if the answer explicitly makes this repository the new canonical
owner, identifies all existing environments, and assigns a named operator. If
another system owns migrations, ownership is unknown, or two systems would be
authoritative, STOP and report without creating the branch.

**Verify**: Save the operator's answer in the task/PR record, not in the repo.
The answer must cover all three questions and contain no credentials.

### Step 2: Add migration commands and make `db:push` local-only

Create the branch, then add these scripts to `package.json` without changing
dependencies:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:check": "drizzle-kit check",
"db:push": "bash scripts/run-drizzle-local.sh push"
```

Create `scripts/run-drizzle-local.sh` with `set -euo pipefail`. It must:

1. accept only the first argument `push` and forward remaining arguments;
2. select `LOCAL_DATABASE_URL` first, falling back to `DATABASE_URL`;
3. fail before invoking Drizzle if no URL is set;
4. parse the selected value with Node's `URL`, require protocol `postgres:` or
   `postgresql:`, and accept only parsed hostnames `localhost`, `127.0.0.1`, or
   `[::1]`; read the value from the environment, not an argument, and do not use
   the unanchored regex from `scripts/clone-supabase-db.sh:68-70`;
5. never print the URL or credentials;
6. export the selected value as `DATABASE_URL`; and
7. finish with `exec pnpm exec drizzle-kit push "$@"`.

Do not add a bypass flag. `db:migrate` remains an explicit low-level command,
but this plan will execute it only against a newly recreated local database.

**Verify**:

```bash
bash -n scripts/run-drizzle-local.sh
mkdir -p tmp
if env -u DATABASE_URL -u LOCAL_DATABASE_URL pnpm db:push >tmp/db-push-no-url.log 2>&1; then exit 1; fi
rg -q "database URL is required" tmp/db-push-no-url.log
if DATABASE_URL='postgresql://user:do-not-print-me@example.invalid/db?next=postgresql://localhost/db' pnpm db:push >tmp/db-push-remote.log 2>&1; then exit 1; fi
rg -q "Refusing to run drizzle-kit push against a non-local database" tmp/db-push-remote.log
! rg -q "do-not-print-me" tmp/db-push-remote.log
if DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' bash scripts/run-drizzle-local.sh invalid >tmp/db-push-command.log 2>&1; then exit 1; fi
rg -q "Usage:.*push" tmp/db-push-command.log
```

Expected: all commands exit 0; neither refusal reaches Drizzle or exposes the
sentinel password.

### Step 3: Generate and review the initial baseline

Confirm `drizzle/` is still absent. Generate the baseline from the unchanged
`src/db/schema.ts`; the local-looking URL only satisfies config evaluation and
is not contacted by `generate`:

```bash
test ! -e drizzle
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cocoacomaa_generation pnpm db:generate --name=baseline
```

Expected artifacts are exactly:

```text
drizzle/0000_baseline.sql
drizzle/meta/0000_snapshot.json
drizzle/meta/_journal.json
```

Review the SQL rather than accepting generated output blindly. It must create
the 19 tables represented in `src/db/schema.ts`, their declared indexes and
foreign keys, and nothing destructive or data-bearing. Do not edit
`src/db/schema.ts` to make generation pass.

**Verify**:

```bash
test "$(find drizzle -type f | wc -l | tr -d ' ')" = "3"
test "$(rg -c '^CREATE TABLE ' drizzle/0000_baseline.sql)" = "19"
diff -u \
  <(printf '%s\n' account analytics_daily_dessert_revenue analytics_daily_eod_stock analytics_daily_item_sales analytics_daily_revenue analytics_monthly_dessert_revenue analytics_monthly_revenue daily_dessert_inventory dessert_combo_items dessert_combos desserts inventory_audit_log order_item_modifiers order_items orders session upi_accounts user verification | sort) \
  <(sed -nE 's/^CREATE TABLE "([^"]+)".*/\1/p' drizzle/0000_baseline.sql | sort)
! rg -n '^(DROP|TRUNCATE|DELETE|UPDATE|INSERT)[[:space:]]' drizzle/0000_baseline.sql
! rg -n 'postgres(ql)?://|DATABASE_URL|SUPABASE_DATABASE_URL' drizzle
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cocoacomaa_generation pnpm db:check
git diff --check
```

Expected: exactly three generated files, 19 `CREATE TABLE` statements, no
destructive/DML statements or URLs, and both checks exit 0. If the generated
name/count/shape differs, STOP; do not rename or hand-edit metadata.

### Step 4: Apply the baseline only to a newly recreated local database

Ask the operator for the Plan 007 exact-name loopback test URL in
`MIGRATION_TEST_DATABASE_URL`. Ensure no integration run is concurrent, then
reuse Plan 007's validated lifecycle helper to recreate `cocoacomaa_test`.
Never reuse the default `postgres` database. Keep this database only through
Step 6; on any failure after creation, run the guarded drop command shown at
the end of Step 6 before reporting the STOP condition.

```bash
: "${MIGRATION_TEST_DATABASE_URL:?set a dedicated disposable local database URL}"
TEST_DATABASE_URL="$MIGRATION_TEST_DATABASE_URL" pnpm exec tsx scripts/integration-db-lifecycle.ts create
test "$(psql "$MIGRATION_TEST_DATABASE_URL" -Atc 'SELECT current_database();')" = "cocoacomaa_test"
test "$(psql "$MIGRATION_TEST_DATABASE_URL" -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast' AND c.relkind IN ('r','p','v','m','S','f');")" = "0"
DATABASE_URL="$MIGRATION_TEST_DATABASE_URL" pnpm db:migrate
test "$(psql "$MIGRATION_TEST_DATABASE_URL" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")" = "19"
test "$(psql "$MIGRATION_TEST_DATABASE_URL" -Atc 'SELECT count(*) FROM drizzle.__drizzle_migrations;')" = "1"
BASELINE_HASH="$(node -e "const c=require('node:crypto'),f=require('node:fs');process.stdout.write(c.createHash('sha256').update(f.readFileSync('drizzle/0000_baseline.sql','utf8')).digest('hex'))")"
BASELINE_WHEN="$(node -p "require('./drizzle/meta/_journal.json').entries[0].when")"
test "$(psql "$MIGRATION_TEST_DATABASE_URL" -AtF '|' -c 'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;')" = "$BASELINE_HASH|$BASELINE_WHEN"
DATABASE_URL="$MIGRATION_TEST_DATABASE_URL" pnpm db:migrate
test "$(psql "$MIGRATION_TEST_DATABASE_URL" -AtF '|' -c 'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;')" = "$BASELINE_HASH|$BASELINE_WHEN"
```

Expected: first migration succeeds, all 19 public tables exist, one migration
ledger row contains the SQL SHA-256 and journal timestamp, and rerunning is a
no-op. If recreation, emptiness, application, or ledger verification fails,
run the guarded cleanup, then STOP.

### Step 5: Make disposable integration tests replay tracked migrations

Replace only the schema bootstrap command in `scripts/run-integration-tests.sh`:

```bash
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
```

Remove the old `pnpm exec drizzle-kit push --config
drizzle.integration.config.ts --force` command. Delete
`drizzle.integration.config.ts`, which now has no caller. Preserve Plan 007's
exact URL validation, database create/drop lifecycle, `EXIT` trap, Vitest
configuration, and failure-status handling; this step changes only how the
fresh owned database receives its schema.

**Verify**:

```bash
rg -n 'DATABASE_URL="\$TEST_DATABASE_URL" pnpm db:migrate' scripts/run-integration-tests.sh
! rg -n 'drizzle-kit push|drizzle.integration.config' scripts/run-integration-tests.sh
test ! -e drizzle.integration.config.ts
TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration
```

Expected: the runner applies `0000` through Drizzle's migration ledger, all
Plan 007 tests pass, and its trap drops the disposable database. A migration
failure must prevent Vitest from starting while still running cleanup.

### Step 6: Compare the baseline with an existing environment read-only

Obtain an operator-approved, read-only connection in
`EXISTING_SCHEMA_DATABASE_URL`. Dump only schema metadata—never data—and compare
it with the fresh migrated local database using the same `pg_dump` client:

```bash
set -o pipefail
: "${EXISTING_SCHEMA_DATABASE_URL:?set an operator-approved read-only URL}"
test "$EXISTING_SCHEMA_DATABASE_URL" != "$MIGRATION_TEST_DATABASE_URL"
mkdir -p tmp/migration-baseline
pg_dump "$EXISTING_SCHEMA_DATABASE_URL" --schema=public --schema-only --no-owner --no-privileges --no-comments --no-tablespaces | sed -E -e '/^-- (PostgreSQL database dump|Dumped from database version|Dumped by pg_dump version|Started on|Completed on)/d' -e '/^\\(un)?restrict /d' >tmp/migration-baseline/existing.sql
pg_dump "$MIGRATION_TEST_DATABASE_URL" --schema=public --schema-only --no-owner --no-privileges --no-comments --no-tablespaces | sed -E -e '/^-- (PostgreSQL database dump|Dumped from database version|Dumped by pg_dump version|Started on|Completed on)/d' -e '/^\\(un)?restrict /d' >tmp/migration-baseline/fresh.sql
diff -u tmp/migration-baseline/existing.sql tmp/migration-baseline/fresh.sql
```

Expected: `diff` exits 0 with no output. Repeat for every distinct existing
schema identified in Step 1. Any semantic difference—including extra tables,
policies, triggers, functions, constraints, or indexes—is a STOP condition.
Do not modify the baseline merely to silence a diff; report the objects and
resolve ownership first.

After every environment has been compared, or before reporting any failure
after Step 4 created the database, remove it with Plan 007's guarded helper:

```bash
TEST_DATABASE_URL="$MIGRATION_TEST_DATABASE_URL" pnpm exec tsx scripts/integration-db-lifecycle.ts drop
if psql "$MIGRATION_TEST_DATABASE_URL" -Atc 'SELECT 1' >/dev/null 2>&1; then exit 1; fi
```

Expected: the target no longer accepts a connection. Cleanup failure is a STOP
condition.

### Step 7: Document generation and operator-owned baselining

Create `docs/database-migrations.md` with these sections:

- **Ownership invariant**: `src/db/schema.ts` plus tracked `drizzle/` history is
  canonical after this plan; generated SQL and metadata are reviewed together.
- **Developer workflow**: edit schema, run
  `pnpm db:generate --name=<descriptive-name>`, review SQL, run `pnpm db:check`,
  and verify on an empty disposable local DB. Never edit an applied migration;
  generate a forward migration.
- **Local push escape hatch**: `pnpm db:push` is guarded and only for local
  disposable prototyping. Any schema change retained for review must be
  represented by a generated migration.
- **Fresh-database verification**: include recreation/empty checks, first apply,
  exact ledger hash/timestamp assertion, second no-op apply, and guarded cleanup
  from Steps 4 and 6.
- **Existing-environment adoption**: explicitly prohibit running
  `0000_baseline.sql` against a non-empty environment. Require the read-only
  schema comparison in Step 6, a backup/rollback review, two-person approval,
  and an operator-owned change record containing environment, commit SHA,
  migration filename, journal `when`, SQL SHA-256, reviewer, result, and rollback
  reference. The database operator—not an agent or repository script—must use
  the organization's approved process to record the baseline as already
  applied, then verify read-only that the ledger row exactly matches those two
  values. Do not include raw ledger `INSERT` SQL. No later migration may be
  deployed to that environment until this adoption is verified.
- **Shared-environment boundary**: `pnpm db:migrate` is not authorization to
  mutate shared databases. This plan provides no production command; rollout
  requires a separate approved operation after the ledger baseline is verified.
- **STOP conditions and recovery**: schema diff, unknown ownership, non-empty
  fresh target, failed migration, or ledger mismatch all stop rollout.

Update `README.md` with a short "Database migrations" section linking to the
new document and listing `db:generate`, `db:check`, `db:migrate`, and the
local-only `db:push`. Do not duplicate the full runbook.

**Verify**:

```bash
rg -q 'Database migrations' README.md
rg -q 'must not.*baseline|never.*baseline' docs/database-migrations.md
rg -q 'local-only|local only' README.md docs/database-migrations.md
rg -q 'db:generate' README.md docs/database-migrations.md
! rg -n 'INSERT INTO.*__drizzle_migrations' README.md docs scripts
```

Expected: all assertions exit 0 and no repository-owned ledger mutation SQL
exists.

### Step 8: Run the complete gate and commit

```bash
pnpm install --frozen-lockfile
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/cocoacomaa_generation pnpm db:check
bash -n scripts/run-drizzle-local.sh
pnpm lint
pnpm typecheck
pnpm test
TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration
git diff --check
git status --short
```

Expected: every listed check exits 0. `pnpm build` remains deferred for the
tracked environment-contract work identified by Plan 006. `git status --short`
lists only the allowed files from Scope; `pnpm-lock.yaml`, schema, config, and
application source are clean.
Review `git diff --stat` and commit:

```bash
git add package.json scripts/run-drizzle-local.sh scripts/run-integration-tests.sh drizzle.integration.config.ts drizzle README.md docs/database-migrations.md plans/README.md
git diff --cached --check
git commit -m "chore(db): establish versioned migration baseline"
```

Expected: one Conventional Commit is created on the required branch. Do not
push. Do not run `db:migrate` against an existing/shared environment.

## Test plan

- Guard tests: missing URL is rejected; a remote URL is rejected before Drizzle
  runs; refusal output does not reveal credentials; shell syntax is valid.
- Migration tests: baseline applies to a newly recreated local database, creates
  the exact 19-table set, records the expected hash/timestamp, and a second apply
  is idempotent.
- Integration bootstrap: Plan 007's fresh guarded database is created from the
  tracked migration history, never a parallel schema push, and is always dropped.
- Compatibility test: normalized, schema-only dumps from every existing schema
  and the freshly migrated local schema have an empty diff.
- Regression gate: lint, typecheck, and the existing Vitest suite all pass. No
  new application test file is needed because this plan changes
  database tooling and generated SQL, not runtime application behavior.

## Done criteria

- [ ] Written confirmation says this repository owns migrations; all existing
      environments and the named baseline operator are recorded externally.
- [ ] Plans 006 and 007 are complete and the quality/integration gates are green.
- [ ] `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:check` exist.
- [ ] `pnpm db:push` refuses missing and non-local database URLs without
      printing credentials.
- [ ] Exactly one reviewed baseline migration and its two metadata files are
      tracked; it represents all 19 current tables and contains no DML/drop.
- [ ] The baseline passes `db:check`, applies on a newly recreated local
      database, records the expected SQL hash/journal timestamp, is idempotent
      on a second run, and the disposable database is dropped afterward.
- [ ] `pnpm test:integration` applies the tracked history to Plan 007's fresh
      guarded database; no `drizzle-kit push` integration bootstrap remains.
- [ ] Schema-only comparison against every existing environment is empty.
- [ ] Existing-environment adoption is operator-reviewed and never replays the
      baseline `CREATE` statements; no ledger mutation SQL is committed.
- [ ] README and the detailed runbook document ownership, local-only push,
      fresh verification, and shared-environment boundaries.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` exit 0; build remains
      explicitly deferred to the tracked environment-contract work.
- [ ] Only files listed in Scope are modified and the commit uses the required
      branch and message.
- [ ] Plan 008's index row is `DONE`, unless the reviewer owns index updates.

## Rollback

- Before any existing environment adopts the baseline, revert the repository
  commit to restore the schema-push integration bootstrap and remove the new
  migration commands/history. Use Plan 007's guarded helper to drop any
  disposable database left by interrupted verification.
- After any existing environment records the baseline, the migration file and
  journal entry are immutable. Do not revert or regenerate them. A mistaken
  ledger adoption is recovered only by the named database operator under the
  approved backup/change record; this plan supplies no ledger-delete SQL.
- Future schema mistakes are corrected with a reviewed forward migration, not
  by editing or deleting an applied migration.

## STOP conditions

Stop and report; do not improvise if:

- migration ownership is external, mixed, unknown, or not confirmed in writing;
- no named operator/approved change process exists for baseline adoption;
- Plan 006 or Plan 007 is incomplete, or the repository/integration gate is not
  green before changes;
- schema/config/Drizzle versions drifted from commit `848e31d`;
- generated artifacts are not the expected three files or baseline SQL does not
  represent exactly the 19 current tables;
- baseline SQL contains destructive statements or data changes;
- a disposable migration target is non-local, non-empty, or not dedicated;
- fresh migration, idempotence, or migration consistency checks fail;
- the migration ledger hash/timestamp differs from the generated SQL/journal,
  or the disposable database cannot be cleaned up;
- any existing-environment schema dump differs semantically from the fresh
  migrated schema, including unmodeled Supabase objects;
- adoption would require replaying baseline `CREATE` statements against an
  existing environment or committing direct ledger-update SQL;
- anyone asks this executor to mutate a shared/production database;
- the work requires a file outside Scope or a verification fails twice after a
  reasonable correction.

## Maintenance notes

- Plan 007 intentionally starts with schema push because no history exists at
  its planned commit. This plan is the one-way handoff to migration replay;
  future integration runs must never add the push bootstrap back.
- Reviewers should scrutinize the baseline SQL, schema-only comparison evidence,
  and the named ownership/adoption record more closely than the package scripts.
- Never amend a migration already recorded in any environment. Add a forward
  migration and verify it from an empty database through the full history.
- `db:push` remains a local prototyping escape hatch, not migration history.
- Applying the baseline marker to existing environments is intentionally
  deferred to a separate, human-approved database operation. This plan neither
  scripts nor authorizes that mutation.
