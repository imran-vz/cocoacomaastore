# Plan 001: Disable public email self-registration

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before continuing. If a
> STOP condition occurs, stop and report; do not improvise. When done, update
> only this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d -- src/lib/auth.ts` and
> `git status --short -- src/lib/auth.ts src/lib/auth.test.ts`
> (the second command is required because `git diff` omits untracked files).
> If either command prints output, compare it with the excerpts below. A prior
> implementation, an unexpected change, or an existing test is a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

This is an internal staff portal where administrators provision accounts.
Better Auth currently exposes public email signup and assigns new accounts the
`user` role, which this application intentionally accepts as manager access.
An unauthenticated caller can therefore create a staff account through the API.
Keep email/password sign-in and admin provisioning, but disable public signup.

## Current state

- `src/lib/auth.ts` configures production authentication. Signup is not
  disabled:

  ```ts
  // src/lib/auth.ts:20-28
  emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      password: {
          hash: async (password) => await bcrypt.hash(password, 12),
          verify: async ({ password, hash }) => bcrypt.compare(password, hash),
      },
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  ```

- `src/lib/auth/guards.ts:9,60-65` defines manager access as `admin` or `user`.
  Role semantics are deliberately out of scope.
- `src/app/api/auth/[...all]/route.ts:1-4` exports Better Auth's complete GET
  and POST handler; there is no application route filter for signup.
- `src/app/login/page.tsx:90-109` calls only `signIn.email`. A sign-in-only UI
  does not prevent direct API signup.
- `src/app/admin/settings/managers/actions.ts` is the intended account creation
  path:

  ```ts
  // src/app/admin/settings/managers/actions.ts:38-55
  export async function createManager(data: CreateManagerSchema) {
      await requireAdmin();
      // validation and sanitization omitted
      await auth.api.createUser({
          body: {
              name: validated.name,
              email: sanitizedEmail,
              password: validated.password,
              role: validated.role,
          },
          headers: await headers(),
      });
  }
  ```

- Installed Better Auth `1.6.11` declares
  `emailAndPassword.disableSignUp?: boolean` with default false. Its email
  signup route implements the required narrow policy:

  ```ts
  // node_modules/better-auth/dist/api/routes/sign-up.mjs:140-145
  if (!ctx.context.options.emailAndPassword?.enabled ||
      ctx.context.options.emailAndPassword?.disableSignUp)
      throw APIError.from("BAD_REQUEST", {
          message: "Email and password sign up is not enabled",
          code: "EMAIL_PASSWORD_SIGN_UP_DISABLED"
      });
  ```

- Test conventions: Vitest runs in Node with the `@` alias. Follow the server
  module mocking style in `src/lib/admin-reporting/admin-reporting.test.ts`.
- Baseline at `848e31d`: typecheck, tests (38), and build pass. Full
  `pnpm lint` is already red only for unrelated formatting in
  `src/components/product-card.tsx` around lines 151, 306, and 312. Use scoped
  Biome; do not edit that file or run `pnpm lint:fix`.

The code change is low risk, but rollout has an account-recovery risk: disabling
signup does not create the first administrator for a new environment. Before
deployment, an operator must confirm that the target already has a working
administrator or an approved bootstrap path. Plan 016 adds the reproducible
bootstrap later; public signup must not be retained as an interim bootstrap.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Branch | `git branch --show-current` | `feat/001-disable-public-self-registration` |
| Targeted test | `pnpm exec vitest run src/lib/auth.test.ts` | the file passes |
| Scoped lint | `pnpm exec biome check src/lib/auth.ts src/lib/auth.test.ts` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Full tests | `pnpm test` | all tests pass |
| Build | `pnpm build` | production build succeeds |

No dependency installation or lockfile update is needed.

## Scope

**In scope** (the only application/test source files to modify):

- `src/lib/auth.ts`
- `src/lib/auth.test.ts` (create)
- `plans/README.md`, final status-row update only

**Out of scope**:

- `src/lib/auth/guards.ts`: do not change `user` role semantics.
- `src/app/api/auth/[...all]/route.ts`: do not implement route filtering.
- `src/app/login/page.tsx` and `src/lib/auth-client.ts`: preserve sign-in.
- `src/app/admin/settings/managers/actions.ts` and its UI: preserve admin
  provisioning through `auth.api.createUser`.
- Existing users/sessions, schema, migrations, password/email-verification
  policy, invitations, reset flows, rate limits, and account cleanup.
- Dependencies, lockfile, and the unrelated lint failure.

## Git workflow

- Branch: `feat/001-disable-public-self-registration`.
- Use Conventional Commits. Preferred single commit:
  `fix(auth): disable public self-registration`.
- A split red/green history may use
  `test(auth): cover disabled public signup` followed by the fix commit.
- Do not push or open a PR unless explicitly instructed.

## Steps

### Step 1: Confirm the policy and branch

1. Run the drift check.
2. Run `git status --short`. Stop rather than stashing, resetting, or carrying
   unrelated changes into this branch if switching would overwrite or include
   user work.
3. Confirm `src/lib/auth.ts` has `enabled: true`, no `disableSignUp`, and admin
   plugin `defaultRole: "user"`.
4. Confirm `createManager` calls `requireAdmin()` before `auth.api.createUser`.
5. Create/switch to `feat/001-disable-public-self-registration`.

**Verify**: `git branch --show-current` → exact branch name above.

### Step 2: Add the red regression test

Create `src/lib/auth.test.ts` without connecting to PostgreSQL:

1. Use `vi.hoisted`/`vi.mock` to replace `betterAuth` with a spy that captures
   the options passed by `src/lib/auth.ts` and returns `{ options, api:
   { getSession: vi.fn() } }`.
2. Mock `@/db`, `@/db/schema`, `better-auth/adapters/drizzle`, and
   `better-auth/plugins` before importing `auth` from `@/lib/auth`.
3. Test `keeps email sign-in enabled while disabling public email signup`:
   expect `auth.options.emailAndPassword.enabled` and `disableSignUp` both to
   be `true`.
4. Test `rejects the public sign-up endpoint`:
   - load the real factory with
     `vi.importActual<typeof import("better-auth")>("better-auth")`;
   - construct an isolated instance using a fixed test-only secret,
     `http://localhost:3000`, no database option (Better Auth's in-memory
     adapter), and the captured production `emailAndPassword` options;
   - POST valid JSON to `/api/auth/sign-up/email`, with matching `origin` and
     `content-type: application/json` headers;
   - expect status 400 and JSON code `EMAIL_PASSWORD_SIGN_UP_DISABLED`.

