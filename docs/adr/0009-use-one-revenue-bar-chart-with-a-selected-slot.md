# ADR 0009: Use One Revenue Bar Chart With A Selected Slot

## Status

Accepted. Supersedes [ADR 0005](0005-use-revenue-bars-and-orders-line-for-dashboard-charts.md).

## Context

ADR 0005 chose revenue bars with an orders line on a second y-axis. On phones the two axes and the overlaid line were hard to read, and the redesign for phones needed one chart that works from 360px up.

## Decision

Use one revenue bar chart for Insights revenue views, with order counts read from the selected slot rather than drawn as a second series.

Implementation: `src/features/insights/revenue-chart.tsx`, used by Insights › Day (revenue by day) and Insights › Month (revenue by month and by Business Week). It renders a phone bar chart, or a Recharts chart once its card is wide enough; both share the scale, colours and selection.

- Bars show revenue on a single rupee axis with three round ticks.
- One bar is selected; the summary under the chart and the tooltip give that slot's revenue and order count.
- With fewer than two slots with sales there is no trend to chart: Insights › Day shows the selected day's sales by hour instead (or "No sales on this day."), and Insights › Month shows a sentence with the one slot's figures, if any.
- Avoid decorative shapes, dots, or overly conceptual visual encodings unless there is a clear operational benefit.

## Consequences

- Admin users get one chart language across daily, weekly and monthly views.
- Revenue stays visually primary; order volume is read from the selected slot instead of a second axis.
- Future chart changes should preserve clarity over novelty.
