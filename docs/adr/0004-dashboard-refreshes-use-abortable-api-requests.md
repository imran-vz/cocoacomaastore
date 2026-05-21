# ADR 0004: Dashboard Refreshes Use Abortable API Requests

## Status

Accepted

## Context

The dashboard date switcher can trigger multiple data refreshes quickly. Calling server actions directly from the client does not provide a browser `AbortSignal`, so older responses could resolve after newer ones and overwrite the UI with stale dashboard data.

## Decision

Dashboard date refreshes go through `src/app/api/admin/dashboard/route.ts`.

The client in `src/app/admin/dashboard/dashboard-content.tsx` should:

- Use `AbortController` for each date request.
- Abort the previous in-flight request before starting a new one.
- Use a request id guard so stale responses cannot update state.
- Abort any in-flight request on unmount.
- Fetch with `cache: "no-store"`.

The API route repeats admin auth/role checks and returns all dashboard slices in one payload:

- Stats.
- Stock.
- Audit logs.
- Daily revenue chart data.

## Consequences

- Rapid date switching remains responsive and avoids stale UI.
- API route protection is required because layouts do not protect direct API access.
- The route may still finish DB work after a client abort depending on runtime/database behavior, but the client request is aborted and stale responses are ignored.