**Verify format**: `pnpm exec biome check src/lib/auth.test.ts` → exit 0.

**Verify red**: `pnpm exec vitest run src/lib/auth.test.ts` → non-zero only because
`disableSignUp` is undefined and the isolated endpoint returns 200. Database,
environment, or mocking failures do not count as a valid red test.

### Step 3: Disable only public signup

In `src/lib/auth.ts`, add one property immediately after `enabled: true`:

```ts
emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    // existing password callbacks unchanged
},
```

Do not set `enabled` false or modify roles, routes, login, or admin provisioning.

**Verify**: `pnpm exec vitest run src/lib/auth.test.ts` → both tests pass with no
PostgreSQL connection attempt.

### Step 4: Run final gates

Run in order:

1. `pnpm exec biome check src/lib/auth.ts src/lib/auth.test.ts` → exit 0.
2. `pnpm typecheck` → exit 0.
3. `pnpm test` → all tests pass.
4. `pnpm build` → production build succeeds.
5. `git diff --exit-code 848e31d -- src/lib/auth/guards.ts 'src/app/api/auth/[...all]/route.ts' src/app/login/page.tsx src/lib/auth-client.ts src/app/admin/settings/managers/actions.ts`
   → exit 0.
6. `git diff --name-only 848e31d -- src | sort` → exactly:

   ```text
   src/lib/auth.test.ts
   src/lib/auth.ts
   ```

Full `pnpm lint` need not become green. Any Biome diagnostic in the two scoped
files is a failure; only the known `product-card.tsx` baseline is accepted.

**Verify**: all six gates give the stated results.

### Step 5: Commit and update status

