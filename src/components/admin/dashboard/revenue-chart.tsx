"use client";

import { lazy, useState } from "react";
import { DesktopChartSlot } from "@/components/desktop-chart-slot";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatDayShort, formatINR, formatPercent } from "@/lib/format";
import { bestSlot, type ChartSlot, ChartSlotDetail, RevenueBarChart, slotStepper } from "./bar-chart";
import { type HourSlot, hourRangeLabel } from "./hourly-sales";

const DesktopRevenueChart = lazy(() => import("./revenue-desktop-chart"));

/** A day slot for the last-7-days chart. `key` is the calendar day (`2026-11-23`). */
export type DaySlot = ChartSlot & { title: string };

function describe(slot: ChartSlot) {
	return `${formatDayShort(slot.key)}, ${formatINR(slot.revenue)}, ${formatCount(slot.orders, "orders")}`;
}

/** Card-sized placeholder for either chart while its data loads. */
export function ChartCardSkeleton() {
	return (
		<div className="rounded-xl border bg-card p-4" aria-hidden="true">
			<Skeleton className="h-40 w-full md:h-48" />
			<Skeleton className="mx-auto mt-4 h-4 w-40" />
		</div>
	);
}

/**
 * Revenue by day for the 7 days ending on the selected day (Insights › Day), shown once
 * at least two of those days had sales. The selected day starts selected so the chart and
 * the figures above it tell the same story; 44px arrows step through the days on phones.
 */
export default function RevenueChart({ slots, selectedDayKey }: { slots: DaySlot[]; selectedDayKey: string }) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const best = bestSlot(slots);
	const selected = slots.find((slot) => slot.key === (selectedKey ?? selectedDayKey)) ?? slots.at(-1) ?? null;

	return (
		<div className="@container rounded-xl border bg-card p-4">
			<div className="@xl:hidden">
				<RevenueBarChart
					slots={slots}
					selectedKey={selected?.key ?? null}
					onSelect={setSelectedKey}
					describe={describe}
				/>
			</div>
			<DesktopChartSlot fallbackClassName="h-64 w-full">
				<DesktopRevenueChart
					slots={slots}
					axisKey="title"
					selectedKey={selected?.key ?? null}
					onSelect={setSelectedKey}
				/>
			</DesktopChartSlot>
			{selected ? (
				<ChartSlotDetail
					className="mt-4"
					title={formatDayShort(selected.key)}
					meta={selected.revenue > 0 ? formatCount(selected.orders, "orders") : "No sales"}
					value={formatINR(selected.revenue)}
					note={selected.key === best?.key ? "Best day" : undefined}
					stepper={slotStepper(slots, selected, setSelectedKey, "day")}
				/>
			) : null}
		</div>
	);
}

/**
 * Sales by hour for the selected day (Insights › Day when the week has fewer than two
 * trading days). A picture, not a control: the bars are not buttons, and the hourly
 * figures are listed for screen readers. The line under it names the busiest hour and its
 * share of the day, so it never repeats the Revenue or Orders figures above.
 */
export function HourlySalesChart({ slots }: { slots: HourSlot[] }) {
	const total = slots.reduce((sum, slot) => sum + slot.revenue, 0);
	const busiest = bestSlot(slots);
	const salesHours = slots.filter((slot) => slot.revenue > 0);

	return (
		<div className="rounded-xl border bg-card p-4">
			<RevenueBarChart
				slots={slots}
				selectedKey={busiest?.key ?? null}
				labelEvery={slots.length > 12 ? 4 : slots.length > 8 ? 3 : 2}
			/>
			<ul className="sr-only">
				{salesHours.map((slot) => (
					<li key={slot.key}>
						{hourRangeLabel(slot.hour)}: {formatINR(slot.revenue)}, {formatCount(slot.orders, "orders")}
					</li>
				))}
			</ul>
			{busiest ? (
				<ChartSlotDetail
					className="mt-4"
					title="Busiest hour"
					value={hourRangeLabel(busiest.hour)}
					meta={`${formatPercent(total > 0 ? busiest.revenue / total : 0)} of the day's revenue`}
					note={
						salesHours.length > 1
							? `Sales in ${formatCount(salesHours.length, { one: "hour", other: "hours" })}`
							: undefined
					}
				/>
			) : null}
		</div>
	);
}
