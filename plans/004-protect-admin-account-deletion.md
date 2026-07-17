# Plan 004: Prevent deletion of the current or final administrator

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before continuing. If a
> STOP condition occurs, stop and report; do not improvise. When done, update
> only this plan's row in `plans/README.md`, unless the dispatcher owns the
> index.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat 848e31d..HEAD -- \
>   src/lib/auth.ts \
>   src/lib/auth/admin-access.ts \
>   src/lib/auth/admin-access.test.ts \
>   src/lib/admin-account-deletion.ts \
>   src/lib/admin-account-deletion.test.ts \
>   src/app/admin/settings/managers/actions.ts \
>   src/app/admin/settings/managers/actions.test.ts \
>   src/app/admin/settings/managers/component/manager-client-page.tsx
> git status --short -- \
>   src/lib/auth.ts \
>   src/lib/auth/admin-access.ts \
>   src/lib/auth/admin-access.test.ts \
>   src/lib/admin-account-deletion.ts \
>   src/lib/admin-account-deletion.test.ts \
>   src/app/admin/settings/managers/actions.ts \
>   src/app/admin/settings/managers/actions.test.ts \
>   src/app/admin/settings/managers/component/manager-client-page.tsx
> ```
>
> The status command is required because `git diff` omits untracked partial
> implementations. If an in-scope file changed, compare it with the excerpts
> below. Plans 001 and 002 may have added `disableSignUp: true` and a
> first-statement `requireAdmin()` in `getCachedManagers`; preserve those exact
> changes. Any other mismatch affecting auth roles, account deletion, or
> manager reads is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-disable-public-self-registration.md`, `plans/002-guard-server-action-readers.md`
- **Category**: security
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The current Admin action can delete its caller or the final persisted
administrator, which cascades through sessions and credential accounts. Two
Admins can also concurrently delete each other unless both mutations serialize
on the same locked Admin set. Enforce the persisted-Admin invariant on the
server inside one PostgreSQL transaction, remove Better Auth's direct
delete/role-change bypasses, and make the UI explain blocks without treating UI
state as authoritative. This plan does not guarantee that an Admin is currently
unbanned or has a live session; those are separate availability policies.

## Current state

- `src/app/admin/settings/managers/actions.ts:70-90` authorizes but discards the
  actor, then deletes without reading or locking the target:

  ```ts
  export async function deleteManager(id: string) {
	await requireAdmin();

	const { id: validatedId } = deleteManagerSchema.parse({ id });
	try {
		await runNextAppEffect(
			Effect.gen(function* () {
				const database = yield* Database;
				yield* database.attempt("delete manager", (db) =>
					db.delete(userTable).where(eq(userTable.id, validatedId)),
				);
			}),
		);
		return { success: true };
	} catch (error) {
		return { success: false, error: "Failed to delete manager" };
	}
  }
  ```

- `src/lib/auth/guards.ts:28-39,60-62` returns the authenticated user. Use
  `const actor = await requireAdmin()` and `actor.id`; do not add another
  session lookup or duplicate role checks.
- `src/db/schema.ts:244-260` stores roles on `userTable.role` as text, using
  `"admin"` and `"user"`. `src/db/schema.ts:264-306` cascades user deletion to
  sessions and credential accounts.
- `src/lib/auth.ts:28` installs Better Auth's default Admin policy:

  ```ts
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  ```

  In installed Better Auth 1.6.11 that policy grants `user:delete` and
  `user:set-role`. The catch-all auth handler therefore exposes
  `/api/auth/admin/remove-user`, `/api/auth/admin/set-role`, and role changes via
  `/api/auth/admin/update-user`. The built-in remove endpoint blocks only
  self-removal; cross-deletes can still race. The application provisions users
  through `auth.api.createUser`, which requires `user:create` and must continue
  supporting both `admin` and `user` roles.
- `src/app/admin/settings/managers/component/manager-client-page.tsx:68-80`
  displays the server error, but lines 174-186 render an enabled delete button
  for every row. `src/lib/auth-client.ts` exposes `authClient.useSession()`.
- Database writes normally use Drizzle transactions; see
  `src/lib/order-lifecycle.ts:292-329`. PostgreSQL row locks use Drizzle's
  `.for("update")`; see `src/lib/order-lifecycle.ts:197-205`.
- Vitest runs in Node. Follow the module mocking style in
  `src/lib/admin-reporting/admin-reporting.test.ts`. Better Auth 1.6.11 falls
  back to its built-in memory adapter when a test instance has no `database`
  option; its test-only `testUtils()` plugin supplies typed user/session helpers
  but is not itself the database.
