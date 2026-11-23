# Cocoa Comaa Store

Cocoa Comaa Store is an internal ordering, inventory, and analytics application.

## Prerequisites

- Node.js 24
- pnpm 11
- PostgreSQL

## Fresh local setup

Install the locked dependencies and create an ignored local environment file:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Replace every placeholder in the required web application section of `.env`. Point `DATABASE_URL` at the intended new local database; never reuse a shared or production URL for local setup.

Apply the current schema only after confirming the target is that new local database:

```sh
pnpm db:push
```

Create the first administrator using the secure shell procedure below, then start the application:

```sh
pnpm dev
```

Public signup is disabled. After the first administrator exists, create later accounts through the authenticated Admin UI.

## Environment variables

| Classification | Variables | Usage |
| --- | --- | --- |
| Required web application values | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `REVALIDATE_SECRET` | Database, authentication, trusted application origin, and cache revalidation. Use an independent high-entropy value for each secret. |
| Optional database diagnostics | `DB_QUERY_TIMING`, `DB_SLOW_QUERY_MS` | Enable query timing and configure its slow-query threshold. |
| Optional Trigger.dev workflows | `TRIGGER_SECRET_KEY` | Required for the Trigger.dev workflows below, not for core web application startup. The Trigger.dev project is set in `trigger.config.ts`. |
| Optional Supabase clone source | `SUPABASE_DATABASE_URL` | Read by `pnpm db:clone:supabase`; see below. |
| One-time administrator bootstrap | `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE` | Export only for one invocation and unset immediately afterward. Never persist these values in `.env`. |
| One-time operator inputs | `CONFIRM_CLONE`, `ORDER_COLUMNS_DATABASE_URL`, `ORDER_COLUMNS_CONFIRMATION_TOKEN`, `COCOACOMAA_ORDER_COLUMNS_ACKNOWLEDGEMENT` | Set for one command only: the Supabase clone below and the order columns cutover runbook. |

The tracked `.env.example` contains placeholders only. `NODE_ENV` is runtime-managed and does not belong in local configuration.

## First administrator bootstrap

The command loads the repository `.env`, with values already exported in the invoking shell taking precedence. It deliberately ignores any one-time bootstrap values found in `.env`; the `BOOTSTRAP_ADMIN_*` inputs and the shared-database acknowledgement must come from the invoking shell.

Export the name and email, read the password silently, and invoke the one-time command. The password must not appear in a command argument or shell history.

```sh
export BOOTSTRAP_ADMIN_NAME='First Administrator'
export BOOTSTRAP_ADMIN_EMAIL='admin@example.invalid'
read -s BOOTSTRAP_ADMIN_PASSWORD
export BOOTSTRAP_ADMIN_PASSWORD
pnpm auth:bootstrap-admin
unset BOOTSTRAP_ADMIN_NAME BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
unset COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE
```

Local loopback databases need no acknowledgement. A remote or shared database is refused unless the operator sets the exact one-invocation acknowledgement:

```sh
export BOOTSTRAP_ADMIN_NAME='First Administrator'
export BOOTSTRAP_ADMIN_EMAIL='admin@example.invalid'
read -s BOOTSTRAP_ADMIN_PASSWORD
export BOOTSTRAP_ADMIN_PASSWORD
export COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE=CREATE_FIRST_ADMIN
pnpm auth:bootstrap-admin
unset BOOTSTRAP_ADMIN_NAME BOOTSTRAP_ADMIN_EMAIL BOOTSTRAP_ADMIN_PASSWORD
unset COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE
```

That acknowledgement authorizes only creation of the first administrator. It is not authorization for a schema push, deployment, or any other production change.

Rerunning with the same existing administrator email is a no-op and does not reset its password. The command refuses an existing non-admin target or a different existing administrator. If it reports failure, stop and arrange a manual auth-table review instead of rerunning blindly.

## Database safety and cloning

`pnpm db:push` directly synchronizes the Drizzle schema with its target. It is never an automatic setup or deployment step for an existing, shared, or production environment. Before using it against production, require all of the following:

- An operator-approved, verified backup.
- A reviewed Drizzle schema diff for the exact target.
- An explicit production change window and approval.

This repository does not currently expose or support versioned Drizzle migration commands. Existing databases were established with `drizzle-kit push` and do not have an adopted migration ledger. In particular, any generated `0000` full-schema baseline is for review only and must never be applied to an existing database. Adopting migrations later requires a separate operator-approved project covering backups, exact schema comparison, migration-ledger baselining, replay against disposable databases, and a reviewed rollout procedure.

The populated order-table transition has a dedicated, guarded [order columns cutover runbook](docs/order-columns-cutover.md). It performs the required nullable staging, deterministic backfill, verification, and final constraints without adopting the untrusted baseline as a migration ledger.

To clone the Supabase `public` schema into local PostgreSQL, configure `SUPABASE_DATABASE_URL`, then run:

```sh
pnpm db:clone:supabase
```

The clone script restores into `DATABASE_URL` (or the URL given as its second argument). It refuses non-local restore targets and requires typing `clone` before replacing the local `public` schema; `CONFIRM_CLONE=clone` answers that prompt for non-interactive runs.

## Trigger.dev analytics jobs

Trigger.dev values are workflow-specific and are not required for core web application startup. Analytics schedules are declared in `src/trigger/analytics.ts`, in the shop's time zone as Trigger.dev names it: `Asia/Calcutta`, set in `src/trigger/analytics-schedule.ts`. It is the legacy alias of `Asia/Kolkata`, the time zone the app itself uses (`src/lib/shop-calendar.ts`).

```sh
pnpm trigger:dev
pnpm trigger:deploy
pnpm analytics:trigger:daily
pnpm analytics:trigger:monthly
```

- `trigger:dev` runs tasks locally.
- `trigger:deploy` deploys tasks and declarative schedules.
- `analytics:trigger:daily` requests the daily closed-day repair window on demand.
- `analytics:trigger:monthly` requests monthly analytics compilation on demand.

## Architecture documentation

- [System context](CONTEXT.md)
- [Design system](docs/design/DESIGN.md)
- [ADR 0001: Record project decisions in ADRs](docs/adr/0001-record-architecture-decisions.md)
- [ADR 0002: Use IST business day boundaries for store reporting](docs/adr/0002-use-ist-business-day-boundaries.md)
- [ADR 0003: Precompute analytics from completed orders](docs/adr/0003-precompute-analytics-from-completed-orders.md)
- [ADR 0004: Dashboard refreshes use abortable API requests](docs/adr/0004-dashboard-refreshes-use-abortable-api-requests.md)
- [ADR 0005: Use revenue bars and orders line for dashboard charts](docs/adr/0005-use-revenue-bars-and-orders-line-for-dashboard-charts.md) (superseded by ADR 0009)
- [ADR 0006: Keep auth boundaries explicit](docs/adr/0006-keep-auth-boundaries-explicit.md)
- [ADR 0007: Use Trigger.dev for analytics orchestration](docs/adr/0007-use-trigger-dev-for-analytics-orchestration.md)
- [ADR 0008: Remove weekly analytics aggregate](docs/adr/0008-remove-weekly-analytics-aggregate.md)
- [ADR 0009: Use one revenue bar chart with a selected slot](docs/adr/0009-use-one-revenue-bar-chart-with-a-selected-slot.md)
