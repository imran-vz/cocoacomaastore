# Plan 012: Upgrade vulnerable production dependency cohorts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 848e31d..HEAD -- package.json pnpm-lock.yaml src/db/schema.ts src/lib/auth.ts src/lib/auth-client.ts src/lib/auth/admin-access.ts src/lib/auth.test.ts src/lib/auth/admin-access.test.ts src/lib/admin-account-deletion.test.ts src/lib/auth-drizzle.integration.test.ts src/test/integration/database.ts src/app/admin/settings/managers/actions.ts src/app/admin/settings/managers/actions.test.ts trigger.config.ts src/trigger/analytics.ts scripts/trigger-analytics.ts scripts/run-integration-tests.sh scripts/integration-db-lifecycle.ts scripts/test-database-url.ts drizzle.config.ts drizzle.integration.config.ts vitest.integration.config.ts docs/security/dependency-upgrade-2026-07-15.md plans/README.md`
> Plans 001 and 004 are expected to have changed auth policy and tests; Plans
> 006-007 are expected to have changed the quality/integration harness and the
> index. Compare those changes against the
> prerequisite descriptions below. Also run `git status --short` and account
> for every working-tree change in the scoped paths; the commit-range diff does
> not show unstaged or untracked drift.
> Any other mismatch affecting dependency versions, auth permissions/schema, or
> Trigger task configuration is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/001-disable-public-self-registration.md`, `plans/004-protect-admin-account-deletion.md`, `plans/006-establish-green-quality-gate.md`, `plans/007-add-database-lifecycle-reporting-tests.md`
- **Category**: security
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The production dependency audit currently reports 19 advisories, including 10
high-severity advisories. Direct vulnerable versions include Better Auth
1.6.11 and Drizzle ORM 0.41.0; Trigger.dev 4.4.6 also carries vulnerable
`systeminformation`, `protobufjs`, and `ws` paths, while Better Auth's test
cohort carries a vulnerable Vite path. Upgrade the two compatibility cohorts
independently so auth/database and background-job regressions are isolated and
reviewable.

This plan does not assume that upgrading direct packages makes the final audit
perfect. It requires the patched direct versions, reruns the production audit
after each cohort, and records every residual advisory by dependency path so an
upstream-only residual remains visible without introducing forced overrides.

## Current state

- Registry evidence verified on 2026-07-15:
  - Better Auth latest is `1.6.23`; its relevant advisory is patched at
    `>=1.6.13`, and Better Auth 1.6.23 requires Drizzle ORM `^0.45.2`.
  - Drizzle ORM latest/patched is `0.45.2`.
  - `@trigger.dev/sdk`, `@trigger.dev/build`, and the `trigger.dev` CLI latest
    versions are all `4.5.4` and must remain in lockstep.
  - Trigger 4.5.4 still pins `@opentelemetry/core@2.7.1` and
    `socket.io@4.7.4`; current advisories may therefore remain through
    upstream-owned OpenTelemetry and `engine.io -> ws` paths after the direct
    Trigger upgrade. This cohort is not expected to guarantee a clean audit.
- `package.json:29-36,61-68` currently declares the vulnerable/direct cohort:

  ```json
  "@trigger.dev/sdk": "4.4.6",
  "better-auth": "^1.6.11",
  "drizzle-orm": "^0.41.0",
  "@trigger.dev/build": "4.4.6",
  "trigger.dev": "4.4.6"
  ```

- `pnpm-lock.yaml` currently resolves Better Auth `1.6.11`, Drizzle ORM
  `0.41.0`, all three Trigger packages at `4.4.6`, `systeminformation@5.23.8`,
  `protobufjs@7.6.0`, `@opentelemetry/core@2.0.1`, `ws@8.17.1` and
  `8.20.1`, and `vite@8.0.13`.
- The verified baseline command `pnpm audit --prod --audit-level high` exits
  non-zero with 19 total/10 high advisories. The additional advisory observed
  on 2026-07-16 is `1123570`, another `systeminformation` command-injection
  issue on the existing Trigger host-metrics path, patched in `>=5.31.7`.
  Important current paths are:
  - `better-auth@1.6.11` — direct Better Auth advisory;
  - `drizzle-orm@0.41.0` — direct SQL identifier-injection advisory;
  - `@trigger.dev/sdk -> @trigger.dev/core -> @opentelemetry/host-metrics -> systeminformation`;
  - `@trigger.dev/sdk -> @trigger.dev/core -> @opentelemetry/otlp-transformer -> protobufjs`;
  - `@trigger.dev/sdk -> @trigger.dev/core -> @opentelemetry/core`;
  - `@trigger.dev/sdk -> @trigger.dev/core -> socket.io/engine.io -> ws` and a
    direct SDK `ws` path;
  - `better-auth -> vitest -> vite`.
- `src/lib/auth.ts:10-31` uses Better Auth's Drizzle PostgreSQL adapter and
  explicitly maps the four application auth tables:

  ```ts
  database: drizzleAdapter(db, {
	provider: "pg",
	schema: {
		user: schema.userTable,
		session: schema.sessionTable,
		account: schema.accountTable,
		verification: schema.verificationTable,
	},
  }),
  emailAndPassword: { enabled: true, /* password callbacks */ },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  ```

  Plan 001 must have added `disableSignUp: true`. Plan 004 must have replaced
  the inline Admin options with `adminPluginOptions` from
  `src/lib/auth/admin-access.ts`; that custom role map preserves `user:create`
  but deliberately denies direct `user:delete` and `user:set-role`. The upgrade
  must preserve both policies exactly, not restore new plugin defaults.
- `src/db/schema.ts:243-323` defines the Better Auth user, session, account, and
  verification tables, including Admin plugin fields. The upgrade must not
  change this checkpoint or add generated schema artifacts unless a separate
  schema decision is approved.
- Drizzle is used across transactions, relations, SQL fragments, `for("update")`,
  `onConflictDoUpdate`, and Effect's shared database service. Plan 007's real
  PostgreSQL lifecycle/reporting suite is the compatibility gate; typecheck
  alone is insufficient.
- Trigger packages have three roles:
  - `trigger.config.ts:1-22` imports `defineConfig` from the SDK and points at
    `./src/trigger`;
  - `src/trigger/analytics.ts:1-47` declares scheduled daily/monthly tasks;
  - `scripts/trigger-analytics.ts:1-29` uses typed `tasks.trigger` for manual
    operator dispatch.
  `package.json:17-20` exposes `trigger:dev`, `trigger:deploy`, and manual
  analytics commands. Do not run a real deployment or trigger a task in this
  plan.
- Plan 006 provides `pnpm check`; Plan 007 provides the guarded disposable
  PostgreSQL `cocoacomaa_test` harness. That harness creates the test database,
  applies the current `src/db/schema.ts` checkpoint with `drizzle-kit push`,
  runs the integration suite, and drops the database. Reuse
  `pnpm test:integration` as the authoritative Drizzle compatibility gate and
  require no schema, Drizzle configuration, or integration-runner diff.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Frozen baseline | `pnpm install --frozen-lockfile` | exit 0; lockfile unchanged |
| Cohort A install | `pnpm add better-auth@1.6.23 drizzle-orm@0.45.2` | exit 0; only the Better Auth/Drizzle direct cohort and required transitives change |
| Cohort B install | `pnpm add --save-exact @trigger.dev/sdk@4.5.4 && pnpm add --save-exact --save-dev @trigger.dev/build@4.5.4 trigger.dev@4.5.4` | exit 0; all three Trigger packages resolve to 4.5.4 |
| Production audit | `pnpm audit --prod --audit-level high` | run and record after baseline and each cohort; exit may remain non-zero only for documented residual paths |
| Unit gate | `pnpm check` | exit 0 |
| Focused auth policy gate | `pnpm exec vitest run src/lib/auth.test.ts src/lib/auth/admin-access.test.ts src/lib/admin-account-deletion.test.ts src/app/admin/settings/managers/actions.test.ts` | exit 0; only the four named files run |
| Integration gate | `TEST_DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' pnpm test:integration` | exit 0; disposable DB is dropped afterward |
| Build | `pnpm build` | exit 0 |
| Trigger version | `pnpm exec trigger --version` | exact output `4.5.4` after Cohort B |
| Trigger build smoke | `pnpm exec trigger deploy --env prod --dry-run --skip-update-check --skip-telemetry --skip-sync-env-vars` | exits successfully after compiling/configuring both tasks; creates no deployment |
| Patch hygiene | `git diff --check` | exit 0 |

