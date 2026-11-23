"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Revenue bar chart shared by Insights (Today and Monthly), sized for phones (DESIGN.md
 * §Colour, "Charts"): one hue (primary for the selected bar, primary/25 for the rest),
 * a 3-step rupee scale, and every slot on the x-axis, including days or months with no
 * sales. The desktop charts reuse `chartScale` so both show the same scale.
 */

export type ChartSlot = {
	key: string;
	/** Short axis label: `23 Nov`, `Sep`, `W2`. */
	axisLabel: string;
	revenue: number;
	orders: number;
};

/** Rounds up to 1, 2, 2.5 or 5 × 10ⁿ. */
function niceCeil(value: number): number {
	if (value <= 0) return 1;
	const exponent = 10 ** Math.floor(Math.log10(value));
	const fraction = value / exponent;
	const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
	return nice * exponent;
}

/** Three ticks (0, mid, top) with a round top above the largest value. */
export function chartScale(maxValue: number): { top: number; ticks: [number, number, number] } {
	const step = niceCeil(Math.max(maxValue, 1) / 2);
	return { top: step * 2, ticks: [0, step, step * 2] };
}

/** Slots with sales. "Best day/month" and the chart itself need at least two. */
export function countSalesSlots(slots: ChartSlot[]): number {
	return slots.filter((slot) => slot.revenue > 0).length;
}

export function bestSlot<T extends ChartSlot>(slots: T[]): T | null {
	return slots.reduce<T | null>((best, slot) => (slot.revenue > (best?.revenue ?? 0) ? slot : best), null);
}

export function RevenueBarChart({
	slots,
	selectedKey,
	onSelect,
	describe,
	labelEvery = 1,
	className,
}: {
	slots: ChartSlot[];
	selectedKey: string | null;
	/** Omit for a picture-only chart (Sales by hour): bars are not buttons and the plot is hidden from assistive tech. */
	onSelect?: (key: string) => void;
	/** Accessible name for a bar: "23 Nov, ₹7,750, 15 orders". */
	describe?: (slot: ChartSlot) => string;
	/** Print every n-th axis label (hours print every third). */
	labelEvery?: number;
	className?: string;
}) {
	const { top, ticks } = chartScale(Math.max(...slots.map((slot) => slot.revenue), 0));
	const dense = slots.length > 8;
	const interactive = Boolean(onSelect);

	return (
		<div
			className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-2", className)}
			aria-hidden={interactive ? undefined : true}
		>
			{/* Scale */}
			<div
				className="relative h-40 w-9 text-[11px] leading-none text-muted-foreground tabular-nums md:h-48"
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

			{/* Plot */}
			<div className="relative h-40 md:h-48">
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
										isSelected || !interactive ? "bg-primary" : "bg-primary/25 group-hover:bg-primary/40",
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
								onClick={() => onSelect?.(slot.key)}
								className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-t-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
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

			{/* Axis */}
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

type SlotStepper = {
	onPrevious: () => void;
	onNext: () => void;
	canPrevious: boolean;
	canNext: boolean;
	/** "Previous month" / "Next month". */
	previousLabel: string;
	nextLabel: string;
};

/**
 * The figure for one slot under the chart.
 *
 * - With `stepper`: the selected slot, centred between 44px previous/next buttons, so a
 *   phone never has to hit a 24px bar to move the selection. `eyebrow` names it
 *   ("August 2026 · selected").
 * - Without: label and meta on the left, the amount on the right.
 */
export function ChartSlotDetail({
	title,
	meta,
	value,
	note,
	action,
	stepper,
	className,
}: {
	title: React.ReactNode;
	meta: React.ReactNode;
	value: React.ReactNode;
	/** Muted word after the meta ("Best day"). */
	note?: React.ReactNode;
	action?: React.ReactNode;
	stepper?: SlotStepper;
	className?: string;
}) {
	if (stepper) {
		return (
			<div className={cn("border-t pt-3", className)}>
				<div className="mx-auto flex max-w-md items-center gap-2">
					<Button
						variant="outline"
						size="icon-touch"
						onClick={stepper.onPrevious}
						disabled={!stepper.canPrevious}
						aria-label={stepper.previousLabel}
					>
						<ChevronLeft aria-hidden="true" />
					</Button>
					<div className="min-w-0 flex-1 text-center" aria-live="polite">
						<p className="text-[13px] leading-[18px] text-muted-foreground">
							<span className="font-semibold text-foreground">{title}</span> · selected
						</p>
						<p className="text-xl leading-7 font-bold whitespace-nowrap text-foreground tabular-nums">{value}</p>
						<p className="text-[13px] leading-[18px] text-muted-foreground tabular-nums">
							{[meta, note].filter(Boolean).map((part, index) => (
								<React.Fragment key={index === 0 ? "meta" : "note"}>
									{index > 0 ? " · " : null}
									{part}
								</React.Fragment>
							))}
						</p>
					</div>
					<Button
						variant="outline"
						size="icon-touch"
						onClick={stepper.onNext}
						disabled={!stepper.canNext}
						aria-label={stepper.nextLabel}
					>
						<ChevronRight aria-hidden="true" />
					</Button>
				</div>
				{action ? <div className="mx-auto mt-3 flex max-w-md justify-center">{action}</div> : null}
			</div>
		);
	}

	return (
		<div className={cn("border-t pt-3", className)} aria-live="polite">
			<div className="flex items-baseline justify-between gap-3">
				<p className="min-w-0 text-[15px] font-semibold text-foreground">{title}</p>
				<p className="shrink-0 text-[17px] font-bold whitespace-nowrap text-foreground tabular-nums">{value}</p>
			</div>
			<div className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground tabular-nums">
				<p className="min-w-0">{meta}</p>
				{note ? <p className="shrink-0">{note}</p> : null}
			</div>
			{action ? <div className="mt-3">{action}</div> : null}
		</div>
	);
}

/** Steps a selection through `slots`, wrapping nowhere: the stepper props for `ChartSlotDetail`. */
export function slotStepper<T extends ChartSlot>(
	slots: T[],
	selected: T | null,
	onSelect: (key: string) => void,
	unit: string,
): SlotStepper | undefined {
	if (!selected || slots.length < 2) return undefined;
	const index = slots.findIndex((slot) => slot.key === selected.key);
	return {
		onPrevious: () => {
			const previous = slots[index - 1];
			if (previous) onSelect(previous.key);
		},
		onNext: () => {
			const next = slots[index + 1];
			if (next) onSelect(next.key);
		},
		canPrevious: index > 0,
		canNext: index < slots.length - 1,
		previousLabel: `Previous ${unit}`,
		nextLabel: `Next ${unit}`,
	};
}

/** Fewer than two slots with sales: a sentence instead of a lone giant bar. */
export function SparseChartState({ message, children }: { message: string; children?: React.ReactNode }) {
	return (
		<div className="space-y-3">
			<EmptyState framed={false} description={message} />
			{children}
		</div>
	);
}
