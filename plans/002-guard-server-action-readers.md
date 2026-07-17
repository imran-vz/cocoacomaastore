# Plan 002: Enforce role guards inside exported server-action readers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before continuing. If a
> STOP condition occurs, stop and report; do not improvise. When done, update
> this plan's row in `plans/README.md`, unless the dispatcher owns the index.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat 848e31d -- \
>   src/app/manager/orders/actions.ts \
>   src/app/admin/orders/actions.ts \
>   src/app/admin/settings/managers/actions.ts \
>   src/app/manager/inventory/actions.ts \
>   src/app/server-action-readers-auth.test.ts
> git status --short -- \
>   src/app/manager/orders/actions.ts \
>   src/app/admin/orders/actions.ts \
>   src/app/admin/settings/managers/actions.ts \
>   src/app/manager/inventory/actions.ts \
>   src/app/server-action-readers-auth.test.ts
> ```
>
> The first command includes committed, staged, and unstaged drift from the
> planning commit; the second also exposes an untracked test file. If either
> command reports an in-scope path, compare it with the excerpts below. A
> mismatch in a reader, downstream call, or role boundary is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

These four exported `"use server"` readers rely on layouts or API routes for
authentication. A server action is callable independently, so its own boundary
must authorize before any database, cache-key, cached-function, or serialization
work. This is defense in depth: keep existing route/layout guards, response
shapes, cache behavior, and mutation authorization unchanged.

Known tradeoff: existing pages and API routes will perform their outer
authorization check and then the new reader check. Preserve both: route guards
produce the intended HTTP 401/403 response, layouts protect navigation, and the
reader guard protects direct action invocation. This small extra session lookup
is accepted for this security boundary; removing or consolidating outer guards
is out of scope.

## Current state

`src/lib/auth/guards.ts:9,56-65` supplies the existing boundaries:

```ts
const MANAGER_ACCESS_ROLES = ["admin", "user"] as const;

