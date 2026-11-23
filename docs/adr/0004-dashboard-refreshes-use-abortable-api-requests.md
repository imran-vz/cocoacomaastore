# ADR 0004: Dashboard Refreshes Use Abortable API Requests

## Status

Accepted

## Context

The dashboard date switcher can trigger multiple data refreshes quickly. Calling server actions directly from the client does not provide a browser `AbortSignal`, so older responses could resolve after newer ones and overwrite the UI with stale dashboard data.

## Decision

Dashboard date refreshes go through `src/app/api/admin/dashboard/route.ts`.

The client in `src/features/insights/dashboard-content.tsx` reads each shop day as its own React Query query (`insightsQueries.day` in `src/features/insights/client.ts`):

- The query function passes React Query's `AbortSignal` to `fetch`, so a request for a day the admin has moved away from is aborted.
- A response can only fill its own day's query, so a late response never overwrites the selected day.
- While the next day loads, the previous day's data stays visible as placeholder data behind loading states.
- Requests use `cache: "no-store"`; server-side caching is by cache tag.

The API route repeats the admin check and returns the whole day report in one payload: the day's totals, the week's trend, stock and audit logs.

## Consequences

- Rapid date switching remains responsive and avoids stale UI.
- API route protection is required because layouts do not protect direct API access.
- The route may still finish DB work after a client abort, but the response is discarded.
