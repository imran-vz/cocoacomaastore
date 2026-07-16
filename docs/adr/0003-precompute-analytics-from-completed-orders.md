# ADR 0003: Precompute Analytics From Completed Orders

## Status

Accepted

## Context

The admin dashboard and analytics pages need fast reads for revenue, order counts, dessert performance, and stock snapshots. Computing every report directly from order history on each page load would make the admin area slower as data grows.

The source of truth remains the order and inventory tables. Analytics tables are derived read models.

## Decision

Precompute analytics into `analytics_*` tables from completed, non-deleted orders.

Scheduled compilation is orchestrated by Trigger.dev tasks and backed by reusable TypeScript analytics functions.

The `analytics_*` tables are closed-period read models. At 00:10 IST, the daily Trigger task overwrites the previous seven closed IST days from source truth; monthly compilation remains scheduled after month close.

Current IST-day revenue metrics and chart points read live order tables. End-of-day stock trends include only closed IST days. Order creation and same-day cancellation synchronously invalidate the relevant caches but do not compile analytics in the request path.

Analytics should count distinct orders where line-item joins could duplicate an order.

## Consequences

- Dashboard and analytics pages can read small pre-aggregated tables.
- Current-day revenue stays live without making closed-period reports query full order history.
- End-of-day stock has a clear closed-day boundary and never exposes a stale compiled point for the open day.
- Mutation paths await relevant cache invalidation; cache invalidation is not asynchronous compilation.
- Derived analytics rows may be safely overwritten from source data by scheduled or operator-triggered repair.
- Interactive cancellation cannot change a closed historical day because it is limited to the current operating day.
