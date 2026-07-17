# Plan 016: Make setup and first-admin bootstrap reproducible

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Never print, copy into task output, or commit an
> existing environment value or bootstrap credential. When done, update only
> this plan's status row in `plans/README.md` if that file is tracked and the
> dispatcher does not own it. An untracked index remains dispatcher-owned.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- .env.example .gitignore package.json pnpm-lock.yaml README.md CONTEXT.md scripts/seed-admin.ts scripts/clone-supabase-db.sh scripts/integration-db-lifecycle.ts scripts/test-database-url.ts src/db/index.ts src/db/query-logger.ts src/lib/auth.ts src/lib/auth-client.ts src/lib/auth/admin-access.ts src/app/api/revalidate/route.ts src/lib/bootstrap-admin.ts src/lib/bootstrap-admin.test.ts src/lib/setup-contract.test.ts trigger.config.ts plans/README.md; git -c status.branch=false status --short -- .env.example .gitignore package.json pnpm-lock.yaml README.md CONTEXT.md scripts/seed-admin.ts src/lib/auth.ts src/lib/auth/admin-access.ts src/lib/bootstrap-admin.ts src/lib/bootstrap-admin.test.ts src/lib/setup-contract.test.ts plans/README.md`
> Plans 001, 003, 006, and 012 are expected to have changed auth policy,
> query logging, package versions/scripts, README documentation, and
> the plan index.
> The status command is required because the commit-range diff does not report
> working-tree or untracked files. Record the full worktree status as a baseline;
> ignored `.env.example` and `scripts/seed-admin.ts` require Step 1's separate
> non-disclosing gate.
> Compare live code with the non-sensitive excerpts below. Do not treat the
> prerequisite changes as drift, but STOP if their stated contracts are absent.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-disable-public-self-registration.md`, `plans/003-redact-database-query-parameters.md`, `plans/006-establish-green-quality-gate.md`, `plans/012-upgrade-vulnerable-production-dependencies.md`
- **Category**: dx
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

Fresh-clone setup is not reproducible: every `.env*` file is ignored, the
README covers only Trigger.dev and database cloning, and the only local admin
seed is an ignored file containing embedded credential structure. Once public
signup is disabled by Plan 001, a new environment also needs a deliberate way
to create its first administrator without reopening signup.

This plan adds a sanitized tracked environment contract, correct setup and
architecture documentation, and a completed-run-idempotent first-admin CLI. The CLI uses
Better Auth's installed server-side user-creation API for credential hashing,
then promotes only the exact newly returned user row. It never logs input
secrets, refuses remote/shared databases without an explicit one-purpose
acknowledgement, and creates no catalog, order, inventory, or analytics data.

## Current state

- `.gitignore:33-44` ignores the environment template and admin seed:

  ```gitignore
  # env files (can opt-in for committing if needed)
  .env*

  # admin seed script (contains sensitive credentials)
  scripts/seed-admin.ts
  ```

- Ignored local material exists at the planned commit. It is user-owned until
  proven safe:
  - `.env.example` is 19 lines. A key-only extraction found these names:
    `BETTER_AUTH_BASE_URL`, `BETTER_AUTH_SECRET`, `DATABASE_URL`,
    `LOCAL_DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `REVALIDATE_SECRET`,
    `SUPABASE_DATABASE_URL`, `TRIGGER_PROJECT_REF`, and
    `TRIGGER_SECRET_KEY`. No value was inspected or reproduced.
  - `scripts/seed-admin.ts` is 81 lines. A redacted AST inspection found imports
    of Drizzle/Postgres/application auth, local variables named for name/email/
    password, an email lookup, role updates, `auth.api.signUpEmail`, console
    calls, and process exit. No literal value was inspected or reproduced.
  - The executor must run the non-disclosing scan in Step 1 before replacing
    either path. An unsafe or unknown result is a STOP, not permission to
    overwrite it.
- `README.md:1-28` has only Trigger.dev and local database-clone sections. It
  calls all of these “required” even though their consumers differ:

  ```md
  Required environment variables:

  - `TRIGGER_PROJECT_REF`
  - `TRIGGER_SECRET_KEY`
  - `DATABASE_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `REVALIDATE_SECRET`
  ```

- Tracked runtime/tooling consumers establish the environment contract:
  - `DATABASE_URL`: required at module load by `src/db/index.ts:6-10` and by
    Drizzle tooling in `drizzle.config.ts:3-15`.
  - `BETTER_AUTH_SECRET`: read by installed Better Auth; production startup
    rejects a missing/default secret and recommends at least 32 high-entropy
    characters. `src/lib/auth.ts:10-31` configures Better Auth.
  - `BETTER_AUTH_BASE_URL` and `NEXT_PUBLIC_APP_URL`: auth server/client base
    URL and trusted origin (`src/lib/auth.ts:29-30`,
    `src/lib/auth-client.ts:4-6`).
  - `REVALIDATE_SECRET`: required at import by
    `src/app/api/revalidate/route.ts:5-9`; used with `NEXT_PUBLIC_APP_URL` by
    `src/server/effect/services/cache.ts:26-47`.
  - `DB_QUERY_TIMING` and `DB_SLOW_QUERY_MS`: optional diagnostics in
    `src/db/query-logger.ts:22-28`. Plan 003 ensures values are not logged; the
    bootstrap still forces timing off defensively.
  - `TRIGGER_PROJECT_REF` and `TRIGGER_SECRET_KEY`: Trigger CLI/worker inputs;
    the project is also declared in `trigger.config.ts`. The manual trigger
    helper explicitly requires `TRIGGER_SECRET_KEY`
    (`scripts/trigger-analytics.ts:11-13`). These are optional for core web-app
    startup and required only for the documented Trigger workflows.
  - `SUPABASE_DATABASE_URL` or `REMOTE_DATABASE_URL`, plus optional
    `LOCAL_DATABASE_URL`: database-clone inputs
    (`scripts/clone-supabase-db.sh:3-15,37-46`).
  - `NODE_ENV` is runtime-managed and must not be added to the template.
