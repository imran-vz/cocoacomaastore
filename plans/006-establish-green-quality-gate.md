# Plan 006: Establish a green automated quality gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` only if that file is tracked and a reviewer has not told
> you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 848e31d..HEAD -- package.json src/components/product-card.tsx .github/workflows/ci.yml plans/README.md; git -c status.branch=false status --short -- package.json src/components/product-card.tsx .github/workflows/ci.yml plans/README.md`
> The second command is required because `git diff` does not report untracked
> files. If any in-scope implementation file changed since this plan was
> written, compare the "Current state" excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition. `plans/README.md` is
> expected to have been created after the planned-at commit. If it is still
> untracked, the dispatcher owns the index: do not add or commit the whole file
> for this plan. If it is tracked, only its Plan 006 row is in scope.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `848e31d`, 2026-07-15

## Why this matters

The repository's build, typecheck, and tests pass locally, but `pnpm lint` is red because one component has three formatting-only differences. There is also no tracked CI workflow, so the repository itself does not define an automated pull-request check. Whether an external integration or branch-protection rule already supplies one must be confirmed by the operator. This plan restores the existing lint baseline, adds one canonical `pnpm check` entry point, and runs that entry point in GitHub Actions with the Node and pnpm versions declared by the project.

`pnpm build` is deliberately excluded from this first quality gate. The application throws at module load when `DATABASE_URL` is absent, all `.env*` files (including the local `.env.example`) are ignored, and the successful local build therefore is not reproducible from tracked configuration alone. Do not hide that gap with placeholder credentials; add the build to CI only after the repository has a sanitized, tracked environment contract and a verified build-time database strategy.

## Current state

- `package.json:5-21` defines independent scripts but no aggregate check:

  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:clone:supabase": "bash scripts/clone-supabase-db.sh",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "lint": "biome check src",
    "lint:fix": "biome check --write src",
    "format": "biome format --write src",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "trigger:dev": "trigger dev",
    "trigger:deploy": "trigger deploy",
    "analytics:trigger": "tsx scripts/trigger-analytics.ts",
    "analytics:trigger:daily": "tsx scripts/trigger-analytics.ts daily",
    "analytics:trigger:monthly": "tsx scripts/trigger-analytics.ts monthly"
  }
  ```

- `package.json` declares `"packageManager": "pnpm@11.0.6"` and engines `node: "24.x"`, `pnpm: ">=11.0.6"`. The workflow must use those versions rather than floating to a different major.
- `biome.json:11-25` enables formatting with tabs, double quotes, and a 120-column line width. Do not change formatter configuration to make the current source pass.
- `pnpm lint` currently checks 186 files and reports exactly one error in `src/components/product-card.tsx`: Biome wants these three JSX opening tags collapsed to one line. The target shapes are:

  ```tsx
  // src/components/product-card.tsx:151
  <div className={cn("flex items-center justify-between gap-2 mt-auto", compact ? "pt-1.5" : "pt-2")}>

  // src/components/product-card.tsx:311
  <span className={cn("shrink-0 font-bold text-primary tabular-nums", compact ? "text-[13px]" : "text-base")}>

  // src/components/product-card.tsx:322
  <h3 className={cn("font-semibold leading-tight line-clamp-1 mb-0.5", compact ? "text-[13px]" : "text-base")}>
  ```

  Only line wrapping changes; attributes, class strings, expressions, and rendered behavior stay identical.

- `git ls-files '.github/**'` currently prints nothing. The Git remote is GitHub, but there is no tracked workflow to preserve or extend.
- `src/db/index.ts:6-10` makes an environment-free build unsafe to promise:

  ```ts
  const connectionString = process.env.DATABASE_URL || "";

  if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set");
  }
  ```

- `.gitignore:33-34` ignores `.env*`. The local `.env.example` is confirmed ignored and is not a tracked CI contract.
- Recent history uses imperative subjects such as `Refactor ...`, while the
  workspace instruction requires Conventional Commits for new commits. Use the
  exact Conventional Commit example in the Git workflow section below.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0; `pnpm-lock.yaml` unchanged |
| Lint | `pnpm lint` | exit 0; 186 files checked; no errors |
| Typecheck | `pnpm typecheck` | exit 0; no TypeScript errors |
| Tests | `pnpm test` | exit 0; all existing tests pass |
| Aggregate gate | `pnpm check` | exit 0 after running lint, typecheck, and tests in that order |
| Patch hygiene | `git diff --check` | exit 0; no whitespace errors |

## Scope

**In scope** (the only files you should modify):

- `src/components/product-card.tsx` — apply only the three formatter-requested line collapses shown above.
- `package.json` — add the canonical `check` script; do not alter any existing script or dependency.
- `.github/workflows/ci.yml` — create the GitHub Actions quality workflow.
- `plans/README.md` — at completion, update only Plan 006's status cell if the
  file is already tracked and the dispatcher does not own the index. An
  untracked index remains dispatcher-owned.

**Out of scope** (do NOT touch, even though related):

