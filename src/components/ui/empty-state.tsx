import type * as React from "react";

import { BrandLogo } from "@/components/brand-lockup";
import { cn } from "@/lib/utils";

/**
 * The one empty / zero state (DESIGN.md §Empty states).
 *
 * - `inline` (default): one muted line inside a card. For a section with nothing in it
 *   ("No stock changes on this day.", "No hidden combos.").
 * - `block`: the brand logo, a title and one line, centred. For a whole screen or pane
 *   with nothing to do ("Nothing to count today", the empty cart). An optional `action`
 *   (one button or link) sits under the line.
 *
 * `framed` (default true) draws the card; pass `false` when the state already sits inside a
 * card or list. Never a dashed border, an icon circle or a coloured headline.
 *
 * ```tsx
 * <EmptyState description="No stock changes on this day." />
 * <EmptyState variant="block" title="Nothing to count today" description="Every dessert on sale has unlimited stock." />
 * ```
 */
export type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
	variant?: "inline" | "block";
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: React.ReactNode;
	framed?: boolean;
	/** Replace the logo in the block variant (rarely needed). */
	mark?: React.ReactNode;
};

export function EmptyState({
	variant = "inline",
	title,
	description,
	action,
	framed = true,
	mark,
	className,
	...props
}: EmptyStateProps) {
	if (variant === "inline") {
		return (
			<div
				data-slot="empty-state"
				data-variant="inline"
				className={cn(
					"text-[15px] text-muted-foreground text-pretty md:text-sm",
					framed && "rounded-xl border bg-card px-4 py-3.5",
					className,
				)}
				{...props}
			>
				{title ? <p className="font-semibold text-foreground">{title}</p> : null}
				{description ? <p>{description}</p> : null}
				{action ? <div className="mt-2">{action}</div> : null}
			</div>
		);
	}

	return (
		<div
			data-slot="empty-state"
			data-variant="block"
			className={cn(
				"flex flex-col items-center px-6 py-10 text-center",
				framed && "rounded-xl border bg-card",
				className,
			)}
			{...props}
		>
			{mark ?? <BrandLogo size={48} />}
			{title ? <p className="mt-3 text-[15px] font-semibold text-foreground text-balance">{title}</p> : null}
			{description ? <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">{description}</p> : null}
			{action ? <div className="mt-4">{action}</div> : null}
		</div>
	);
}
