"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCount, formatINR, formatINRCompact } from "@/lib/format";
import { type ChartSlot, chartScale } from "./bar-chart";

const chartConfig = {
	revenue: {
		label: "Revenue",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

/**
 * Desktop form of the 7-day chart: one series, the same 3-step scale as phones, and the
 * same selection (selected bar in primary, the rest primary/25; click to select).
 */
export default function DesktopRevenueChart({
	slots,
	selectedKey,
	onSelect,
	axisKey = "axisLabel",
}: {
	slots: ChartSlot[];
	/** Field to print on the x-axis; the 7-day chart prints its full "16 Nov" titles here. */
	axisKey?: string;
	selectedKey: string | null;
	onSelect: (key: string) => void;
}) {
	const { top, ticks } = chartScale(Math.max(...slots.map((slot) => slot.revenue), 0));

	return (
		<ChartContainer config={chartConfig} className="h-64 w-full">
			<BarChart accessibilityLayer data={slots} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
				<CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" />
				<XAxis dataKey={axisKey} axisLine={false} tickLine={false} tickMargin={10} interval={0} />
				<YAxis
					axisLine={false}
					tickLine={false}
					tickMargin={8}
					domain={[0, top]}
					ticks={ticks}
					tickFormatter={(value) => formatINRCompact(value)}
					width={52}
				/>
				<ChartTooltip
					cursor={{ fill: "var(--muted)" }}
					content={
						<ChartTooltipContent
							hideIndicator
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
					maxBarSize={44}
					isAnimationActive={false}
					onClick={(entry: unknown) => {
						const slot = (entry as { payload?: ChartSlot }).payload;
						if (slot) onSelect(slot.key);
					}}
				>
					{slots.map((slot) => (
						<Cell
							key={slot.key}
							cursor="pointer"
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
