"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Segmented control (DESIGN.md §Segmented control): a warm-grey track with the selected
 * segment raised on the card surface in primary text. 44px tall on phones, compact from md
 * with `size="sm"`. Two forms with one look:
 *
 * - `SegmentedControl`: picks a value (filters, payment method). A radio group with
 *   arrow-key navigation.
 * - `SegmentedLinks`: switches between sibling pages (Desserts | Combos, Today | Monthly).
 *   Plain links with `aria-current="page"`.
 */

const trackClass = "inline-flex items-stretch gap-0.5 rounded-[10px] bg-muted p-[3px] h-11 data-[size=sm]:md:h-9";

/** Plain utilities (not a data variant) so a caller's `md:w-64` can override the width. */
const fullWidthClass = "flex w-full";

const segmentClass =
	"relative inline-flex in-data-[full-width=true]:min-w-0 in-data-[full-width=true]:flex-1 in-data-[full-width=true]:basis-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-sm font-semibold text-muted-foreground transition-[color,background-color,box-shadow] select-none hover:text-foreground focus-ring disabled:cursor-not-allowed disabled:text-muted-foreground/60 disabled:hover:text-muted-foreground aria-checked:bg-card aria-checked:text-primary aria-checked:shadow-sm aria-[current=page]:bg-card aria-[current=page]:text-primary aria-[current=page]:shadow-sm after:absolute after:inset-x-0 after:-inset-y-[3px] [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0";

function SegmentLabel({ label, count }: { label: React.ReactNode; count?: number | string }) {
	return (
		<>
			<span className="truncate">{label}</span>
			{count !== undefined ? (
				<span className="font-normal text-muted-foreground tabular-nums" data-slot="segment-count">
					{count}
				</span>
			) : null}
		</>
	);
}

export type SegmentedOption<T extends string> = {
	value: T;
	label: React.ReactNode;
	/** Optional count shown in muted figures after the label ("Hidden 131"). */
	count?: number | string;
	icon?: React.ComponentType<{ className?: string }>;
	disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
	options: readonly SegmentedOption<T>[];
	value: T;
	onValueChange: (value: T) => void;
	/** Required: what the choice is ("Stock filter", "Payment method"). */
	"aria-label": string;
	/** `"sm"` is 36px from md up; phones always get 44px. */
	size?: "default" | "sm";
	/** Stretch to the container width (equal-width segments). A `md:w-*` className still overrides it. */
	fullWidth?: boolean;
	className?: string;
	disabled?: boolean;
};

function SegmentedControl<T extends string>({
	options,
	value,
	onValueChange,
	size = "default",
	fullWidth = false,
	className,
	disabled,
	...aria
}: SegmentedControlProps<T>) {
	const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

	const move = (from: number, step: 1 | -1) => {
		const count = options.length;
		for (let i = 1; i <= count; i++) {
			const index = (from + step * i + count) % count;
			const option = options[index];
			if (!option.disabled) {
				onValueChange(option.value);
				refs.current[index]?.focus();
				return;
			}
		}
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
			aria-label={aria["aria-label"]}
			data-slot="segmented-control"
			data-size={size}
			data-full-width={fullWidth}
			className={cn(trackClass, fullWidth && fullWidthClass, className)}
		>
			{options.map((option, index) => {
				const checked = option.value === value;
				const Icon = option.icon;
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
						disabled={disabled || option.disabled}
						onClick={() => onValueChange(option.value)}
						onKeyDown={onKeyDown(index)}
						className={segmentClass}
					>
						{Icon ? <Icon aria-hidden="true" /> : null}
						<SegmentLabel label={option.label} count={option.count} />
					</button>
				);
			})}
		</div>
	);
}

export type SegmentedLink = {
	href: string;
	label: React.ReactNode;
	count?: number | string;
	/** Defaults to `pathname === href`. */
	active?: boolean;
};

export type SegmentedLinksProps = {
	items: readonly SegmentedLink[];
	/** Required: names the switch ("Catalog sections", "Insights period"). */
	"aria-label": string;
	size?: "default" | "sm";
	fullWidth?: boolean;
	className?: string;
};

function SegmentedLinks({ items, size = "default", fullWidth = false, className, ...aria }: SegmentedLinksProps) {
	const pathname = usePathname();
	return (
		<nav
			aria-label={aria["aria-label"]}
			data-slot="segmented-links"
			data-size={size}
			data-full-width={fullWidth}
			className={cn(trackClass, fullWidth && fullWidthClass, className)}
		>
			{items.map((item) => {
				const active = item.active ?? pathname === item.href;
				return (
					<Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={segmentClass}>
						<SegmentLabel label={item.label} count={item.count} />
					</Link>
				);
			})}
		</nav>
	);
}

export { SegmentedControl, SegmentedLinks };