- Plan 001 adds `emailAndPassword.disableSignUp: true`. Therefore
  `auth.api.signUpEmail` is not a valid bootstrap mechanism. The installed
  Better Auth admin plugin provides the correct internal server seam:

  ```js
  // node_modules/better-auth/dist/plugins/admin/routes.mjs:147-175
  const session = await getSessionFromCtx(ctx);
  if (!session && (ctx.request || ctx.headers)) throw ctx.error("UNAUTHORIZED");
  // ...
  const user = await ctx.context.internalAdapter.createUser({ ... });
  const hashedPassword = await ctx.context.password.hash(ctx.body.password);
  await ctx.context.internalAdapter.linkAccount({
      providerId: "credential",
      password: hashedPassword,
      userId: user.id
  });
  ```

  A headerless `auth.api.createUser({ body })` is a trusted server invocation;
  the public HTTP endpoint still receives request/headers and requires an admin
  session. Use it to create a normal `user`, then promote only the returned ID.
- `src/db/schema.ts:244-306` defines `user.role` (default `user`) and credential
  accounts with a cascade from user to account. This supports exact promotion
  and cleanup without schema work.
- `package.json:5-21` has no bootstrap command. Plan 006 adds `check`; preserve
  it and the existing `db:push` command.
- `CONTEXT.md:79-82` has one verifiable tooling typo: the lint and typecheck
  examples use an invalid `vp` command prefix instead of `pnpm`.

  ```md
  - `pnpm format`
  - `pnpm lint`
  - `pnpm typecheck`
  ```

  Plan 013 owns the separate analytics mutation/compilation prose in
  `CONTEXT.md`; preserve its live or prerequisite version. Architecture records
  live in `CONTEXT.md` and `docs/adr/*.md` per ADR 0001.

## Target environment contract

Track `.env.example` with comments that classify these exact names:

```text
# Required web application values
DATABASE_URL=<postgresql-connection-url>
BETTER_AUTH_SECRET=<random-high-entropy-value-at-least-32-characters>
BETTER_AUTH_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
REVALIDATE_SECRET=<independent-random-secret>

# Optional database diagnostics
DB_QUERY_TIMING=0
DB_SLOW_QUERY_MS=100

# Optional Trigger.dev workflows
TRIGGER_PROJECT_REF=<trigger-project-ref>
TRIGGER_SECRET_KEY=<trigger-secret-key>

# Optional database cloning
SUPABASE_DATABASE_URL=<remote-postgresql-url>
REMOTE_DATABASE_URL=
LOCAL_DATABASE_URL=<local-postgresql-url>

# One-time bootstrap inputs: export in the invoking shell; do not persist here
# BOOTSTRAP_ADMIN_NAME=
# BOOTSTRAP_ADMIN_EMAIL=
# BOOTSTRAP_ADMIN_PASSWORD=
# COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE=
```

All angle-bracket entries are literal placeholders, not usable credentials.
`SUPABASE_DATABASE_URL` and `REMOTE_DATABASE_URL` are alternatives; users fill
only one. Do not add real project values, tokens, passwords, or URLs containing
credentials.

## Target bootstrap seam

Create `src/lib/bootstrap-admin.ts` with no database/auth imports and these
load-bearing contracts:

```ts
export const SHARED_DATABASE_ACKNOWLEDGEMENT = "CREATE_FIRST_ADMIN";

export type BootstrapAdminConfig = {
	name: string;
	email: string;
	password: string;
	databaseUrl: string;
};

export function parseBootstrapAdminEnvironment(
	env: NodeJS.ProcessEnv,
): BootstrapAdminConfig;

export type BootstrapAdminDependencies = {
	findUserByEmail(email: string): Promise<{ id: string; role: string | null } | null>;
	findFirstAdmin(): Promise<{ id: string } | null>;
	createCredentialUser(input: {
		name: string;
		email: string;
		password: string;
		role: "user";
	}): Promise<{ id: string }>;
	promoteCreatedUser(input: { id: string; email: string }): Promise<boolean>;
	deleteCreatedUser(id: string): Promise<boolean>;
};

export async function bootstrapFirstAdmin(
	config: BootstrapAdminConfig,
	dependencies: BootstrapAdminDependencies,
): Promise<"created" | "already-admin">;
```

`parseBootstrapAdminEnvironment` trims name, lowercases/trims email, validates
the same name/email/password bounds as `createManagerSchema` (name 1-255,
valid email up to 255 characters, password 8-128), accepts only `postgres:` or
`postgresql:` URLs, and classifies only parsed hostnames `localhost`,
`127.0.0.1`, `::1`, and Node's bracketed `[::1]` representation as local. Any
other host requires
`COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE` to equal the exported
constant exactly. Error messages identify missing variable names or the failed
policy but never echo input values.

