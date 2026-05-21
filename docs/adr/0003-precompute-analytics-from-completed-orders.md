# ADR 0003: Precompute Analytics From Completed Orders

## Status

Accepted

## Context

The admin dashboard and analytics pages need fast reads for revenue, order counts, dessert performance, and stock snapshots. Computing every report directly from order history on each page load would make the admin area slower as data grows.

The source of truth remains the order and inventory tables. Analytics tables are derived read models.

## Decision

Precompute analytics into `analytics_*` tables from completed, non-deleted orders.

Scheduled compilation is orchestrated by Trigger.dev tasks and backed by reusable TypeScript analytics functions.

Incremental recomputation lives in `src/lib/recompute-day-analytics.ts` and updates affected daily/monthly analytics after order mutations.

Analytics should count distinct orders where line-item joins could duplicate an order.

## Consequences

- Dashboard and analytics pages can read small pre-aggregated tables.
- Mutation paths must recompute affected analytics and revalidate relevant cache tags.
- Analytics correctness depends on keeping batch and inline recompute logic aligned.
- Derived analytics rows may be safely overwritten from source data.
