# ADR 0002: Use IST Business Day Boundaries For Store Reporting

## Status

Accepted

## Context

Cocoa Comaa operates in India, so dashboard and analytics dates must match Asia/Kolkata business days. JavaScript `Date`, PostgreSQL timestamps, and server runtime defaults can otherwise drift into UTC/local-machine assumptions, especially around daily analytics and date switchers.

Analytics had bugs caused by inconsistent day and month boundaries. The current code centralizes reporting time helpers in `src/lib/ist-date.ts`.

## Decision

Use Asia/Kolkata as the business reporting timezone.

All business-day and reporting-month calculations should go through `src/lib/ist-date.ts` helpers:

- `getStartOfDayIST`
- `getEndOfDayIST`
- `getAnalyticsDay`
- `getDayKey`
- `getISTMonthKey`
- `istMidnightToUTC`
- `pgTimestamp`

Dashboard live queries should filter orders using IST day start/end bounds. Analytics rows should use normalized analytics day/month keys.

## Consequences

- Dashboard counts, order lists, audit logs, and analytics reports align to the store's operating timezone.
- Future code should avoid inline `new Date()` boundary logic for reporting.
- Tests and scripts that create dated data must be explicit about the intended business day.
