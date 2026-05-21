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

- `bun run trigger:dev` - run Trigger.dev tasks locally.
- `bun run trigger:deploy` - deploy Trigger.dev tasks and declarative schedules.
- `bun run analytics:trigger:daily` - trigger the daily analytics repair job on demand.
- `bun run analytics:trigger:monthly` - trigger the monthly analytics job on demand.

Schedules are declared in code under `src/trigger/analytics.ts` with Trigger.dev's India timezone id, `Asia/Calcutta`.