`bootstrapFirstAdmin` follows this exact state machine:

1. If the requested email already belongs to an admin, return
   `"already-admin"` without any write.
2. If that email exists with any non-admin role, refuse; never convert an
   existing account with an unverified password.
3. If a different admin already exists, refuse; this command creates only the
   first admin. Subsequent accounts use the authenticated Admin UI.
4. Call the injected Better Auth adapter once with explicit role `"user"`.
5. Promote using a conditional update that matches the returned user ID,
   normalized email, and current role `"user"`. Exactly one row must update.
6. If promotion returns false or rejects, delete only the user created in step
   4 (credential account cascades), then throw a fixed generic error. If cleanup
   returns false or rejects, throw a different fixed message requiring manual
   auth-table review. Never log or include the password, URL, email, user ID,
   database error, or query in either message.
7. If the Better Auth create call rejects before returning a user ID, do not
   guess which row to delete. Throw a fixed message requiring manual auth-table
   review: Better Auth creates the user before linking the credential account,
   so an interrupted/failed internal call can leave an unpromoted user that the
   orchestrator cannot safely identify by a returned ID.

This is idempotent for a completed run: rerunning with the same email returns
`"already-admin"`; it neither resets the password nor creates a second account.
It is deliberately not claimed to be crash-safe or concurrency-safe. A process
termination during Better Auth creation can require manual auth-table review,
and concurrent first-admin invocations are forbidden.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0; lockfile unchanged |
| Focused tests | `pnpm exec vitest run src/lib/bootstrap-admin.test.ts src/lib/setup-contract.test.ts` | 11 tests pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| Quality gate | `pnpm check` | exit 0 |
| Schema push | guarded lifecycle block in Steps 6 and 7 | `db:push` exits 0 only after recreating the exact-name disposable loopback database |
| Build | `pnpm build` against the verified disposable DB in Step 7 | exit 0 |
| Patch hygiene | `git diff --check` | exit 0 |

No new dependency is needed. Reuse Zod, Drizzle, Better Auth, `tsx`, and
Vitest already in the repository.

## Scope

**In scope (the only files to modify):**