- `scripts/seed-admin.ts:29-59` is a known operator-only role writer. Plan 001
  makes its `signUpEmail` creation branch unusable, and Plan 016 replaces the
  script with a guarded first-Admin bootstrap. Do not run or change this script
  here; it is not an application request path and must not be used for routine
  account management.
- Baseline: typecheck, 38 tests, and build pass. Full `pnpm lint` is red only for
  pre-existing formatting in `src/components/product-card.tsx`; use scoped
  Biome and do not edit that file.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm exec vitest run src/lib/auth/admin-access.test.ts src/lib/admin-account-deletion.test.ts src/app/admin/settings/managers/actions.test.ts` | exit 0; all focused tests pass |
| Scoped lint | `pnpm exec biome check src/lib/auth.ts src/lib/auth/admin-access.ts src/lib/auth/admin-access.test.ts src/lib/admin-account-deletion.ts src/lib/admin-account-deletion.test.ts src/app/admin/settings/managers/actions.ts src/app/admin/settings/managers/actions.test.ts src/app/admin/settings/managers/component/manager-client-page.tsx` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Full tests | `pnpm test` | exit 0 |
| Build | `pnpm build` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0, no output |

No package installation, schema push, migration, or live database is needed.

## Scope

**In scope** (the only source files to modify/create):

- `src/lib/auth.ts`
- `src/lib/auth/admin-access.ts` (create)
- `src/lib/auth/admin-access.test.ts` (create)
- `src/lib/admin-account-deletion.ts` (create)
- `src/lib/admin-account-deletion.test.ts` (create)
- `src/app/admin/settings/managers/actions.ts`
- `src/app/admin/settings/managers/actions.test.ts` (create)
- `src/app/admin/settings/managers/component/manager-client-page.tsx`
- `plans/README.md`, status-row update only

**Out of scope**:

- Role names, `src/lib/auth/guards.ts`, public signup, login, or session policy.
- Changing account creation fields or removing Admin/user provisioning.
- Database schema, triggers, migrations, dependencies, or lockfile.
- The operator-only `scripts/seed-admin.ts`; Plan 016 owns its replacement.
- A general role editor, account recovery flow, audit log, or soft deletion.
- Other Admin settings, Manager access, and the unrelated lint failure.

## Git workflow

- Branch: `feat/004-protect-admin-account-deletion`.
- Use Conventional Commits without co-author trailers. Preferred commits:
  `fix(auth): restrict direct admin account mutations`, then
  `fix(admin): protect administrator deletion`.
- Do not push or open a PR unless explicitly instructed.

## Steps

### Step 1: Restrict Better Auth to application-owned role/deletion flows

Confirm Plans 001 and 002 are `DONE`. Verify `disableSignUp: true` remains in
`src/lib/auth.ts` and `getCachedManagers()` calls `requireAdmin()` before its
query. These prerequisite changes share in-scope files and must be preserved.

Create `src/lib/auth/admin-access.ts`. Import `defaultAc` and `userAc` from
`better-auth/plugins/admin/access`, then export:

- an Admin role created with `defaultAc.newRole`;
- a role map `{ admin: applicationAdminRole, user: userAc }`; and
- one `adminPluginOptions` object containing the existing `defaultRole: "user"`
  and `adminRoles: ["admin"]`, plus `ac: defaultAc` and the role map.

Preserve the default Admin permissions `user:create`, `list`, `ban`,
`impersonate`, `set-password`, `get`, and `update`, and all existing session
permissions. Deliberately omit only `user:delete` and `user:set-role`. Omitting
`set-role` also blocks role changes submitted through `admin/update-user`.
Match the installed `adminAc` permission list: do not add
`user:impersonate-admins`, which the installed default Admin role does not have.
Change `src/lib/auth.ts` to `admin(adminPluginOptions)`; preserve all other auth
options, including Plan 001's `disableSignUp` if present.

Create `src/lib/auth/admin-access.test.ts` using a Better Auth in-memory test
instance with a fixed test-only secret, no `database` option,
`admin(adminPluginOptions)`, and `testUtils()`. Obtain the helpers from
`await auth.$context`, save exact-role users with `test.saveUser`, and create an
Admin session with `test.login`; exercise the HTTP handler with those returned
headers so status-code assertions cover the actual catch-all endpoints. Use
fixed fake test users/secrets only. Cover exactly these policies:

1. Admin `create-user` succeeds and can provision either supported role.
2. Admin `remove-user` returns HTTP 403 and leaves the target present.
3. Admin `set-role` returns HTTP 403 and leaves the role unchanged.
4. Admin `update-user` with `data.role` returns HTTP 403, while a non-role field
   update still succeeds so ordinary Admin update permission is preserved.

**Verify**: run the focused test command with only
`src/lib/auth/admin-access.test.ts` → all four tests pass without PostgreSQL.

### Step 2: Implement the locked deletion transaction

Create `src/lib/admin-account-deletion.ts` with a discriminated outcome:

```ts
export type DeleteManagerResult =
	| { success: true }
	| { success: false; error: string };