Review the diff, update only Plan 001's row in `plans/README.md` from `TODO` to
`DONE`, then commit the source, test, and status-row change using the message
above. Do not mark the plan done or commit if any gate failed.

**Verify**: `git log -1 --pretty=%s` → expected Conventional Commit subject;
`git status --short` → clean.

## Test plan

- New file: `src/lib/auth.test.ts`, modeled on
  `src/lib/admin-reporting/admin-reporting.test.ts` module isolation.
- Assert production configuration keeps sign-in enabled and disables signup.
- Exercise the installed Better Auth handler using the production
  email/password options and its in-memory adapter; expect HTTP 400 and
  `EMAIL_PASSWORD_SIGN_UP_DISABLED`.
- Use only fake credentials and a test-only secret; never load a real database.
- Removing `disableSignUp: true` must make both assertions fail; restore it
  immediately.
- Run the targeted test, then the complete suite.

## Done criteria

ALL must hold:

- [ ] `test "$(git branch --show-current)" = "feat/001-disable-public-self-registration"` exits 0.
- [ ] `test "$(rg -c '^\\s*disableSignUp: true,$' src/lib/auth.ts)" = "1"` exits 0.
- [ ] Targeted auth tests pass and cover config plus HTTP behavior.
- [ ] Scoped Biome, `pnpm typecheck`, `pnpm test`, and `pnpm build` exit 0.
- [ ] The no-diff command for roles/routes/login/provisioning exits 0.
- [ ] Source diff lists only `src/lib/auth.ts` and `src/lib/auth.test.ts`.
- [ ] No dependency, lockfile, schema, or migration changed.
- [ ] Plan 001 is `DONE` in `plans/README.md`.

## Rollout acceptance and rollback

Deployment is outside this implementation plan and requires operator approval.
For each target environment, record these acceptance checks after deployment:

- an unauthenticated `POST /api/auth/sign-up/email` returns HTTP 400 with code
  `EMAIL_PASSWORD_SIGN_UP_DISABLED`;
- a known existing staff account can still sign in; and
- in an approved non-production environment, a known administrator can still
  provision a disposable test account through the Admin Managers flow, then
  remove it under the normal account policy.

Do not create or delete a shared-environment account merely to complete the
local plan. If rollout breaks existing sign-in or administrator provisioning,
roll back to the prior application artifact while access is restricted or the
application is taken offline, because that artifact reopens public signup.
Do not hand-edit auth rows or toggle the flag ad hoc. Rollback does not revoke
accounts or sessions created before the fix; auditing and revocation require a
separate authorized operational task.

## STOP conditions

Stop and report; do not improvise if:

- Current code differs from the excerpts or another branch already added this
  policy/test.
- Product ownership says unauthenticated self-registration is intentional.
- The target environment has neither a verified administrator nor an approved
  first-admin bootstrap path; implementation may complete, but deployment is
  blocked.
- Installed Better Auth lacks `disableSignUp`, or its isolated handler does not
  return HTTP 400 with `EMAIL_PASSWORD_SIGN_UP_DISABLED` when enabled.
- The test attempts PostgreSQL access or needs real credentials; adding test DB
  infrastructure is out of scope.
- The change disables sign-in, affects `auth.api.createUser`, or seems to need a
  route/UI workaround.
- The fix requires role, database, existing-account, invitation, dependency, or
  out-of-scope source changes.
- A verification fails twice after one reasonable in-scope correction.
- Full tests/typecheck/build fail for an unrelated reason. Report it instead of
  repairing unrelated code.
- Scoped Biome reports a diagnostic. The existing full-lint exception applies
  only to `product-card.tsx`.

## Maintenance notes

- `disableSignUp: true` is intentionally narrower than disabling
  email/password authentication; existing staff must still sign in.
- Reviewers should verify the PR changes only public signup and leaves
  `createManager` untouched.
- Retain the endpoint regression through Better Auth upgrades.
- A future onboarding feature should use an explicit expiring, single-use
  invitation with an administrator-selected role, not generic signup.
- Revoking accounts created before this fix is a separate operational security
  task requiring explicit authorization.