export async function requireSession() {
	return requireRole();
}
export async function requireAdmin() {
	return requireRole(["admin"], "Admin access required");
}
export async function requireManagerAccess() {
	return requireRole(MANAGER_ACCESS_ROLES, "Access required");
}
```

Do not change this file. Manager workspace readers require
`requireManagerAccess`; Admin-only readers require `requireAdmin`. A generic
`requireSession` is too weak. Admins intentionally pass the Manager guard under
the current centralized role policy.

| Reader | Required guard | Protected data |
|---|---|---|
| `src/app/manager/orders/actions.ts:getCachedOrders` | `requireManagerAccess` | Manager order history |
| `src/app/admin/orders/actions.ts:getCachedOrders` | `requireAdmin` | Admin order history |
| `src/app/admin/settings/managers/actions.ts:getCachedManagers` | `requireAdmin` | Staff names, emails, roles, dates |
| `src/app/manager/inventory/actions.ts:getCachedTodayInventory` | `requireManagerAccess` | Current inventory |

Current unguarded order-reader shape in
`src/app/manager/orders/actions.ts:21-23` and
`src/app/admin/orders/actions.ts:5-7`:

```ts
export async function getCachedOrders() {
	return serializeOrders(await getCachedOrdersCore());
}
```

`src/app/admin/settings/managers/actions.ts:20-30` starts a direct query even
though the module already imports `requireAdmin` for mutations:

```ts
export async function getCachedManagers(): Promise<ManagerRow[]> {
	const managers = await db.select({ /* staff PII */ }).from(userTable);
}
```

`src/app/manager/inventory/actions.ts:18-25` performs work before authorization:

```ts
export async function getCachedTodayInventory() {
	const day = getDailyInventoryDay();
	const dayKey = getDailyInventoryDayKey();
	return unstable_cache(() => getInventoryForDay(day), /* existing options */)();
}
```

The guard must be each reader's first executable statement. Never put auth
inside `unstable_cache`; authorization must run on every invocation.

Test convention: model the new tests on
`src/lib/admin-reporting/admin-reporting.test.ts:3-40`. It mocks the guard,
makes it reject, installs a database tripwire, then proves authorization ran
before database access.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `pnpm exec vitest run src/app/server-action-readers-auth.test.ts` | exit 0; 4 tests pass after Step 2 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Scoped lint | `pnpm exec biome check src/app/manager/orders/actions.ts src/app/admin/orders/actions.ts src/app/admin/settings/managers/actions.ts src/app/manager/inventory/actions.ts src/app/server-action-readers-auth.test.ts` | exit 0 |
| Full tests | `pnpm test` | exit 0 |
| Build | `pnpm build` | exit 0 |
| Diff check | `git diff --check` | exit 0, no output |

Repository-wide `pnpm lint` is already red at `848e31d` because of unrelated
formatting in `src/components/product-card.tsx`. Do not touch it. The scoped
Biome command is this plan's lint gate. If that baseline has been repaired by
execution time, also require `pnpm lint` to exit 0.

## Scope

**In scope** (the only source files to modify/create):

- `src/app/manager/orders/actions.ts`
- `src/app/admin/orders/actions.ts`
- `src/app/admin/settings/managers/actions.ts`
- `src/app/manager/inventory/actions.ts`
- `src/app/server-action-readers-auth.test.ts` (create)

`plans/README.md` may receive only the normal status-row update.

**Out of scope**:

- `src/lib/auth/guards.ts`, role names, and Manager role membership.
- Public signup/auth configuration; that is a separate security plan.
- API routes, layouts, queries, serializers, cache policy, response shapes.
- All mutation behavior, including existing `requireSession` calls.
- Dependencies, schema, migrations, generated files, and
  `src/components/product-card.tsx`.

## Git workflow

- Branch: `feat/002-guard-server-action-readers`.
- Use Conventional Commits without co-author trailers. Preferred single commit:
  `fix(auth): guard server-action readers by role`.
- If split: `test(auth): cover server-action reader boundaries`, then the fix
  commit. Do not leave the final branch test-red.
- Do not push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add auth-before-data-access regression tests

Create `src/app/server-action-readers-auth.test.ts` using Vitest and the
existing Admin reporting test structure. Put shared spies/counters in
`vi.hoisted`, so hoisted mock factories never depend on uninitialized bindings.
Use spies for:

- `requireAdmin`, rejecting with `new Error("Admin access required")`;
- `requireManagerAccess`, rejecting with `new Error("Access required")`;
- `requireSession`, present for mutation imports but never used by readers;
- order lifecycle reads/serialization;
- inventory day helpers, inventory read, and the `unstable_cache` export from
  `next/cache`; and
- `@/db` property access via a tripwire `Proxy`.

Mock every other symbol statically imported from `@/lib/order-lifecycle` and
`@/lib/daily-inventory` with inert `vi.fn()` placeholders. Mock `@/lib/auth`
with inert `auth.api`: the Managers action imports the real Better Auth instance
at module initialization, which would otherwise consume the mocked database and
make the tripwire ambiguous. Configure the inventory day helpers with stable
values and make the `unstable_cache` mock return its supplied callback, so the
unfixed reader reaches the inventory spy instead of failing with an unrelated
"not a function" error. Increment a counter in the database Proxy before it
throws, and assert the counter remains zero after authorization rejects. Do not
alter production modules for test convenience. Reset spies and the counter in
`beforeEach`; alias the same-named order imports as `getManagerOrders` and
`getAdminOrders`.

Write exactly four tests:

1. Manager orders rejects with `"Access required"`; calls
   `requireManagerAccess` once; never calls `requireSession`, core order read,
   or serializer.
2. Admin orders rejects with `"Admin access required"`; calls `requireAdmin`
   once; never calls core order read or serializer.
3. Managers list rejects with `"Admin access required"`; calls `requireAdmin`
   once; records zero database tripwire accesses.
4. Today inventory rejects with `"Access required"`; calls
   `requireManagerAccess` once; never calls `requireSession`, day helpers,
   inventory read, or `unstable_cache`.

**Verify the red state**:

```bash
pnpm exec vitest run src/app/server-action-readers-auth.test.ts
```

Expected before source changes: exit non-zero; all four tests fail because the
guard is not called and downstream work is reached. If they pass, STOP because
the test does not reproduce the defect. Import/configuration errors, missing
mock exports, and an `unstable_cache` callable error are invalid red states;
correct the test harness and rerun before changing production code.

### Step 2: Add the exact guard to each reader

Make only these changes:

1. Manager orders: add `requireManagerAccess` beside the existing
   `requireSession as requireAuth` import; await it first in `getCachedOrders`.
2. Admin orders: import `requireAdmin`; await it first in `getCachedOrders`.
3. Managers list: await the existing `requireAdmin` first, before `db.select`.
4. Manager inventory: add `requireManagerAccess` beside the existing
   `requireSession as requireAuth`; await it before `day` and `dayKey`.

Target shapes:

```ts
export async function getCachedOrders() {
	await requireManagerAccess(); // requireAdmin() in the Admin module
	return serializeOrders(await getCachedOrdersCore());
}

