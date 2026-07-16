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
| Optional Trigger.dev workflows | `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY` | Required for the Trigger.dev workflows below, not for core web application startup. |
| Optional database cloning | `SUPABASE_DATABASE_URL` or `REMOTE_DATABASE_URL`; `LOCAL_DATABASE_URL` | Supply one remote source and an optional explicit local target for database cloning. |
| One-time administrator bootstrap | `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `COCOACOMAA_BOOTSTRAP_ADMIN_ACKNOWLEDGE_SHARED_DATABASE` | Export only for one invocation and unset immediately afterward. Never persist these values in `.env`. |

The tracked `.env.example` contains placeholders only. `NODE_ENV` is runtime-managed and does not belong in local configuration.

## First administrator bootstrap

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

To clone the Supabase `public` schema into local PostgreSQL, configure `SUPABASE_DATABASE_URL` or `REMOTE_DATABASE_URL`, then run:

```sh
pnpm db:clone:supabase
```

The clone script uses `LOCAL_DATABASE_URL` or falls back to `DATABASE_URL` for the local target. It refuses non-local restore targets and requires typing `clone` before replacing the local `public` schema.

## Trigger.dev analytics jobs

Trigger.dev values are workflow-specific and are not required for core web application startup. Analytics schedules are declared under `src/trigger/analytics.ts` using `Asia/Calcutta`.

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
- [ADR 0001: Record architecture decisions](docs/adr/0001-record-architecture-decisions.md)
- [ADR 0006: Keep auth boundaries explicit](docs/adr/0006-keep-auth-boundaries-explicit.md)
- [ADR 0007: Use Trigger.dev for analytics orchestration](docs/adr/0007-use-trigger-dev-for-analytics-orchestration.md)
