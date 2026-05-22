# ADR 0007: Use Trigger.dev For Analytics Orchestration

## Status

Accepted

## Context

Analytics compilation is moving from an operator-run CLI script to scheduled jobs. The project needs daily, weekly, and monthly jobs with IST business-period boundaries, plus a way to run jobs on demand.

## Decision

Use Trigger.dev as the analytics scheduler and orchestration layer. Move analytics compilation into reusable Effect programs called by Trigger.dev tasks and backend actions. Remove the existing direct compile CLI as an operational entry point; if a CLI remains, it should trigger the relevant Trigger.dev job on demand instead of reimplementing compilation.

Schedules are declared in code using Trigger.dev scheduled tasks with Trigger.dev's India timezone id, `timezone: "Asia/Calcutta"`:

- Daily analytics: `10 0 * * *`
- Monthly analytics: `20 0 1 * *`

## Consequences

- Scheduling, retries, and observability live in Trigger.dev.
- Analytics SQL should be centralized in reusable Effect-backed modules rather than split between scripts and jobs.
- Trigger tasks should use the non-Next Effect runtime; server actions that call `next/cache` should use the Next-specific runtime.
- Deployments need Trigger.dev configuration and credentials.
