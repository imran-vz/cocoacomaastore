"use client";

import { BAR_COLOUR, type ChartSlot, chartScale, PHONE_CHART_HEIGHT } from "@/features/insights/chart-slots";
import { formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The phone revenue chart (DESIGN.md §Colour, "Charts"): a 3-step rupee scale and every slot
 * on the x-axis, including slots with no sales. Without `onSelect` it is a picture: the bars
 * are not buttons and the plot is hidden from assistive tech.
 */
export function BarChart<T extends ChartSlot>({
	slots,
	selectedKey,
	onSelect,
	describe,
	disabled = false,
	labelEvery = 1,
}: {
	slots: readonly T[];
	selectedKey: string | null;
	onSelect?: (key: string) => void;
	/** Accessible name for a bar. */
	describe?: (slot: T) => string;
	disabled?: boolean;
	/** Print every n-th axis label. */
	labelEvery?: number;
}) {
	const { top, ticks } = chartScale(slots);
	const dense = slots.length > 8;
	const interactive = Boolean(onSelect);

	return (
		<div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2" aria-hidden={interactive ? undefined : true}>
			<div
				className={cn("relative w-9 text-[11px] leading-none text-muted-foreground tabular-nums", PHONE_CHART_HEIGHT)}
				aria-hidden="true"
			>
				{ticks.map((tick) => (
					<span
						key={tick}
						className="absolute right-0 -translate-y-1/2"
						style={{ top: `${100 - (tick / top) * 100}%` }}
					>
						{formatINRCompact(tick)}
					</span>
				))}
			</div>

			<div className={cn("relative", PHONE_CHART_HEIGHT)}>
				{ticks.map((tick) => (
					<span
						key={tick}
						aria-hidden="true"
						className={cn(
							"absolute inset-x-0 border-t",
							tick === 0 ? "border-border" : "border-dashed border-border/80",
						)}
						style={{ top: `${100 - (tick / top) * 100}%` }}
					/>
				))}
				<div className={cn("relative flex h-full items-end", dense ? "gap-1" : "gap-2")}>
					{slots.map((slot) => {
						const isSelected = slot.key === selectedKey;
						const height = slot.revenue > 0 ? Math.max(3, (slot.revenue / top) * 100) : 0;
						const bar =
							height > 0 ? (
								<span
									key="bar"
									aria-hidden="true"
									className={cn(
										"w-full max-w-8 rounded-t-[5px] transition-colors motion-reduce:transition-none",
										isSelected || !interactive ? BAR_COLOUR.selected.className : BAR_COLOUR.rest.className,
									)}
									style={{ height: `${height}%` }}
								/>
							) : null;
						return interactive ? (
							<button
								key={slot.key}
								type="button"
								aria-pressed={isSelected}
								aria-label={describe?.(slot)}
								disabled={disabled}
								onClick={() => onSelect?.(slot.key)}
								className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus-ring rounded-t-md"
							>
								{bar}
							</button>
						) : (
							<span key={slot.key} className="flex h-full min-w-0 flex-1 items-end justify-center">
								{bar}
							</span>
						);
					})}
				</div>
			</div>

			<div aria-hidden="true" />
			<div className={cn("mt-2 flex", dense ? "gap-1" : "gap-2")} aria-hidden="true">
				{slots.map((slot, index) => (
					<span
						key={slot.key}
						className={cn(
							"min-w-0 flex-1 text-center text-[11px] leading-4 tabular-nums",
							labelEvery > 1 ? "overflow-visible whitespace-nowrap" : "truncate",
							slot.key === selectedKey ? "font-semibold text-foreground" : "text-muted-foreground",
						)}
					>
						{index % labelEvery === 0 ? slot.axisLabel : null}
					</span>
				))}
			</div>
		</div>
	);
}