- `pnpm-lock.yaml` and all dependency versions. A script-only `package.json` edit must not change the lockfile.
- `biome.json`, TypeScript/Vitest/Next configuration, or lint rule changes.
- Any source file other than `src/components/product-card.tsx`.
- Adding `pnpm build` to `check` or CI before build-time environment requirements are reproducible from tracked setup.
- Creating or documenting environment values, changing `.gitignore`, or committing any `.env*` file.
- Repository branch-protection settings or other GitHub settings; those are external follow-up work.
- Dependency upgrades, audit remediation, test expansion, and unrelated formatting cleanup.

## Git workflow

- Branch: `feat/006-establish-green-quality-gate`
- Use one logical commit after all checks pass: `ci: add automated quality gate`
- Do not push or open a pull request unless the operator explicitly instructs it.
- Do not stage unrelated plans or changes already present in the shared worktree.

## Steps

### Step 1: Confirm the isolated baseline

Use an isolated worktree on `feat/006-establish-green-quality-gate`, then run
the drift check from the header. Do not switch the shared worktree away from a
branch with unrelated active changes. Record the initial
`git -c status.branch=false status --short` so final status can be compared
with pre-existing work. Confirm that
`git ls-files '.github/**'` returns no files and that the current
`package.json`, `biome.json`, and three `product-card.tsx` blocks match the
excerpts above.

Run the frozen install before editing. It must accept the committed lockfile as-is.

**Verify**:

- `pnpm install --frozen-lockfile` → exits 0.
- `git diff --exit-code -- pnpm-lock.yaml` → exits 0.
- `pnpm lint` → fails with exactly the one `src/components/product-card.tsx format` diagnostic shown in Current state and no other diagnostic. This expected red baseline is the only intentional failing check in the plan.
- `git ls-files '.github/**'` → prints nothing.
- `git -c status.branch=false status --short -- pnpm-lock.yaml` → prints
  nothing; there is no pre-existing lockfile change to conceal a later
  mutation.
- The operator confirms GitHub Actions is the intended CI provider, the
  `CI / quality` check name is compatible with repository policy, and mutable
  major action tags are permitted.

### Step 2: Restore the Biome baseline without changing behavior

In `src/components/product-card.tsx`, replace only the three multiline opening tags at the current lines around 151, 311, and 322 with the one-line target shapes in Current state. Do not run a repository-wide formatter and do not change class names, conditions, element types, children, imports, or surrounding code.

**Verify**: `pnpm lint` → exits 0 with no diagnostics.

Then run `git diff -- src/components/product-card.tsx` and confirm that the diff contains only those three formatter-requested line collapses. If it contains any semantic change, revert that semantic change before continuing.

### Step 3: Add one canonical local quality command

Add this entry to the existing `scripts` object in `package.json`, adjacent to the existing quality scripts:

```json
"check": "pnpm lint && pnpm typecheck && pnpm test"
```

Do not add `build`, use `--fix`, change any existing script, or modify dependency metadata. The command intentionally stops on the first failed gate.

**Verify**:

- `node -e 'const p=require("./package.json"); if (p.scripts.check !== "pnpm lint && pnpm typecheck && pnpm test") process.exit(1)'` → exits 0.
- `pnpm check` → exits 0; lint, typecheck, and the full existing Vitest suite all pass.
- `git diff --exit-code -- pnpm-lock.yaml` → exits 0.

### Step 4: Add the GitHub Actions workflow

Create `.github/workflows/ci.yml` with exactly this minimal shape:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.0.6
          run_install: false
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24.x
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run quality gate
        run: pnpm check
