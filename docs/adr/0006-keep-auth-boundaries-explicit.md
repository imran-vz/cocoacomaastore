# ADR 0006: Keep Auth Boundaries Explicit

## Status

Accepted

## Context

The app has multiple surfaces with different responsibilities:

- Public/POS ordering.
- Manager operations.
- Admin operations and analytics.

Admin routes are protected by `src/app/admin/layout.tsx`, but API routes are directly addressable and must not assume layout-level protection.

## Decision

Use Better Auth as configured in `src/lib/auth.ts`.

Server-side route protection should use `getServerSession()`.

Admin-only code paths must check:

- A session exists.
- A user exists.
- `user.role === "admin"`.

Manager/user code paths should also verify the session and allowed role before returning protected data or mutating state.

API routes that expose protected data must repeat these checks even if they are only called by protected pages.

## Consequences

- Auth behavior is explicit at each trust boundary.
- Protected API routes remain safe when called directly.
- Future role additions should update these checks deliberately.