Use pnpm only. Never use `npm`, `yarn`, `pnpm audit --fix`, `--force`, a
`pnpm.overrides` entry, or a manual nested lockfile edit.

## Scope

**In scope** (the only files you should modify):

- `package.json`
- `pnpm-lock.yaml`
- `src/lib/auth-drizzle.integration.test.ts` (create)
- `docs/security/dependency-upgrade-2026-07-15.md` (create)
- `src/lib/auth.ts` — minimal 1.6.23 import/type adaptation only, if required
- `src/lib/auth-client.ts` — minimal 1.6.23 import/type adaptation only, if required
- `src/lib/auth/admin-access.ts` — minimal 1.6.23 import/type adaptation only, if required
- `src/lib/auth.test.ts` — minimal test API adaptation only, if required
- `src/lib/auth/admin-access.test.ts` — minimal test API adaptation only, if required
- `src/app/admin/settings/managers/actions.ts` — minimal Better Auth API type adaptation only, if required
- `src/app/admin/settings/managers/actions.test.ts` — minimal test API adaptation only, if required
- `trigger.config.ts` — minimal 4.5.4 API adaptation only, if required
- `src/trigger/analytics.ts` — minimal 4.5.4 API/type adaptation only, if required
- `scripts/trigger-analytics.ts` — minimal 4.5.4 API/type adaptation only, if required
- `plans/README.md` — update only Plan 012's status row at completion

