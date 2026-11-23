"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { SlotStepper } from "@/features/insights/chart-slots";
import { cn } from "@/lib/utils";

/**
 * The figure for one slot under a chart.
 *
 * - With `stepper`: the selected slot between 44px previous/next buttons, so a phone never
 *   has to hit a 24px bar to move the selection.
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
						<p className="text-meta text-muted-foreground">
							<span className="font-semibold text-foreground">{title}</span> · selected
						</p>
						<p className="text-xl leading-7 font-bold whitespace-nowrap text-foreground tabular-nums">{value}</p>
						<p className="text-meta text-muted-foreground tabular-nums">
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
				<p className="min-w-0 text-row text-foreground">{title}</p>
				<p className="shrink-0 text-[17px] font-bold whitespace-nowrap text-foreground tabular-nums">{value}</p>
			</div>
			<div className="mt-0.5 flex items-baseline justify-between gap-3 text-meta text-muted-foreground tabular-nums">
				<p className="min-w-0">{meta}</p>
				{note ? <p className="shrink-0">{note}</p> : null}
			</div>
			{action ? <div className="mt-3">{action}</div> : null}
		</div>
	);
}

/** Too few slots with sales for a trend (`hasTrend`): a sentence instead of a lone giant bar. */
export function SparseChartState({ message, children }: { message: string; children?: React.ReactNode }) {
	return (
		<div className="space-y-3">
			<EmptyState framed={false} description={message} />
			{children}
		</div>
	);
}
