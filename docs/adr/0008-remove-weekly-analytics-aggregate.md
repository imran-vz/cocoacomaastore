# ADR 0008: Remove Weekly Analytics Aggregate

## Status

Accepted

## Context

The schema had an `analytics_weekly_revenue` table and the old compile script populated it with Monday-Sunday ISO-style weeks. The admin dashboard does not read that table; its weekly revenue trend is a daily chart built from `analytics_daily_revenue`.

## Decision

Remove the weekly aggregate table and do not create a weekly Trigger.dev job. Keep the dashboard weekly trend derived from daily analytics rows. The business week remains Tuesday through Sunday, with Monday excluded from weekly reporting buckets.

## Consequences

- Trigger.dev only needs daily and monthly analytics jobs for now.
- Daily analytics become the static source for closed days in the weekly dashboard trend.
- Future weekly summaries should be derived from daily rows unless a concrete UI/report requires a dedicated aggregate.