**Out of scope** (do NOT touch):

- `src/db/schema.ts`, generated schema artifacts, Drizzle configuration, the
  integration database runner, or any production database data.
- Auth roles, Plan 001's `disableSignUp: true`, password hashing/verification,
  session lifetime/cookies, trusted origins, or Plan 004's custom permissions.
- Account-management behavior, Admin deletion transactions/UI, login UX, or a
  new auth feature/provider.
- Drizzle query refactors, schema API modernization, repository abstractions,
  or unrelated TypeScript cleanup.
- Trigger project ID, task IDs, cron patterns/time zones, retry behavior,
  payloads, analytics logic, environment synchronization, or task execution.
- Real Trigger deployment, promotion, schedule mutation, or manual task
  dispatch. Never run `pnpm trigger:deploy`, `trigger deploy` without
  `--dry-run`, or any `analytics:trigger*` command.
- Any package other than the five named direct dependencies. Do not update
  Vitest/Vite, Drizzle Kit, Next.js, Zod, Effect, pnpm, or Node directly to make
  an audit warning disappear.
- Forced transitive resolutions. Residual upstream advisories must be recorded,
  not hidden with overrides.

## Git workflow

- Branch: `feat/012-upgrade-production-dependencies`
- Suggested commits:
  1. `fix(deps): upgrade Better Auth and Drizzle`
  2. `test(auth): smoke test the upgraded Drizzle adapter`
  3. `fix(deps): upgrade Trigger.dev packages`
  4. `docs(security): record dependency audit residuals`
- Use Conventional Commits without co-author trailers. Do not push or open a PR
  unless instructed. Stage no unrelated plans or user changes.
- `git diff --check` does not inspect new untracked files. Before every commit,
  stage only that commit's intended in-scope files and run
  `git diff --cached --check`; never stage the other plans to make this check
  convenient.

## Steps

### Step 1: Confirm prerequisites, registry evidence, and baseline audit

Confirm Plans 001, 004, 006, and 007 are `DONE`; create or switch to the
branch from Git workflow, run the drift check and frozen install, and confirm
the branch name. Verify Plan 001's signup test, Plan 004's custom Admin
permission tests, and Plan 007's create → `drizzle-kit push` → test → drop
integration runner before changing packages. After that reconciliation,
capture the exact prerequisite baseline so later checks still detect
prohibited changes after intermediate commits:

```bash
git rev-parse HEAD > /tmp/cocoacomaa-plan-012-start
test -s /tmp/cocoacomaa-plan-012-start
```

Record that commit hash in the evidence document as `Plan start`. Query the
exact planned registry versions and relevant independent/upstream metadata:

