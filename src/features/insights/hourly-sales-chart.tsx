"use client";

import { BarChart } from "@/features/insights/bar-chart";
import { ChartSlotDetail } from "@/features/insights/chart-slot-detail";
import { bestSlot } from "@/features/insights/chart-slots";
import type { HourSlot } from "@/features/insights/hourly-sales";
import { formatCount, formatHourRange, formatINR, formatPercent, UNIT } from "@/lib/format";

/**
 * Sales by hour for the selected day. A picture, not a control: the bars are not buttons and
 * the hourly figures are listed for screen readers. The line under it names the busiest
 * hour and its share of the day, so it never repeats the Revenue or Orders figures above.
 */
export function HourlySalesChart({ slots }: { slots: HourSlot[] }) {
	const total = slots.reduce((sum, slot) => sum + slot.revenue, 0);
	const busiest = bestSlot(slots);
	const salesHours = slots.filter((slot) => slot.revenue > 0);

	return (
		<div className="surface-card p-4">
			<BarChart
				slots={slots}
				selectedKey={busiest?.key ?? null}
				labelEvery={slots.length > 12 ? 4 : slots.length > 8 ? 3 : 2}
			/>
			<ul className="sr-only">
				{salesHours.map((slot) => (
					<li key={slot.key}>
						{formatHourRange(slot.hour)}: {formatINR(slot.revenue)}, {formatCount(slot.orders, UNIT.order)}
					</li>
				))}
			</ul>
			{busiest ? (
				<ChartSlotDetail
					className="mt-4"
					title="Busiest hour"
					value={formatHourRange(busiest.hour)}
					meta={`${formatPercent(total > 0 ? busiest.revenue / total : 0)} of the day's revenue`}
					note={salesHours.length > 1 ? `Sales in ${formatCount(salesHours.length, UNIT.hour)}` : undefined}
				/>
			) : null}
		</div>
	);
}
