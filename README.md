# Cocoa Comaa Store

This is a Internal Project for Cocoa Comaa.

## Trigger.dev analytics jobs

Analytics compilation is scheduled through Trigger.dev Cloud.

Required environment variables:

- `TRIGGER_PROJECT_REF`
- `TRIGGER_SECRET_KEY`
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `REVALIDATE_SECRET`

Useful commands:

- `pnpm trigger:dev` - run Trigger.dev tasks locally.
- `pnpm trigger:deploy` - deploy Trigger.dev tasks and declarative schedules.
- `pnpm analytics:trigger:daily` - trigger the daily analytics repair job on demand.
- `pnpm analytics:trigger:monthly` - trigger the monthly analytics job on demand.

Schedules are declared in code under `src/trigger/analytics.ts` with Trigger.dev's India timezone id, `Asia/Calcutta`.

## Local database clone

Use `pnpm db:clone:supabase` to clone the Supabase `public` schema into local Postgres. The script reads `SUPABASE_DATABASE_URL` and uses `LOCAL_DATABASE_URL` or `DATABASE_URL` for the local target. It refuses to restore into a non-local host and requires typing `clone` before dropping the local `public` schema.