If the temporary reference is lost later, recreate it only from the recorded
full `Plan start` hash after `git cat-file -e <hash>^{commit}` succeeds. Never
replace it with the then-current `HEAD`.

```bash
pnpm view better-auth@1.6.23 version peerDependencies --json
pnpm view @better-auth/cli@1.4.21 version dependencies --json
pnpm view drizzle-orm@0.45.2 version
pnpm view @trigger.dev/sdk@4.5.4 version
pnpm view @trigger.dev/build@4.5.4 version
pnpm view @trigger.dev/core@4.5.4 version dependencies --json
pnpm view trigger.dev@4.5.4 version
```

Expected: all five versions exist exactly; Better Auth's Drizzle compatibility
includes `^0.45.2`; the independent CLI exists at 1.4.21; and Trigger core's
metadata explains any expected upstream residuals. Do not silently substitute
newer versions if the registry has moved.

Create `docs/security/dependency-upgrade-2026-07-15.md`. Start a table with
checkpoint, total/high counts, advisory ID, severity, vulnerable package,
installed version, affected/patched range, shortest `pnpm why` path, and
disposition. Include the literal summary `19 total / 10 high`, plus every
important path in Current state. Store raw JSON only in `/tmp`, not Git, and do
not record credentials/environment values.

Capture the baseline without hiding malformed/network failures:

```bash
set +e
pnpm audit --prod --audit-level high --json > /tmp/cocoacomaa-audit-baseline.json
audit_status=$?
set -e
case "$audit_status" in 0|1) ;; *) exit "$audit_status" ;; esac
node -e 'const x=JSON.parse(require("node:fs").readFileSync("/tmp/cocoacomaa-audit-baseline.json", "utf8")); const v=x.metadata?.vulnerabilities; if (!v || !x.advisories || Array.isArray(x.advisories)) throw new Error("invalid audit payload"); const total=Object.values(v).reduce((a,n)=>a+n,0); if (total !== 19 || v.high !== 10) throw new Error(`unexpected baseline: ${total} total / ${v.high} high`)'
test "$audit_status" -ne 0
pnpm why better-auth drizzle-orm systeminformation protobufjs @opentelemetry/core ws vite --prod
```

Use the same exit-code and JSON-shape validation for later captures, but do not
reuse the baseline-specific 19/10 or non-zero assertions: a later audit may
legitimately return zero.

**Verify**:

- `test "$(git branch --show-current)" = "feat/012-upgrade-production-dependencies"` → exit 0.
- `pnpm check` → exit 0.
- Focused auth policy gate from the Commands table → exit 0 and Vitest reports
  only the four named files.
- `rg -n '19 total / 10 high|better-auth|drizzle-orm|systeminformation|protobufjs|@opentelemetry/core|ws|vite' docs/security/dependency-upgrade-2026-07-15.md` → baseline counts and every important path are recorded.

### Step 2: Upgrade Cohort A — Better Auth and Drizzle together

Run exactly:

```bash
pnpm add better-auth@1.6.23 drizzle-orm@0.45.2
```

Do not upgrade either package alone: Better Auth 1.6.23's adapter requires the
new Drizzle cohort. Preserve package.json's existing caret convention for these
two dependencies; the lockfile itself must resolve exact 1.6.23/0.45.2.

Run typecheck and the focused auth tests immediately. If 1.6.23 changed an
import/type shape, make only the smallest in-scope compatibility edit that
preserves behavior. In particular, `disableSignUp: true` and Plan 004's custom
`adminPluginOptions` must remain explicit, and all four Admin endpoint-policy
tests must retain their original assertions.

**Verify**:

- `pnpm list better-auth drizzle-orm --depth 0` → exact installed versions 1.6.23 and 0.45.2.
- `node -e 'const d=require("./package.json").dependencies; if (d["better-auth"] !== "^1.6.23" || d["drizzle-orm"] !== "^0.45.2") process.exit(1)'` → the intended caret ranges are preserved.
- `pnpm typecheck` → exit 0.
- Focused auth test command from Step 1 → exit 0 with the same policy coverage.
- `rg -n 'disableSignUp: true|admin\(adminPluginOptions\)' src/lib/auth.ts` → both preserved policies are found.

### Step 3: Add a real auth/Drizzle boundary smoke test and check schema drift

