# ADR 0002: Use IST Business Day Boundaries For Store Reporting

## Status

Accepted

## Context

Cocoa Comaa operates in India, so dashboard and analytics dates must match Asia/Kolkata business days. JavaScript `Date`, PostgreSQL timestamps, and server runtime defaults can otherwise drift into UTC/local-machine assumptions, especially around daily analytics and date switchers.

Analytics had bugs caused by inconsistent day and month boundaries. The current code centralizes shop time in `src/lib/shop-calendar.ts`.

## Decision

Use Asia/Kolkata as the business reporting timezone.

All business-day and reporting-month calculations go through `src/lib/shop-calendar.ts`, which names shop days and months as `DayKey` ("YYYY-MM-DD") and `MonthKey` ("YYYY-MM") and converts them to UTC instants (`dayStart`, `dayEnd`, `monthStart`, `monthEnd`) and analytics `date` values (`analyticsDate`).

Dashboard live queries filter orders between a shop day's start and end instants. Analytics rows should use normalized analytics day/month keys.

## Consequences

- Dashboard counts, order lists, audit logs, and analytics reports align to the store's operating timezone.
- Future code should avoid inline `new Date()` boundary logic for reporting.
- Tests and scripts that create dated data must be explicit about the intended business day.
