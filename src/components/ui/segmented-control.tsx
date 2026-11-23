"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Segmented control (DESIGN.md §Segmented control), in two forms with one look:
 * `SegmentedControl` picks a value (a radio group with arrow keys); `SegmentedLinks` switches
 * between sibling pages (links with `aria-current="page"`). Both fill their container's width
 * with equal segments; the container sets the width.
 */

type SegmentedSize = "default" | "sm";

/** The track's outline: 44px on phones and, at `sm`, 36px from md. */
export function segmentedTrackShapeClassName(size: SegmentedSize = "sm") {
	return cn("min-h-11 rounded-[10px]", size === "sm" && "md:min-h-9");
}

const trackClass = "flex w-full items-stretch gap-0.5 bg-muted p-[3px]";

const segmentClass =
	"relative inline-flex min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-sm font-semibold text-muted-foreground transition-[color,background-color,box-shadow] select-none hover:text-foreground focus-ring aria-checked:bg-card aria-checked:text-primary aria-checked:shadow-sm aria-[current=page]:bg-card aria-[current=page]:text-primary aria-[current=page]:shadow-sm after:absolute after:inset-x-0 after:-inset-y-[3px]";

function SegmentLabel({ label, count }: { label: React.ReactNode; count?: number | string }) {
	return (
		<>
			<span className="truncate">{label}</span>
			{count !== undefined ? <span className="font-normal text-muted-foreground tabular-nums">{count}</span> : null}
		</>
	);
}

type SegmentedOption<T extends string> = {
	value: T;
	label: React.ReactNode;
	/** Muted figures after the label ("Hidden 131"). */
	count?: number | string;
};

function SegmentedControl<T extends string>({
	options,
	value,
	onValueChange,
	size = "default",
	"aria-label": ariaLabel,
}: {
	options: readonly SegmentedOption<T>[];
	value: T;
	onValueChange: (value: T) => void;
	/** What the choice is: "Stock filter", "Payment method". */
	"aria-label": string;
	size?: SegmentedSize;
}) {
	const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

	const move = (from: number, step: 1 | -1) => {
		const index = (from + step + options.length) % options.length;
		onValueChange(options[index].value);
		refs.current[index]?.focus();
	};

	const onKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			event.preventDefault();
			move(index, 1);
		} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			event.preventDefault();
			move(index, -1);
		}
	};

	return (
		<div
			role="radiogroup"
			aria-label={ariaLabel}
			data-slot="segmented-control"
			className={cn(trackClass, segmentedTrackShapeClassName(size))}
		>
			{options.map((option, index) => {
				const checked = option.value === value;
				return (
					// biome-ignore lint/a11y/useSemanticElements: APG radio-group pattern (roving tabindex); native radios can't carry the 44px segment styling.
					<button
						key={option.value}
						ref={(node) => {
							refs.current[index] = node;
						}}
						type="button"
						role="radio"
						aria-checked={checked}
						tabIndex={checked ? 0 : -1}
						onClick={() => onValueChange(option.value)}
						onKeyDown={onKeyDown(index)}
						className={segmentClass}
					>
						<SegmentLabel label={option.label} count={option.count} />
					</button>
				);
			})}
		</div>
	);
}

function SegmentedLinks({
	items,
	size = "default",
	"aria-label": ariaLabel,
}: {
	/** Active when `pathname === href`. */
	items: readonly { href: string; label: React.ReactNode }[];
	/** Names the switch: "Catalog sections", "Insights period". */
	"aria-label": string;
	size?: SegmentedSize;
}) {
	const pathname = usePathname();
	return (
		<nav
			aria-label={ariaLabel}
			data-slot="segmented-links"
			className={cn(trackClass, segmentedTrackShapeClassName(size))}
		>
			{items.map((item) => (
				<Link
					key={item.href}
					href={item.href}
					aria-current={pathname === item.href ? "page" : undefined}
					className={segmentClass}
				>
					<SegmentLabel label={item.label} />
				</Link>
			))}
		</nav>
	);
}

/** A `size="sm"` segmented control while its page loads. */
function SegmentedSkeleton({ className }: { className?: string }) {
	return <Skeleton className={cn(segmentedTrackShapeClassName("sm"), className)} />;
}

export { SegmentedControl, SegmentedLinks, SegmentedSkeleton };