Create `src/lib/auth-drizzle.integration.test.ts` using Plan 007's owned
PostgreSQL fixture and module-mocking conventions. Mock `@/db` to its
`integrationDb`, set fixed test-only Better Auth URL/secret values before the
dynamic auth import, reset rows before each test, and close only the fixture's
owned client as Plan 007 requires. Never import the production database client.

Add exactly two integration tests through the real auth handler and guarded
application action:

1. Seed a fixed fake Admin user and credential account using a bcrypt hash.
   Assert public `POST /api/auth/sign-up/email` still returns Plan 001's disabled
   signup error; then sign in through `POST /api/auth/sign-in/email`, pass the
   returned cookie to `GET /api/auth/get-session`, and assert the persisted
   Admin session/user is returned.
2. Configure the mocked `next/headers` boundary with the authenticated Admin
   cookie and assert `createManager` provisions both supported roles through
   the app-owned `requireAdmin` guard and trusted server-side
   `auth.api.createUser` call. Better Auth 1.6.23 requires `user:set-role` for
   an authenticated HTTP `create-user` request carrying a role, which would
   also grant the forbidden direct role-change endpoint. Therefore the guarded
   action must not forward request headers into the trusted creation call.
   Direct HTTP remove-user and set-role endpoints must remain forbidden and
   leave the database row/role unchanged, matching Plan 004.

Reuse the endpoint/body conventions established by Plans 001/004. Those unit
tests do not establish sign-in response-cookie extraction, so add a small
test-local helper that reads `response.headers.getSetCookie()`, asserts a
session cookie was returned, and converts only each cookie's `name=value` pair
into the next request's `Cookie` header. Do not hard-code internal adapter
functions. These tests cover Better Auth, its Drizzle adapter, the current
schema, bcrypt callbacks, sessions, the application guard, trusted
provisioning, and direct endpoint denials together.

Generate Better Auth's schema to a temporary file only:

```bash
DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test' \
BETTER_AUTH_SECRET='test-only-plan-012-secret-at-least-32-characters' \
BETTER_AUTH_BASE_URL='http://localhost:3000' \
pnpm dlx @better-auth/cli@1.4.21 generate \
  --config src/lib/auth.ts \
  --output /tmp/cocoacomaa-better-auth-schema.ts \
  --yes
```

`@better-auth/cli` has an independent release line and 1.4.21 bundles Better
Auth 1.4.21/Drizzle 0.41-era generator dependencies. Treat its output as a
secondary compatibility signal, not proof about the 1.6.23 runtime. The two
real boundary integration tests above are the authoritative adapter/schema
gate. If the CLI cannot load the upgraded config or its output disagrees with
the runtime-backed test/schema review, STOP; do not downgrade the application
packages to satisfy the CLI.

Compare the generated user/session/account/verification fields and Admin plugin
fields with `src/db/schema.ts:243-323`. No generated file may be copied into the
repository. If the upgraded package requires a missing field, index, type, or
table, STOP and route that schema decision to a separate plan; do not change the
current production checkpoint in this dependency upgrade.

**Verify**:

- Integration command from the Commands table → exit 0; the new file reports exactly 2 passing tests and the disposable DB is dropped.
- `test -s /tmp/cocoacomaa-better-auth-schema.ts` → exit 0.
- `git diff --exit-code "$(cat /tmp/cocoacomaa-plan-012-start)" -- src/db/schema.ts drizzle.config.ts drizzle.integration.config.ts scripts/run-integration-tests.sh scripts/integration-db-lifecycle.ts scripts/test-database-url.ts` → exit 0; no schema, Drizzle configuration, or integration-runner drift, including changes already committed during this plan.
- `pnpm check && pnpm build` → exit 0.

### Step 4: Audit and record Cohort A before touching Trigger

Rerun the audit to `/tmp/cocoacomaa-audit-cohort-a.json` using Step 1's
exit-code and JSON-shape validation, without its baseline-specific count or
non-zero assertions. Update the tracked evidence table with the new total/high
counts and every residual advisory ID/package/path. Run `pnpm why` for each
residual package.

The Better Auth and Drizzle direct advisories must be absent. Trigger-related
and other upstream advisories may remain at this checkpoint. A non-zero audit
exit is acceptable only when the JSON is valid and every remaining advisory is
recorded by path; it is not permission to ignore a still-vulnerable Better Auth
or Drizzle resolution.

