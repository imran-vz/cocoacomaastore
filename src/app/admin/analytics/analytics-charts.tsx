"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { chartScale } from "@/components/admin/dashboard/bar-chart";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCount, formatINR, formatINRCompact } from "@/lib/format";
import type { TrendSlot } from "./analytics-content";

const trendChartConfig = {
	revenue: {
		label: "Revenue",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

/**
 * Desktop revenue trend on Insights › Month: one series with the same 3-step scale as the
 * phone chart. Like the phone chart, clicking a bar selects it (primary, the rest
 * primary/25); the summary under the chart names the selection and holds "View weeks".
 */
export function TrendDesktopChart({
	slots,
	selectedKey,
	isTrendTransitioning,
	onSelect,
}: {
	slots: TrendSlot[];
	selectedKey: string | null;
	isTrendTransitioning: boolean;
	onSelect: (key: string) => void;
}) {
	const { top, ticks } = chartScale(Math.max(...slots.map((slot) => slot.revenue), 0));
	const weekly = slots.some((slot) => !slot.monthKey);

	return (
		<ChartContainer config={trendChartConfig} className="h-72 w-full">
			<BarChart data={slots} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
				<CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" />
				<XAxis dataKey="axisLabel" axisLine={false} tickLine={false} tickMargin={10} interval={0} />
				<YAxis
					axisLine={false}
					tickLine={false}
					tickMargin={8}
					domain={[0, top]}
					ticks={ticks}
					tickFormatter={(value) => formatINRCompact(value)}
					width={56}
				/>
				<ChartTooltip
					cursor={{ fill: "var(--muted)" }}
					content={
						<ChartTooltipContent
							hideIndicator
							labelFormatter={(_label, payload) => {
								const slot = payload?.[0]?.payload as TrendSlot | undefined;
								return slot ? [slot.title, slot.subtitle].filter(Boolean).join(" · ") : null;
							}}
							formatter={(value, _name, item) => (
								<div className="flex w-full flex-col gap-0.5">
									<span className="font-semibold text-foreground tabular-nums">{formatINR(Number(value))}</span>
									<span className="text-muted-foreground tabular-nums">
										{formatCount(Number(item.payload?.orders ?? 0), "orders")}
									</span>
								</div>
							)}
						/>
					}
				/>
				<Bar
					dataKey="revenue"
					fill="var(--color-revenue)"
					radius={[5, 5, 0, 0]}
					maxBarSize={weekly ? 56 : 40}
					isAnimationActive={false}
					onClick={(entry: unknown) => {
						const slot = (entry as { payload?: TrendSlot }).payload;
						if (slot && !isTrendTransitioning) onSelect(slot.key);
					}}
				>
					{slots.map((slot) => (
						<Cell
							key={slot.key}
							cursor={isTrendTransitioning ? "default" : "pointer"}
							fill={
								slot.key === selectedKey
									? "var(--color-revenue)"
									: "color-mix(in oklch, var(--primary) 25%, transparent)"
							}
						/>
					))}
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
