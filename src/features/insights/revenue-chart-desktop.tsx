"use client";

import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { BAR_COLOUR, chartScale, DESKTOP_CHART_HEIGHT, type RevenueSlot } from "@/features/insights/chart-slots";
import { formatCount, formatINR, formatINRCompact, UNIT } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The wide form of `RevenueChart`, with the phone chart's scale, colours and selection. */
export default function DesktopRevenueChart({
	slots,
	selectedKey,
	onSelect,
	disabled,
}: {
	slots: readonly RevenueSlot[];
	selectedKey: string | null;
	onSelect: (key: string) => void;
	disabled: boolean;
}) {
	const { top, ticks } = chartScale(slots);
	const data = slots.map((slot) => ({ ...slot, wideAxisLabel: slot.wideAxisLabel ?? slot.axisLabel }));

	return (
		<ChartContainer className={cn(DESKTOP_CHART_HEIGHT, "w-full")}>
			<BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
				<CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" />
				<XAxis dataKey="wideAxisLabel" axisLine={false} tickLine={false} tickMargin={10} interval={0} />
				<YAxis
					axisLine={false}
					tickLine={false}
					tickMargin={8}
					domain={[0, top]}
					ticks={ticks}
					tickFormatter={(value) => formatINRCompact(value)}
					width={56}
				/>
				<Tooltip
					cursor={{ fill: "var(--muted)" }}
					content={
						<ChartTooltipContent
							title={(items) => {
								const slot = items[0]?.payload as RevenueSlot | undefined;
								return slot ? [slot.title, slot.subtitle].filter(Boolean).join(" · ") : null;
							}}
							renderItem={(item) => {
								const slot = item.payload as RevenueSlot | undefined;
								return (
									<div className="flex w-full flex-col gap-0.5">
										<span className="font-semibold text-foreground tabular-nums">{formatINR(slot?.revenue ?? 0)}</span>
										<span className="text-muted-foreground tabular-nums">
											{formatCount(slot?.orders ?? 0, UNIT.order)}
										</span>
									</div>
								);
							}}
						/>
					}
				/>
				<Bar
					dataKey="revenue"
					radius={[5, 5, 0, 0]}
					maxBarSize={44}
					isAnimationActive={false}
					onClick={(entry: unknown) => {
						const slot = (entry as { payload?: RevenueSlot }).payload;
						if (slot && !disabled) onSelect(slot.key);
					}}
				>
					{slots.map((slot) => (
						<Cell
							key={slot.key}
							cursor={disabled ? "default" : "pointer"}
							fill={slot.key === selectedKey ? BAR_COLOUR.selected.fill : BAR_COLOUR.rest.fill}
						/>
					))}
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