**Verify**:

- `pnpm list better-auth drizzle-orm --depth 0` → 1.6.23 and 0.45.2.
- `rg -n 'Cohort A|1\.6\.23|0\.45\.2|residual' docs/security/dependency-upgrade-2026-07-15.md` → Cohort A outcome is recorded.
- `git diff --check` → exit 0.

Stage only the files for each of the first two suggested commits and run
`git diff --cached --check` before committing. Commit Cohort A and its auth test
before proceeding so Cohort B can be reverted independently if necessary.

### Step 5: Upgrade Cohort B — all Trigger packages in lockstep

Run exactly:

```bash
pnpm add --save-exact @trigger.dev/sdk@4.5.4
pnpm add --save-exact --save-dev @trigger.dev/build@4.5.4 trigger.dev@4.5.4
```

Run typecheck immediately. Make only minimal in-scope API/type adaptations if
4.5.4 requires them. Preserve the project reference, task IDs
`daily-analytics`/`monthly-analytics`, both cron patterns/time zones, retry
configuration, task payloads, and manual dispatch behavior.

**Verify**:

- `pnpm list @trigger.dev/sdk @trigger.dev/build trigger.dev --depth 0` → all three resolve exactly to 4.5.4.
- `node -e 'const p=require("./package.json"); if (p.dependencies["@trigger.dev/sdk"] !== "4.5.4" || p.devDependencies["@trigger.dev/build"] !== "4.5.4" || p.devDependencies["trigger.dev"] !== "4.5.4") process.exit(1)'` → all direct Trigger specifiers are exact and remain in their original dependency sections.
- `test "$(pnpm exec trigger --version)" = "4.5.4"` → exit 0.
- `pnpm typecheck && pnpm check && pnpm build` → exit 0.
- `rg -n 'daily-analytics|monthly-analytics|Asia/Calcutta|10 0 \* \* \*|20 0 1 \* \*' src/trigger/analytics.ts` → existing task IDs, zones, and schedules remain.

### Step 6: Smoke Trigger safely without deploying or running analytics

First verify the upgraded CLI exposes both safe commands:

```bash
pnpm exec trigger dev --help
pnpm exec trigger deploy --help
```

Expected: both exit 0; deploy help contains `--dry-run`. The project has no
staging environment, so the operator explicitly approved the production-
environment dry-run after the staging initialization failed before packaging.
Run only the production dry-run command from the Commands table using the
authenticated operator profile. It may contact Trigger.dev and build/package the two tasks,
but `--dry-run` must prevent deployment. Do not remove `--dry-run`, sync env
vars, promote, invoke either task, or leave a `trigger dev` process running.

For a dev-mode smoke, start `pnpm exec trigger dev --skip-update-check
--skip-telemetry` interactively only if the operator has an approved local
Trigger profile and test environment. Stop it with Ctrl-C immediately after it
loads the config and discovers both scheduled task IDs; do not trigger a run.
If no approved profile exists, record "not run — no approved local profile" in
the evidence document. The production-environment command remains a dry-run;
lack of credentials is a STOP condition, not permission to perform a real
deployment.

**Verify**:

- `pnpm exec trigger deploy --help | rg -- '--dry-run'` → finds the safety flag.
- Trigger build smoke command → exit 0 and reports dry-run/no deployment.
- `git status --short` → no generated Trigger files outside the in-scope list; remove only known temporary build output, never user files.

### Step 7: Audit and record the final residual paths

Rerun the audit to `/tmp/cocoacomaa-audit-cohort-b.json` with Step 1's generic
exit-code/JSON-shape validation, not its baseline count/non-zero assertions.
Update the evidence document with final total/high counts and one row per
residual advisory ID/package/path, including patched-version availability and
whether remediation is upstream-blocked. Explicitly determine whether Trigger
core's `@opentelemetry/core@2.7.1` and `engine.io -> ws` paths remain; do not
assume the direct Trigger upgrade removed them. Use
`pnpm why <package> --prod` for every residual; do not infer reachability solely
from package names.