```

Export `deleteManagerAccount(database, actorId, targetId)`. It must perform one
`database.transaction` in this exact order:

1. Select every current Admin ID with `where(eq(userTable.role, "admin"))`,
   `orderBy(asc(userTable.id))`, then `.for("update")`. Do not use `count(*)`:
   aggregate rows cannot provide the required row locks. Locking all Admin rows
   first and in one deterministic order serializes cross-deletes and avoids
   each transaction locking a different target first.
2. Reject if `actorId` is absent from the locked Admin IDs with
   `"Your administrator account is no longer active"`.
3. Reject `actorId === targetId` with
   `"You cannot delete your own account"`. This also covers the sole/final
   Admin: after step 2, a sole Admin can only target itself. Do not add a
   separate `"last administrator"` result—the actor-presence and self checks
   make that branch unreachable.
4. If the target is in the locked Admin set, it is already locked and may be
   deleted. Because the target differs from the present actor, the locked set
   necessarily contained at least two Admins before deletion.
5. If the target is not an Admin, select that target row by ID with
   `.for("update")`. Return `"Manager not found"` if absent. If it now reports
   role `admin`, return `"Administrator state changed; refresh and retry"`
   rather than guessing after a concurrent/out-of-band role change.
6. Delete by ID with `.returning({ id: userTable.id })`; require exactly one
   returned row, otherwise return `"Manager not found"`.

Create `src/lib/admin-account-deletion.test.ts` with a controllable Drizzle
transaction double. Cover: missing/stale actor, self-deletion (including the
sole-Admin case), deletion of one Admin when two exist, locked non-Admin
deletion, missing target, and the role-changed retry result.
Assert the sole-Admin case returns the self-deletion error; do not manufacture
an impossible distinct actor merely to reach a last-Admin branch. Also run two
cross-delete calls against a shared row-lock test double; after the first
commits, the second must observe one Admin and reject, leaving exactly one
Admin. Assert the Admin query reaches deterministic `orderBy` and
`for("update")` before any target lookup or delete. Do not weaken production
types merely for the fake.

**Verify**:
`pnpm exec vitest run src/lib/admin-account-deletion.test.ts` → all cases pass.

### Step 3: Make the server action use the actor and transaction result

In `src/app/admin/settings/managers/actions.ts`:

1. Capture `const actor = await requireAdmin()` before validation.
2. Replace the unconditional delete with
   `deleteManagerAccount(db, actor.id, validatedId)`.
3. Return a blocked outcome unchanged; do not invalidate cache on failure.
4. On success only, keep the existing Manager cache tags/paths and return
   `{ success: true }`.
5. Preserve the existing catch/log and generic unexpected failure result.
   Expected policy blocks must not be logged as database errors.
6. Remove only imports made unused by this replacement.

Create `src/app/admin/settings/managers/actions.test.ts`. Mock auth, the
transaction helper, cache runtime, and unrelated creation dependencies. Prove
that failed Admin authorization reaches neither validation-dependent work nor
the helper; the authenticated actor ID and validated target ID are passed to
the helper; a blocked result is returned verbatim with no cache update; and a
successful result updates the existing cache tags/paths once. Keep
`deleteManagerAccount` inside `database.attempt("delete manager", ...)`, so
unexpected PostgreSQL failures retain the existing typed Effect error mapping.

**Verify**: run the three-file focused test command → all pass.

### Step 4: Add advisory UI protection

In `manager-client-page.tsx`, use `authClient.useSession()` and the current
`managersList` to derive `isSelf`, the Admin count, and `isLastAdmin` for each
row. Disable every delete while the session is pending **or unavailable**, for
the signed-in row, and for the sole Admin row. Derive one deterministic reason
with this precedence: session unavailable/pending, self, then sole Admin. Put
that reason in both `title` and an explicit `aria-label`; enabled buttons also
need an `aria-label` naming the target. Include the target name in enabled
delete confirmation text. Keep displaying the exact server error: list/session
data can be stale, so do not remove or duplicate the server transaction checks.

**Verify**: inspect the rendered-state logic for all four cases (pending or
missing session, self, sole Admin, deletable target), then run scoped Biome and
`pnpm typecheck` → exit 0.

### Step 5: Run final gates

Run the command table in order, then:

```bash
git diff --check
git status --short
{ git diff --name-only HEAD -- src; git ls-files --others --exclude-standard -- src; } | sort -u
```

Expected: focused/full tests, typecheck, build, scoped Biome, and diff check all
pass. Run these gates before creating the two suggested commits. The source
list contains exactly the eight in-scope source/test files, including untracked
new tests/helpers; prerequisite commits do not appear because the comparison is
against this branch's current `HEAD`. Full `pnpm lint` remains optional only
while its sole failure is the known `product-card.tsx` formatting issue.

## Test plan

- In-memory Better Auth endpoint tests prove direct delete and both role-change
  routes are forbidden while provisioning and ordinary updates still work.
- Transaction-double tests prove every reachable policy outcome, lock order,
  and the two-Admin cross-delete regression without using real
  credentials/database.
- Server-action tests prove actor propagation, result mapping, and success-only
  cache invalidation.
- Full tests/build catch auth configuration and client component regressions.

## Done criteria

- [ ] Better Auth Admins retain provisioning but lack direct delete/set-role.
- [ ] The server action passes the authenticated actor ID into one transaction.
- [ ] All Admin rows are locked in deterministic order before any delete.
- [ ] Self-deletion and stale actors return specific errors; the sole Admin is
      necessarily protected by the self-deletion rule.
- [ ] Two concurrent cross-deletes leave exactly one Admin.
- [ ] Non-Admin targets are locked before deletion; missing targets are explicit.
- [ ] Cache invalidation occurs only after successful deletion.
- [ ] UI disables obvious invalid actions but server checks remain authoritative.
- [ ] Focused/full tests, typecheck, build, scoped Biome, and diff check pass.
- [ ] No schema, migration, dependency, lockfile, or out-of-scope source changed.
- [ ] Plan 004's index row is updated when the dispatcher does not own it.

## STOP conditions

Stop and report; do not improvise if:

- Auth roles are no longer exactly `admin`/`user`, or another supported role is
  expected to administer accounts.
- Better Auth no longer supports custom Admin `ac`/`roles`, or the in-memory
  endpoint tests cannot exercise the installed version without PostgreSQL.
- Removing `delete`/`set-role` prevents `auth.api.createUser` from provisioning
  either existing role.
- Another application account-deletion or role-write path is discovered beyond
  the guarded action and the three Better Auth endpoints listed above. The
  already-documented operator-only `scripts/seed-admin.ts` is not a new path;
  any additional runtime path is a STOP.
- Drizzle/PostgreSQL cannot emit the ordered `SELECT ... FOR UPDATE` shape, or
  the fix appears to require a trigger, migration, or table-wide lock.
- Plans 001/002 changed auth or manager actions beyond the expected additions.
- A required gate fails twice after one reasonable correction attempt.
- A test attempts to use live credentials, a production database, or real PII.

## Maintenance notes

- Any future role-change feature must enforce the same final-Admin invariant in
  a transaction; do not simply re-enable Better Auth's `set-role` permission.
- Plan 012's Better Auth upgrade must preserve and rerun these custom permission
  endpoint tests; plugin defaults must never silently replace the role map.
- The row-lock rule assumes application mutations use this action. Direct DBA
  changes remain an operational responsibility.
- The custom role map intentionally retains Better Auth's ban and session
  revocation permissions. Those operations can interrupt Admin availability
  but do not delete or demote the persisted final Admin; changing that policy
  requires a separate product decision and tests.
- Once Plan 007 provides the guarded PostgreSQL harness, a later focused auth
  test may add real two-connection coverage; keep this plan's fast
  transaction-double regression as a unit test.
- Reviewers should scrutinize lock acquisition order and success-only cache
  invalidation. UI disablement is convenience, not the security boundary.

## Rollback and recovery

- There is no schema or data migration to reverse. Before deployment, a failed
  gate is recovered by fixing or reverting only Plan 004's hunks in its eight
  source/test files; leave the prerequisite signup and reader guards intact.
- After deployment, do not restore Better Auth's `user:delete` or
  `user:set-role` permissions as a quick rollback: that reopens the bypass this
  plan closes. There is no security-safe whole-plan rollback to the current
  baseline. Prefer a forward fix while keeping the custom permission map and
  locked transaction boundary in place; if necessary, temporarily make the
  application delete action reject every request while the fix is prepared.
- Blocked attempts commit no writes. A successful account deletion remains
  intentionally irreversible: rolling code back does not restore its cascaded
  sessions or credential account. Recover an accidentally deleted non-final
  account only through deliberate reprovisioning by a working Admin; do not
  improvise a database restore in this plan.
