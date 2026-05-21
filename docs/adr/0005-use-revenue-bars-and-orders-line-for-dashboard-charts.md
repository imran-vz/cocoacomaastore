# ADR 0005: Use Revenue Bars And Orders Line For Dashboard Charts

## Status

Accepted

## Context

The dashboard and analytics charts need to explain two related metrics:

- How many orders came in.
- How much revenue those orders generated.

Several more decorative chart prototypes were confusing. The selected pattern was a simple composed chart: revenue as bars and orders as a line.

## Decision

Use a revenue bar chart with an overlaid orders line for dashboard and analytics revenue views.

Current implementations:

- Weekly dashboard chart: `src/components/admin/dashboard/revenue-chart.tsx`
- Monthly analytics chart: `src/app/admin/analytics/analytics-content.tsx`

The chart should stay operational and familiar:

- Bars represent revenue.
- Line represents order count.
- Revenue and orders use separate y-axes.
- Avoid decorative shapes, dots, or overly conceptual visual encodings unless there is a clear operational benefit.

## Consequences

- Admin users get one consistent chart language across weekly and monthly views.
- Revenue magnitude remains visually primary while order volume remains easy to compare.
- Future chart changes should preserve clarity over novelty.