Do not promise a zero-advisory result. If the audit exits zero, record zero. If
it remains non-zero, it is acceptable only when none of the five direct
packages is still on the vulnerable version/range, each residual path is
documented, and fixing it would require an unrelated direct upgrade or forced
override. Never copy raw JSON into Git.

**Verify**:

- `pnpm list better-auth drizzle-orm @trigger.dev/sdk @trigger.dev/build trigger.dev --depth 0` → exact 1.6.23, 0.45.2, and 4.5.4/4.5.4/4.5.4 resolutions.
- `rg -n 'Final|Cohort B|residual|upstream|4\.5\.4' docs/security/dependency-upgrade-2026-07-15.md` → final audit disposition is recorded.
- `! git diff "$(cat /tmp/cocoacomaa-plan-012-start)" -- package.json pnpm-workspace.yaml | rg '^\+.*(overrides|patchedDependencies)'` → this plan added no forced resolution.

### Step 8: Run final gates and commit

Run all gates from the Commands table. Review `package.json` and ensure only the
five named direct dependency entries changed. Review the lockfile diff and
ensure other direct importer versions did not move; required transitive churn
inside either cohort is expected. Update only Plan 012's index status to `DONE`
after the gates pass, then make the remaining suggested commits. Before each
commit, stage only its intended in-scope files and run
`git diff --cached --check` so the new test and evidence document are checked.

**Verify**:

- `pnpm install --frozen-lockfile` → exit 0 and no diff.
- `pnpm check && pnpm build` → exit 0.
- Integration command → exit 0 and disposable DB cleanup succeeds.
- Focused auth test command → exit 0 with signup/custom-permission assertions unchanged.
- Trigger version and production-environment dry-run commands → exact version and successful no-deploy smoke.
- `git diff --exit-code "$(cat /tmp/cocoacomaa-plan-012-start)" -- src/db/schema.ts drizzle.config.ts drizzle.integration.config.ts scripts/run-integration-tests.sh scripts/integration-db-lifecycle.ts scripts/test-database-url.ts` → exit 0.
- `git diff "$(cat /tmp/cocoacomaa-plan-012-start)" -- package.json` → only the five intended direct specifiers are visible; inspect rather than relying on a post-commit working-tree diff.
- `git diff --check` → exit 0.
- `git status --short` → only in-scope files plus pre-existing untracked plans.

## Rollback

This plan changes packages and compatibility tests only; its schema-drift gate
forbids a database rollback requirement.

- Before an in-progress cohort is committed, STOP on failure and preserve the
  diff/audit output for review. Do not run another package-manager command to
  guess at a downgrade or manually repair the lockfile.
- After commits exist, revert in reverse cohort order. Revert the Trigger
  dependency commit to roll back Cohort B. To roll back Cohort A, revert the
  auth smoke-test commit before the Better Auth/Drizzle dependency commit. Keep
  the evidence document and append a rollback checkpoint rather than deleting
  the audit history.
- After each revert, run `pnpm install --frozen-lockfile`, verify the restored
  direct versions with `pnpm list --depth 0`, and rerun the focused auth gate,
  integration gate, and build. If a release containing the cohort was deployed,
  release the reverted application through the normal deployment process; no
  production schema operation or Trigger deployment is part of rollback.

## Test plan

- Preserve and rerun Plan 001's public-signup regression and Plan 004's four
  custom Admin permission cases after Better Auth 1.6.23, adapting
  provisioning to the guarded application action without granting
  `user:set-role`.
- Add two PostgreSQL boundary integration tests for disabled signup,
  email/password sign-in, session persistence, guarded Admin provisioning, and
  blocked direct deletion/role changes through the upgraded Drizzle adapter.
- Run all Plan 007 PostgreSQL order/reporting tests after Drizzle 0.45.2 to cover
  transactions, row locks, relations, inserts, SQL fragments, and analytics.
- Run `pnpm check` and production build after each cohort.
- Compile/package both Trigger tasks through the approved authenticated production-environment dry-run;
  do not deploy or execute a task.
- Record baseline, Cohort A, and Cohort B audits with advisory IDs and residual
  dependency paths.

## Done criteria

- [ ] Better Auth resolves to 1.6.23 and Drizzle ORM to 0.45.2 as one tested
      cohort, with manifest ranges `^1.6.23` and `^0.45.2`.