```

Do not add secrets, services, a database URL, a build step, dependency caching beyond `setup-node`, matrix jobs, deployment behavior, or write permissions.

**Verify**:

- `test -f .github/workflows/ci.yml` → exits 0.
- `rg -n 'node-version: 24\.x|version: 11\.0\.6|pnpm install --frozen-lockfile|run: pnpm check' .github/workflows/ci.yml` → prints exactly the four required workflow lines.
- `rg -n 'pnpm build|next build|DATABASE_URL|secrets\.' .github/workflows/ci.yml` → prints nothing and exits 1, confirming deferred build/secrets are absent.
- `pnpm check` → exits 0.
- `git diff --check` → exits 0.

`git diff --check` does not inspect the new, still-untracked workflow. Its
content is checked explicitly above, and staged whitespace validation is
required in Step 5.

### Step 5: Review, record completion, and commit

Review the complete change. It must consist only of the three formatter
changes, one `package.json` script, the new workflow, and (only when the tracked
index is not dispatcher-owned) Plan 006's status cell in `plans/README.md`.
Because an untracked workflow is absent from `git diff`, inspect it directly
before staging. Mark Plan 006 `DONE` only after all final checks pass.

**Verify**:

- `git diff --exit-code -- pnpm-lock.yaml` → exits 0.
- `pnpm check` → exits 0.
- `git diff --check` → exits 0.
- `git -c status.branch=false status --short` → compared with the recorded
  baseline, adds only the three implementation paths and, when applicable, the
  tracked `plans/README.md` row edit.

Stage only this plan's implementation files and the tracked Plan 006 status
row if applicable. Do not stage an untracked `plans/README.md`. Then verify:

- `git diff --cached --check` → exits 0, including the newly added workflow.
- `git diff --cached --name-only` → lists exactly
  `src/components/product-card.tsx`, `package.json`,
  `.github/workflows/ci.yml`, and the tracked `plans/README.md` only when its row
  is executor-owned.
- `git diff --cached` → contains the complete intended patch and no unrelated
  staged change.

Commit with `ci: add automated quality gate`.

## Test plan

No new product test is appropriate: this plan changes no runtime behavior. The regression is the quality-gate wiring itself.

- Before the source formatting change, confirm `pnpm lint` fails only for the three known line-wrapping differences.
- After the change, confirm `pnpm lint` passes without weakening Biome configuration.
- Confirm the new `pnpm check` runs the existing lint, typecheck, and complete Vitest suite and exits 0.
- Confirm a frozen install succeeds and the lockfile remains byte-for-byte unchanged in Git.
- Confirm the workflow contains the pinned pnpm 11.0.6 and Node 24.x setup, performs a frozen install, and invokes only `pnpm check` as the quality gate.
- The definitive hosted verification is the first GitHub Actions run on the pull request or a push to `main`; a local YAML-content check cannot prove GitHub runner behavior. If push/PR creation is not authorized, record this as pending release/merge acceptance rather than claiming that hosted execution was observed.

## Done criteria

ALL must hold:

- [ ] `pnpm lint` exits 0 with no ignored or disabled rules added.
- [ ] `pnpm typecheck` exits 0 with no errors.
- [ ] `pnpm test` exits 0; the full existing suite passes.
- [ ] `pnpm check` exists and runs exactly `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] `.github/workflows/ci.yml` targets pull requests and pushes to `main`,
      uses pnpm 11.0.6 and Node 24.x, performs
      `pnpm install --frozen-lockfile`, then runs `pnpm check`.
- [ ] Neither `pnpm check` nor the workflow invokes `next build`/`pnpm build`.
- [ ] `pnpm-lock.yaml`, `biome.json`, dependency versions, and out-of-scope source files are unchanged.
- [ ] `git diff --check` exits 0.
- [ ] `git diff --cached --check` exits 0 after staging, so the new workflow is
      included in whitespace validation.
- [ ] No files outside the in-scope list are modified by this work.
- [ ] `plans/README.md` Plan 006 status is `DONE` only when the tracked index is
      executor-owned; an untracked or explicitly dispatcher-owned index is not
      staged or modified by the executor.
- [ ] If a push or pull request is authorized, the first hosted `CI / quality`
      run passes before merge. Otherwise, hosted verification is explicitly
      recorded as pending release/merge acceptance.

## Rollback

This change has no data migration, deployment, secret, or runtime-state
rollback. If the quality workflow is invalid or incompatible with repository
policy, revert the single `ci: add automated quality gate` commit; that removes
the workflow and `check` script and restores the formatting-only source lines.
If an operator separately made `CI / quality` a required branch-protection
check, they must remove or replace that external requirement before reverting,
otherwise merges can remain blocked by a check that no longer exists.

## STOP conditions

Stop and report back; do not improvise if any of these occurs:

- Any in-scope implementation file no longer matches Current state, including an existing `check` script or tracked CI workflow added after commit `848e31d`.
- The initial `pnpm lint` reports anything beyond the one known `product-card.tsx` formatting diagnostic, or Biome requests changes beyond the three documented opening tags.
- `pnpm install --frozen-lockfile` fails, modifies `pnpm-lock.yaml`, or requires a package-manager/dependency change.
- The initial worktree already has staged changes or in-scope implementation
  edits that cannot be isolated from this plan.
- `pnpm typecheck` or `pnpm test` fails on the untouched baseline, requires a database/external service, or is flaky on a second run.
- GitHub Actions is not the repository's intended CI provider, or organization
  policy requires a reusable workflow, immutable full-length action SHA pins,
  or another action different from the explicit workflow above.
- A required branch-protection check name is known and is incompatible with the `CI / quality` job this plan creates.
- A reviewer requires `pnpm build` in this workflow before tracked build-time environment/bootstrap requirements exist. That is a separate setup decision; do not invent credentials or fake service configuration.
- Completing the change appears to require touching any out-of-scope file.
- A step's verification fails twice after one reasonable correction attempt.

## Maintenance notes

- Reviewers should scrutinize that the `product-card.tsx` diff is formatting-only and that no dependency or lockfile change slipped in.
- `pnpm check` is the canonical command for future local and CI quality checks. Add new deterministic, environment-free checks there so CI and local behavior remain aligned.
- Add `pnpm build` only after a separate change makes build-time environment requirements explicit, sanitized, and reproducible for a fresh clone. Do not solve that later by embedding secrets in the workflow.
- GitHub branch protection must be configured separately if `CI / quality` should be required before merge; this repository change cannot enforce that external setting itself.
- The workflow pins Node and pnpm versions, but its action references use
  mutable major tags. Do not guess full-length action SHAs if repository policy
  requires immutable pins; obtain the approved refs before implementation.