- `.env.example` (replace only after Step 1's safe-material gate)
- `.gitignore`
- `package.json` (one script only)
- `README.md`
- `CONTEXT.md`
- `scripts/seed-admin.ts` (replace only after Step 1's safe-material gate)
- `src/lib/bootstrap-admin.ts` (create)
- `src/lib/bootstrap-admin.test.ts` (create)
- `src/lib/setup-contract.test.ts` (create)
- `plans/README.md` (only Plan 016's final status row, and only when the tracked
  index is executor-owned)

**Out of scope:**

- Re-enabling public signup, changing Plan 001's auth configuration, adding an
  invitation/signup UI, or changing normal admin manager provisioning
- Writing password hashes or Better Auth account rows directly; Better Auth's
  installed server API owns those details
- Promoting any pre-existing non-admin user, resetting an existing admin's
  password, creating more than the first admin, or creating sessions
- Seeding desserts, combos, UPI accounts, inventory, orders, analytics, or any
  other sample/business data
- Database schema changes, generated migration history, or applying `db:push`
  to a shared/production environment as part of this plan
- A generalized CLI framework, interactive UI, password generator, dependency
  addition, CI build/service changes, or lockfile changes
- Logging credentials, URLs, auth results, raw errors, IDs, queries, or full
  environment objects

## Git workflow

- Branch: `feat/016-reproducible-setup-bootstrap`
- Suggested commits:
  1. `docs: add reproducible setup contract`
  2. `feat(auth): add first-admin bootstrap command`
- Do not push or open a pull request unless explicitly instructed. Never stage
  a formerly ignored file until its safe replacement is present and reviewed.

## Steps

### Step 1: Gate existing ignored material without disclosing it

Run the drift check and record the complete baseline. Confirm Plans 001, 003,
006, and 012 are `DONE`, create/switch to the exact branch, and perform the
frozen install before inspecting installed package code:

```bash
rg -q '001.*DONE' plans/README.md
rg -q '003.*DONE' plans/README.md
rg -q '006.*DONE' plans/README.md
rg -q '012.*DONE' plans/README.md
test "$(git branch --show-current)" = "feat/016-reproducible-setup-bootstrap"
pnpm install --frozen-lockfile
git diff --exit-code -- pnpm-lock.yaml
```

Re-check the headerless `auth.api.createUser` behavior, password hashing, and
credential linkage in the installed post-Plan-012 Better Auth version. Before
opening or replacing either ignored local file, run this key/structure-only
scanner from the repository root. It never prints a value or string literal:

```bash
node - <<'NODE'
const fs = require("node:fs");
const ts = require("typescript");
let unsafe = false;

if (fs.existsSync(".env.example")) {
	const lines = fs.readFileSync(".env.example", "utf8").split(/\r?\n/);
	for (const [index, line] of lines.entries()) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;
		const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
		if (!match) {
			console.error(`unsafe env structure at line ${index + 1}`);
			unsafe = true;
			continue;
		}
		const [, key, value] = match;
		const approvedFixedValue =
			((key === "BETTER_AUTH_BASE_URL" || key === "NEXT_PUBLIC_APP_URL") &&
				value === "http://localhost:3000") ||
			(key === "DB_QUERY_TIMING" && value === "0") ||
			(key === "DB_SLOW_QUERY_MS" && value === "100");
		const approved = value === "" || /^<[^>]+>$/.test(value) || approvedFixedValue;
		if (!approved) {
			console.error(`non-placeholder env value for ${key} at line ${index + 1}`);
			unsafe = true;
		}
	}
}

if (fs.existsSync("scripts/seed-admin.ts")) {
	const path = "scripts/seed-admin.ts";
	const source = fs.readFileSync(path, "utf8");
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	function visit(node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /^(name|email|password)$/i.test(node.name.text) && node.initializer && ts.isStringLiteralLike(node.initializer)) {
			const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
			console.error(`literal bootstrap field ${node.name.text} at line ${line}`);
			unsafe = true;
		}
		if (ts.isPropertyAssignment(node) && /^(name|email|password)$/i.test(node.name.getText(file).replace(/["']/g, "")) && ts.isStringLiteralLike(node.initializer)) {
			const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
			console.error(`literal bootstrap property ${node.name.getText(file).replace(/["']/g, "")} at line ${line}`);
			unsafe = true;
		}
		ts.forEachChild(node, visit);
	}
	visit(file);
}

process.exitCode = unsafe ? 1 : 0;
NODE
```

The scanner is a non-disclosing tripwire, not proof that an arbitrary ignored
file contains no secret. The current ignored seed is expected to fail. STOP and
tell the operator only which field names/line numbers were flagged. The
operator—not the executor—must securely archive outside the repository or
delete the old file, explicitly confirm the path may be replaced, and rotate
any credential that may have been used. Do not copy, rename, diff, `git add -f`,
or print it. Likewise, STOP on any non-placeholder `.env.example` value; the
operator must secure it and explicitly authorize replacement before resuming.

After operator remediation, rerun the scanner; it must exit 0 or both paths may
be absent. Require `test ! -e scripts/seed-admin.ts` before creating the safe
replacement. An existing placeholder-only `.env.example` may be replaced only
after the operator's explicit confirmation. Expected: all four prerequisites
are done, the exact branch is active, the lockfile is unchanged, installed
Better Auth retains the trusted server seam, and the ignored-material gate is
cleared without disclosing or overwriting user-owned content.

### Step 2: Add red tests for the tracked setup contract

Create `src/lib/setup-contract.test.ts`. Read files with
`node:fs/promises`; never read a developer `.env`, `.env.local`, or any ignored
path other than the now-sanitized `.env.example`. Add exactly three tests:

1. Parse assignment names plus commented bootstrap names from `.env.example`;
   assert the set exactly matches “Target environment contract,” contains no
   `NODE_ENV`, and every non-comment value is empty, an angle-bracket
   placeholder, `http://localhost:3000`, `0`, or `100`. Assert all four
   one-time bootstrap inputs are comment-only and have no tracked value.
2. Parse `package.json`; assert every `pnpm <script>` command in README's Setup,
   Database, and Trigger sections exists. Assert README links to `CONTEXT.md`,
   ADR 0001, ADR 0006, and ADR 0007, and every linked local file exists.
3. Assert `CONTEXT.md` contains `pnpm format`, `pnpm lint`, and
   `pnpm typecheck`, and contains no `vp `. Do not assert or rewrite the
   analytics workflow section; Plan 013 owns that contract.

**Verify red**:

```bash
pnpm exec vitest run src/lib/setup-contract.test.ts
```

Expected: exactly 3 tests run and fail only because the tracked template/setup
docs and corrected CONTEXT command references do not exist yet. If the
sanitized template is absent, represent that as an explicit failed existence
assertion before reading it; an uncaught file-loading or syntax error is not an
acceptable red state.

### Step 3: Track the sanitized environment and correct setup documentation

Create or replace `.env.example` with the exact classified shape in “Target
environment contract” only after Step 1's operator confirmation. In
`.gitignore`, keep `.env*` but add `!.env.example` immediately after it. Remove
only the obsolete `scripts/seed-admin.ts` ignore rule after the old local seed
has been removed under Step 1's safety gate.

Add only this script to the existing `package.json` scripts:

```json
"auth:bootstrap-admin": "tsx scripts/seed-admin.ts"
```

Rewrite/extend `README.md`. It must include:

- Prerequisites: Node 24, pnpm 11, PostgreSQL.
- Fresh local setup: frozen install, copy `.env.example` to ignored `.env`,
  replace every required placeholder, apply `pnpm db:push` only to the intended
  new local DB, bootstrap first admin, then `pnpm dev`.
- Existing/shared/production environments: explain that `db:push` directly
  synchronizes schema and is never an automatic setup or deployment step.
  Require an operator-approved backup, reviewed Drizzle schema diff, and an
  explicit production change window before running it against production.
- A table classifying required web variables, optional diagnostics, Trigger
  inputs, clone inputs, and one-time bootstrap inputs exactly as the template.
- Secure bootstrap shell instructions: export name/email, use shell `read -s`
  followed by `export BOOTSTRAP_ADMIN_PASSWORD`, run
  `pnpm auth:bootstrap-admin`, then unset all three inputs and the shared-target
  acknowledgement when used. Never show a password on a command line, retain
  it in shell history, or persist it in `.env`.
- Remote/shared bootstrap: explain that it is refused unless
  `COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE` is set to the exact
  documented acknowledgement for that one invocation. State that this is not
  general deployment authorization.
- Idempotency: the same existing admin email is a no-op; a different existing
  admin or an existing non-admin target is refused. Public signup remains
  disabled; later accounts are created through the authenticated Admin UI.
- Accurate database-clone and Trigger commands already present in package
  scripts. Classify Trigger values as workflow-specific, not core-app required.
- Architecture links: `CONTEXT.md`, ADR 0001 (documentation convention), ADR
  0006 (auth boundaries), and ADR 0007 (Trigger orchestration).

In `CONTEXT.md`, change only the known stale command references:

```md
- `pnpm format`
- `pnpm lint`
- `pnpm typecheck`
```

Do not rewrite domain decisions, analytics workflow prose, or ADRs. Preserve
Plan 013's version if it is already present.

**Verify**:

```bash
pnpm exec vitest run src/lib/setup-contract.test.ts
node -e 'const p=require("./package.json"); if (p.scripts["auth:bootstrap-admin"] !== "tsx scripts/seed-admin.ts") process.exit(1)'
git check-ignore -q .env && ! git check-ignore -q .env.example
! git check-ignore -q scripts/seed-admin.ts
```

Expected: the 3 setup-contract tests pass; the script is exact; real env files
remain ignored while `.env.example` and the new seed path are trackable.

### Step 4: Implement and test the pure bootstrap policy

Create `src/lib/bootstrap-admin.test.ts` first, then implement
`src/lib/bootstrap-admin.ts` to the exact contracts/state machine above. Use
Zod or explicit validation, but do not import the application database or auth
singleton into the pure module.

Add exactly eight tests:

1. Parses/normalizes valid `localhost`, `127.0.0.1`, and bracketed IPv6
   loopback inputs without an acknowledgement (table-driven in one test).
2. Refuses a remote PostgreSQL URL without the exact acknowledgement and
   accepts it when the exact acknowledgement is present.
3. Rejects missing/invalid name, email, password, protocol, and URL without any
   error containing sentinel password or URL text (table-driven assertions may
   live in one test).
4. Returns `already-admin` for the requested existing admin and calls no write.
5. Refuses when a different first admin exists.
6. Refuses to promote an existing non-admin target.
7. Creates one explicit `user`, promotes exactly the returned ID/email, and
   returns `created`.
8. On promotion false/rejection, deletes exactly the just-created ID; cover
   cleanup false/rejection and a Better Auth creation rejection in the same
   test. A creation rejection has no returned ID, performs no guessed delete,
   and requires manual review. Assert every surfaced error contains no sentinel
   password, URL, email, ID, or raw dependency error.

Use only fixed fake/sentinel values in unit tests. Never read `process.env` or a
real database in this file.

**Verify**:

```bash
pnpm exec vitest run src/lib/bootstrap-admin.test.ts
pnpm typecheck
pnpm exec biome check src/lib/bootstrap-admin.ts src/lib/bootstrap-admin.test.ts
```

Expected: exactly 8 tests pass; typecheck and scoped Biome exit 0.

### Step 5: Replace the old seed with the safe Better Auth CLI adapter

Create the new tracked `scripts/seed-admin.ts` only after Step 1 clears the old
file. It must:

1. Import only the pure parser/orchestrator statically.
2. Parse and validate `process.env` before importing auth/database modules, so
   remote refusal cannot establish a connection. After successful parsing,
   delete `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`,
   `BOOTSTRAP_ADMIN_PASSWORD`, and
   `COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE` from `process.env`;
   retain the validated in-memory config only.
3. Set `process.env.DB_QUERY_TIMING = "0"` before dynamic imports.
4. Dynamically import `auth`, `db`, Drizzle operators, and `userTable`.
5. Implement the five injected operations with bounded queries:
   - exact normalized-email lookup;
   - first `role = "admin"` lookup with `limit(1)`;
   - headerless `auth.api.createUser({ body: { name, email, password,
     role: "user" } })` and return only `result.user.id`;
   - conditional promotion matching returned ID, normalized email, and current
     role `user`, returning true only for exactly one row;
   - cleanup delete matching only the returned ID, returning true only for one
     row. The account row cascades from `user`.
6. Print exactly `First administrator created.` or
   `First administrator already exists.` based on the returned status. Catch
   every parser, import, query, create, promote, and cleanup error and print
   only `First administrator bootstrap failed.` Never pass an error object to
   `console.*` and never print input data.
7. Exit explicitly after completion/failure so the shared Postgres client does
   not keep the one-shot command alive. Do not use an exit before awaited
   create/promotion/cleanup work completes.

Do not call `signUpEmail`, supply request headers, temporarily change
`disableSignUp`, write password/account fields directly, or use an unbounded
role update. A Better Auth create rejection has no safely returned ID; do not
delete by email or otherwise guess at cleanup. The fixed failure directs the
operator to the documented manual-review path.

**Verify**:

```bash
pnpm exec biome check scripts/seed-admin.ts src/lib/bootstrap-admin.ts
pnpm typecheck
! rg -n 'signUpEmail|disableSignUp|set\(\{[^}]*password|update\([^)]*userTable[^;]*role' scripts/seed-admin.ts
! rg -n 'console\.(log|error)\([^)]*(error|password|email|databaseUrl|process\.env)' scripts/seed-admin.ts
rg -n 'auth\.api\.createUser|role: "user"|DB_QUERY_TIMING|process\.exit|First administrator created\.|First administrator already exists\.|First administrator bootstrap failed\.' scripts/seed-admin.ts
rg -n 'delete process\.env\.(BOOTSTRAP_ADMIN_NAME|BOOTSTRAP_ADMIN_EMAIL|BOOTSTRAP_ADMIN_PASSWORD|COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE)' scripts/seed-admin.ts
```

Expected: format/type gates pass; forbidden signup/raw-log/password patterns
are absent; the Better Auth call, explicit initial role, query-timing guard,
environment cleanup, fixed output allowlist, and explicit exit are present.
Manually review the Drizzle update predicate to confirm it includes ID, email,
and current role; if it does not, STOP.

### Step 6: Prove refusal, idempotency, and no-secret output on a disposable DB

Use the repository's guarded integration-database lifecycle helper to create a
new, empty, exact-name loopback PostgreSQL database dedicated to this test,
apply the live Drizzle schema with `db:push`, and drop it on success or failure.
The helper's URL/name guards and the explicit empty-table assertion are
mandatory. Do not use a clone of real users or any shared URL. Never substitute
a production URL: this verification does not authorize a production schema
push or bootstrap.

First prove a remote-looking URL is refused before connection. Then run the
bootstrap twice with generated test-only secrets while shell tracing is off:

```bash
(
	set -euo pipefail
	set +x
	: "${BOOTSTRAP_TEST_DATABASE_URL:?set a new exact-name loopback PostgreSQL URL}"
	database_created=0
	cleanup() {
		status=$?
		trap - EXIT
		rm -f tmp/bootstrap-remote-refusal.log tmp/bootstrap-admin.log
		if [ "$database_created" = "1" ]; then
			TEST_DATABASE_URL="$BOOTSTRAP_TEST_DATABASE_URL" pnpm exec tsx scripts/integration-db-lifecycle.ts drop || exit 97
		fi
		unset DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_BASE_URL NEXT_PUBLIC_APP_URL
		unset BOOTSTRAP_ADMIN_NAME BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
		unset COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE
		exit "$status"
	}
	trap cleanup EXIT

	mkdir -p tmp
	export DATABASE_URL='postgresql://remote-bootstrap.invalid/cocoacomaa'
	export BOOTSTRAP_ADMIN_NAME='Bootstrap Test'
	export BOOTSTRAP_ADMIN_EMAIL='bootstrap@example.invalid'
	export BOOTSTRAP_ADMIN_PASSWORD="$(node -p 'require("node:crypto").randomBytes(36).toString("base64")')"
	unset COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE
	if pnpm --silent auth:bootstrap-admin >tmp/bootstrap-remote-refusal.log 2>&1; then exit 1; fi
	node -e 'const f=require("node:fs");if(f.readFileSync("tmp/bootstrap-remote-refusal.log","utf8")!=="First administrator bootstrap failed.\n")process.exit(1)'

	TEST_DATABASE_URL="$BOOTSTRAP_TEST_DATABASE_URL" pnpm exec tsx scripts/integration-db-lifecycle.ts create
	database_created=1
	test "$(psql "$BOOTSTRAP_TEST_DATABASE_URL" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")" = "0"
	export DATABASE_URL="$BOOTSTRAP_TEST_DATABASE_URL"
	DATABASE_URL="$DATABASE_URL" pnpm db:push --force
	test "$(psql "$DATABASE_URL" -Atc 'SELECT count(*) FROM "user"')" = "0"

	export BETTER_AUTH_SECRET="$(node -p 'require("node:crypto").randomBytes(48).toString("base64")')"
	export BETTER_AUTH_BASE_URL='http://localhost:3000'
	export NEXT_PUBLIC_APP_URL='http://localhost:3000'
	export BOOTSTRAP_ADMIN_PASSWORD="$(node -p 'require("node:crypto").randomBytes(36).toString("base64")')"
	pnpm --silent auth:bootstrap-admin >tmp/bootstrap-admin.log 2>&1
	pnpm --silent auth:bootstrap-admin >>tmp/bootstrap-admin.log 2>&1
	node -e 'const f=require("node:fs");const e="First administrator created.\nFirst administrator already exists.\n";if(f.readFileSync("tmp/bootstrap-admin.log","utf8")!==e)process.exit(1)'
	test "$(psql "$DATABASE_URL" -Atc "SELECT count(*) FROM \"user\" WHERE email='bootstrap@example.invalid' AND role='admin'")" = "1"
	test "$(psql "$DATABASE_URL" -Atc "SELECT count(*) FROM account WHERE provider_id='credential' AND user_id=(SELECT id FROM \"user\" WHERE email='bootstrap@example.invalid')")" = "1"
	test "$(psql "$DATABASE_URL" -Atc 'SELECT count(*) FROM "user"')" = "1"
	test "$(psql "$DATABASE_URL" -Atc 'SELECT count(*) FROM session')" = "0"
	test "$(psql "$DATABASE_URL" -Atc 'SELECT (SELECT count(*) FROM orders) + (SELECT count(*) FROM desserts) + (SELECT count(*) FROM daily_dessert_inventory) + (SELECT count(*) FROM analytics_daily_revenue)')" = "0"

	TEST_DATABASE_URL="$BOOTSTRAP_TEST_DATABASE_URL" pnpm exec tsx scripts/integration-db-lifecycle.ts drop
	if psql "$BOOTSTRAP_TEST_DATABASE_URL" -Atc 'SELECT 1' >/dev/null 2>&1; then exit 1; fi
	database_created=0
)
```

Expected: the parser tests plus verified import ordering establish refusal
before connection; the remote smoke exits nonzero with exactly the fixed
allowlisted failure line. Two local runs emit exactly the created/no-op lines;
one Admin and one credential account exist, no session or business row is
created, and the disposable database and logs are removed even on failure.

### Step 7: Run the complete reproducible setup gate

Run this gate in a clean plan worktree containing no `.env`, `.env.local`,
`.env.production`, or `.env.production.local`; Next must not load a developer's
ignored values while proving the tracked contract. Do not move, delete, or
inspect an existing developer env file to satisfy this condition—use a clean
worktree. Recreate the guarded disposable DB for the build, generate only
ephemeral shell secrets, and clean up on every exit:

```bash
(
	set -euo pipefail
	set +x
	for file in .env .env.local .env.production .env.production.local; do test ! -e "$file"; done
	: "${BOOTSTRAP_TEST_DATABASE_URL:?set a new exact-name loopback PostgreSQL URL}"
	database_created=0
	cleanup() {
		status=$?
		trap - EXIT
		if [ "$database_created" = "1" ]; then
			TEST_DATABASE_URL="$BOOTSTRAP_TEST_DATABASE_URL" pnpm exec tsx scripts/integration-db-lifecycle.ts drop || exit 97
		fi
		unset DATABASE_URL BETTER_AUTH_SECRET REVALIDATE_SECRET NEXT_PUBLIC_APP_URL BETTER_AUTH_BASE_URL
		exit "$status"
	}
	trap cleanup EXIT

	pnpm install --frozen-lockfile
	git diff --exit-code -- pnpm-lock.yaml
	pnpm exec vitest run src/lib/bootstrap-admin.test.ts src/lib/setup-contract.test.ts
	pnpm check
	TEST_DATABASE_URL="$BOOTSTRAP_TEST_DATABASE_URL" pnpm exec tsx scripts/integration-db-lifecycle.ts create
	database_created=1
	export DATABASE_URL="$BOOTSTRAP_TEST_DATABASE_URL"
	test "$(psql "$DATABASE_URL" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")" = "0"
	DATABASE_URL="$DATABASE_URL" pnpm db:push --force
	export BETTER_AUTH_SECRET="$(node -p 'require("node:crypto").randomBytes(48).toString("base64")')"
	export REVALIDATE_SECRET="$(node -p 'require("node:crypto").randomBytes(32).toString("hex")')"
	export NEXT_PUBLIC_APP_URL='http://localhost:3000'
	export BETTER_AUTH_BASE_URL='http://localhost:3000'
	pnpm build
	TEST_DATABASE_URL="$BOOTSTRAP_TEST_DATABASE_URL" pnpm exec tsx scripts/integration-db-lifecycle.ts drop
	if psql "$BOOTSTRAP_TEST_DATABASE_URL" -Atc 'SELECT 1' >/dev/null 2>&1; then exit 1; fi
	database_created=0
)
git diff --check
git diff --exit-code -- pnpm-lock.yaml src/lib/auth.ts src/db/schema.ts drizzle
git -c status.branch=false status --short
```

Expected: frozen install, guarded disposable schema push, 11 focused tests,
the complete quality gate, production build using only explicit test values,
cleanup, and diff checks pass. Compared with the recorded baseline, status
adds only the in-scope paths. Update Plan 016's status row only when the tracked
index is executor-owned.

Stage each suggested commit's exact paths separately. Before each commit, run
`git diff --cached --check`, `git diff --cached --name-only`, and
`git diff --cached`; this is required because ordinary `git diff --check` does
not inspect the new `.env.example`, seed, helper, or tests until staged. The
cached diffs must contain no path outside Scope and must include every new file
in full. Then commit with the Conventional Commit messages above.

## Test plan

- Eight pure bootstrap tests cover local/remote environment policy,
  validation, same-admin idempotency, existing-account refusals, exact
  create/promote behavior, cleanup, and secret-safe error surfaces.
- Three repository-contract tests cover exact environment names/placeholders,
  documented script existence/local links, and current CONTEXT commands without
  taking ownership of Plan 013's analytics prose.
- Disposable PostgreSQL smoke proof exercises the installed Better Auth admin
  API, credential hashing/account linkage, exact role promotion, repeated no-op,
  refusal backed by parser/import-order tests, exact allowlisted output, and no
  business/session writes.
- Full `pnpm check`, guarded disposable `pnpm db:push`, and `pnpm build` prove
  the tracked setup contract integrates with the repository after Plan 006.

## Done criteria

- [ ] `.env.example` is tracked, contains only the exact classified names and
      sanitized placeholders, keeps all bootstrap inputs comment-only, and no
      other `.env*` file is tracked.
- [ ] The former ignored seed was handled by the operator after a
      non-disclosing scan; no old value appears in Git, logs, or task output.
- [ ] `pnpm auth:bootstrap-admin` uses headerless Better Auth `createUser`,
      creates a normal user, and promotes only its exact ID/email/current role.
- [ ] Plan 001's `disableSignUp: true` remains unchanged and no bootstrap code
      calls `signUpEmail`.
- [ ] Same-email admin reruns are no-ops; existing non-admin and different-admin
      states refuse; promotion failure cleans up only the newly created user;
      a create rejection with no returned ID performs no guessed deletion and
      requires manual review.
- [ ] Remote/shared URLs require the exact narrow acknowledgement; local URLs
      do not. No acknowledgement value is stored in the tracked template.
- [ ] No CLI output/error contains password, database URL, email, ID, raw error,
      query, or environment dump; output matches the three fixed allowlisted
      lines, bootstrap inputs are removed from `process.env`, and query timing
      is forced off before DB imports.
- [ ] README setup commands exist, production `db:push` safety is explicit,
      public signup stays disabled, and CONTEXT uses the real `pnpm` commands
      while preserving Plan 013's analytics documentation.
- [ ] 11 focused tests, `pnpm check`, guarded disposable `pnpm db:push`, and
      `pnpm build` pass.
- [ ] Disposable smoke/build databases and temporary logs are removed on
      success and failure; smoke creates one Admin/credential account and no
      session or business data.
- [ ] `pnpm-lock.yaml`, auth config, and schema are unchanged; no migration
      history is generated.
- [ ] `git diff --check` and both staged-diff checks pass; cached commits contain
      only Scope paths.
- [ ] Plan 016's index row is `DONE` only when the tracked index is
      executor-owned; an untracked or dispatcher-owned index is untouched.

## Operational acceptance and rollback

Implementation verification mutates only exact-name disposable loopback
databases. Running the bootstrap against a shared environment is a separate
operator action requiring an approved change, a verified current schema, an
independently confirmed absence of any Admin, the exact one-invocation
acknowledgement, and password entry via silent shell input rather than a command
argument. After an authorized run, acceptance requires exactly one Admin, a
working credential sign-in, no unexpected auth/business rows, and immediate
unsetting of bootstrap inputs and the acknowledgement.

- Before any shared bootstrap, revert the two repository commits in reverse
  order to remove the CLI/template/docs. Use the repository's guarded
  integration-database lifecycle helper to drop any interrupted disposable
  database; remove only the ignored temporary logs.
- A Git revert does not remove or disable an Admin already created in an
  authorized environment. Never delete the only Admin as a rollback. Establish
  and verify an approved replacement/recovery path first, then rotate/revoke the
  affected credential and sessions through the authenticated/operator-owned
  account process.
- If Better Auth creation failed before returning an ID, cleanup failed, or an
  unpromoted target remains, stop and require manual auth-table review under the
  operator's backup/change process. Do not rerun blindly or delete by email.

## STOP conditions

Stop and report; do not improvise if:

- Any prerequisite plan is incomplete: public signup must already be disabled,
  query parameters redacted, the quality gate green, and dependencies current.
- The Step 1 scanner finds any non-placeholder environment value or literal
  name/email/password structure. Report only key/field name and line; never
  print or copy the value. The executor may not overwrite, move, delete, or
  commit unknown user material.
- The operator has not confirmed that exposed bootstrap credentials were
  rotated and the old ignored seed was securely handled outside the repo.
- Installed Better Auth no longer permits trusted headerless
  `auth.api.createUser` without an existing session, no longer hashes/links a
  supplied password, or Plan 001 makes that admin API unavailable. Do not
  reopen signup or hand-build credential rows.
- A requested email already belongs to a non-admin, any different admin exists,
  or conditional promotion does not update exactly the newly created user.
- Another bootstrap invocation may be concurrent, or the operator requires
  crash/concurrency safety. This one-shot command guarantees only completed-run
  idempotency; a database-level lock is a separate design.
- A remote/shared target lacks the exact acknowledgement, or the operator
  treats the acknowledgement as general permission for schema push/deployment.
- The disposable test URL is non-loopback, non-empty, cloned from real users,
  or rejected by the guarded lifecycle helper; cleanup failure is itself a STOP.
- The production-build proof would load a developer `.env*` file. Use a clean
  plan worktree; do not inspect, move, or delete the developer file.
- Plan 013's analytics documentation has drifted. Preserve it and limit this
  plan's CONTEXT edit to the three package commands.
- Completing setup requires a schema change, generated migration history,
  sample business data, new dependency, auth-policy change, CI redesign, or
  any out-of-scope file.
- A fixed CLI message or test failure exposes input data, raw errors, URLs,
  queries, hashes, tokens, or credentials.
- A verification fails twice after one focused in-scope correction.

## Maintenance notes

- Reviewers should inspect ignored-file handling, remote-target refusal, the
  headerless Better Auth call, exact promotion predicate, cleanup path, and all
  logging before reviewing prose.
- `auth.api.createUser` is intentionally called without request/headers only in
  this one-shot server CLI. The public admin endpoint still requires a session;
  do not reuse this pattern in routes or client-triggerable actions.
- If Better Auth changes its internal server-call authorization or credential
  account behavior, stop and revalidate the local smoke test before upgrading.
- The bootstrap is for one operator-run first-admin action, not concurrent
  provisioning. If concurrent/bootstrap automation becomes a requirement,
  design a database-level lock separately rather than widening this script.
- Keep `.env.example` values as placeholders. Add a variable only with its
  owning consumer, required/optional classification, and setup-contract test.
- The shared-database acknowledgement authorizes only first-admin creation. It
  never authorizes `db:push`, deployment, or another production change.