export async function getCachedManagers(): Promise<ManagerRow[]> {
	await requireAdmin();
	// Existing query and mapping unchanged.
}

export async function getCachedTodayInventory() {
	await requireManagerAccess();
	// Existing day/cache implementation unchanged.
}
```

Do not wrap guards in cache callbacks, Effect, `try/catch`, or
`mapDatabaseUnavailable`. Guard errors must reject before downstream work.

**Verify**:

```bash
pnpm exec vitest run src/app/server-action-readers-auth.test.ts
```

Expected: exit 0; 4 tests pass.

### Step 3: Run scoped and repository gates

Run the scoped Biome command from the command table. Expected: exit 0. If only
formatting fails, run `pnpm exec biome check --write` with exactly the same five
paths, inspect the diff, then rerun. Never run repository-wide `lint:fix`.

Then run:

```bash
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status --short
git diff --name-only
```

Expected: the first four commands exit 0. Full tests contain the baseline 38
plus 4 new tests (42), unless another plan added tests. Source changes shown by
the final commands are exactly the five in-scope files; a status-only
`plans/README.md` edit is allowed.

## Rollback

This change has no schema, data, dependency, or cache migration. Before commit,
remove only the four added guard calls, their corresponding import changes, and
the new regression test.
After commit, revert the complete plan commit rather than editing individual
readers. Do not remove the existing layout or API-route guards.

Rerun `pnpm typecheck`, `pnpm test`, `pnpm build`, the five-path scoped Biome
check, and `git diff --check` after rollback. A rollback restores the known
outer-boundary behavior but reopens direct reader invocation, so record that
security exposure before deploying the rollback.

## Test plan

- One new test per exported reader, all in
  `src/app/server-action-readers-auth.test.ts`.
- Follow `src/lib/admin-reporting/admin-reporting.test.ts` for guard and
  database tripwires.
- Assert both the exact role helper and absence of all downstream work.

## Done criteria

- [ ] Manager readers await `requireManagerAccess()` first.
- [ ] Admin readers await `requireAdmin()` first.
- [ ] No guard is inside a cache callback.
- [ ] Four tests demonstrate red before the fix and green afterward.
- [ ] The red run fails on guard-order assertions, not module initialization or
      mock-setup errors.
- [ ] Focused tests, `pnpm typecheck`, full tests, and `pnpm build` exit 0.
- [ ] Scoped Biome and `git diff --check` exit 0.
- [ ] No source outside the five-file scope changed.
- [ ] Mutations, outputs, caching, and central role policy remain unchanged.
- [ ] Existing layout/API guards remain in place; the accepted duplicate
      authorization check is not optimized away in this plan.
- [ ] Index status is updated only if the dispatcher does not own it.

## STOP conditions

Stop and report; do not improvise if:

- Drift changed a reader, downstream call, helper signature, or role policy.
- Another plan removed `requireManagerAccess` or changed Admin access to Manager
  data; re-confirm the boundary before editing.
- An intended anonymous/non-Manager consumer of a Manager reader, or Manager
  consumer of an Admin reader, is discovered.
- Any Step 1 test passes before the production fix.
- The fix requires changing a query, cache helper, response, route, layout,
  central guard, or mutation.
- A required gate fails twice after one reasonable correction attempt.
- Full lint reports only the known `product-card.tsx` issue; record it and use
  scoped lint rather than changing that file. A new in-scope lint failure must
  be corrected or reported.
- A secret or real credential appears in a fixture or diff.

## Maintenance notes

- Guard every future server-action reader before cache-key or data work, even
  when an outer page/route is guarded.
- Review the exact helper: generic session authentication is insufficient here.
- If roles change, update the central role list and these tests; never scatter
  role string checks into actions.
- Mutation authorization and public signup remain intentionally separate work.
