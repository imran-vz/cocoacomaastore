# ADR 0006: Keep Auth Boundaries Explicit

## Status

Accepted

## Context

The app has multiple surfaces with different responsibilities:

- Public/POS ordering.
- Manager operations.
- Admin operations and analytics.

Area layouts redirect visitors who are signed out or in the other area, but server actions and API routes are directly addressable, and Next.js renders pages alongside their layouts, so no entry point may rely on layout-level protection.

## Decision

Use Better Auth as configured in `src/features/access/auth.ts`.

Every entry point checks the session itself, once, through `src/features/access`:

- Each area layout calls `requireArea(area)` (through `AppShell`), which redirects visitors to sign in and staff to their own area. A page calls it again only when it needs the signed-in user; otherwise the page is protected by its data reads.
- Server actions are built with `staffAction` or `adminAction` and return an `ActionResult`.
- API routes are built with `staffRoute` or `adminRoute`.
- Data reads called by pages call `requireStaff()` or `requireAdmin()` (a data access layer); the session lookup is cached per request, so repeating it is cheap.

"Staff" is any signed-in account; "admin" is Better Auth's `admin` role. Future role additions change `src/features/access/area.ts` and these helpers.

## Consequences

- Auth behavior is explicit at each trust boundary.
- Protected API routes and server actions remain safe when called directly; `src/features/access/entry-points.test.ts` checks that every one refuses a signed-out caller before touching the database.
- Future role additions should update these checks deliberately.