- [ ] SDK, build package, and Trigger CLI all resolve to exact 4.5.4 specifiers
      in lockstep and remain in their original dependency sections.
- [ ] No unrelated direct dependency, forced override, or manual nested lockfile edit exists.
- [ ] Public signup remains disabled; custom Admin provisioning remains allowed; direct Admin delete/set-role remains forbidden.
- [ ] Real PostgreSQL auth/session/Admin boundary smoke tests and all Plan 007 integration tests pass.
- [ ] Runtime-backed auth integration passes against the disposable database
      after `drizzle-kit push`; the independent CLI's generated schema raises
      no conflicting drift; no schema/configuration/harness file changed from
      the captured plan-start commit.
- [ ] Trigger config/tasks typecheck and the approved production-environment `deploy --dry-run` succeeds without deployment or task execution.
- [ ] Baseline and both cohort audits are recorded; every final residual
      advisory has an ID, affected/patched range, `pnpm why` path, and
      disposition.
- [ ] A non-zero final audit is accepted only for documented upstream/unrelated residuals; zero is not falsely promised.
- [ ] `pnpm check`, focused Vitest, `pnpm test:integration`, `pnpm build`,
      frozen install, `git diff --check`, and each pre-commit
      `git diff --cached --check` all pass.
- [ ] Plan 012 is `DONE` in `plans/README.md`, unless the dispatcher owns the index.

## STOP conditions

Stop and report; do not improvise if:

- Any prerequisite plan is incomplete or its signup, custom Admin permission,
  quality, or PostgreSQL harness tests are red.
- The working tree contains unexplained scoped drift, the plan-start commit was
  not captured before package edits, or neither the temporary reference nor a
  recorded/verifiable full hash is available for final cross-commit comparisons.
- Registry metadata no longer contains the exact planned versions, Better Auth
  1.6.23 does not support Drizzle 0.45.2, or a package manager proposes an
  unrelated direct dependency update.
- Better Auth 1.6.23 re-enables signup, changes password/session semantics, or
  cannot preserve Plan 004's permission outcome through the approved guarded
  action remodel: provisioning succeeds only after `requireAdmin`, while the
  role map continues denying direct delete/set-role endpoints.
- The independent Better Auth CLI cannot load the upgraded config, disagrees
  with the runtime-backed boundary tests/schema review, or indicates any
  missing/different table, field, index, or type. Do not change schema in this
  plan.
- Drizzle 0.45.2 breaks a production query/integration test in a way that needs
  query redesign rather than a mechanical compatibility fix.
- Either direct Better Auth/Drizzle advisory remains after Cohort A, or a named
  direct package remains on a vulnerable version after its cohort.
- Trigger 4.5.4 packages do not resolve in lockstep, change task/cron/payload
  semantics, or require project/environment changes.
- The Trigger smoke requests a real deployment/promotion, environment-variable
  sync, or task execution. Never remove `--dry-run` to get past a failure.
- No approved Trigger credential/profile is available for the mandatory
  production-environment dry-run. Report the blocked verification; never remove
  `--dry-run` or perform a real production deploy.
- Audit output is invalid/unavailable, a residual cannot be traced with
  `pnpm why`, or a residual can only be suppressed via force/override.
- Any command accesses a production database, copies real data, logs a secret,
  or writes outside the in-scope files.
- A verification fails twice after one reasonable in-scope compatibility fix.

## Maintenance notes

- Treat Better Auth/Drizzle and Trigger.dev as separate future update cohorts;
  never mix them into one unreviewable lockfile change.
- Keep Plan 001 and Plan 004 boundary regressions as permanent upgrade gates.
  New Better Auth plugin defaults must not replace application-owned policy.
- Better Auth's CLI has an independent version line; this plan uses the
  registry-verified `@better-auth/cli@1.4.21` only through `pnpm dlx` and does
  not add it to project dependencies. Its 1.4-era generator is supplemental;
  the upgraded runtime boundary tests remain authoritative.
- A clean audit today does not eliminate future advisories. CI dependency
  scanning can be considered separately after this one-time cohort upgrade.
- Reviewers should scrutinize direct importer versions, auth schema output,
  custom permission boundary results, Trigger dry-run logs, and every documented
  final residual path.
