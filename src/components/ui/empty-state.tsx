import type * as React from "react";

import { BrandLogo } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one empty or zero state (DESIGN.md §Empty states). `inline`: a muted line for a section
 * with nothing in it. `block`: the brand logo, a title and a line for a whole screen or pane,
 * with an optional `action`. `framed={false}` when it already sits inside a card or list.
 * `onRetry` makes it the notice for something that didn't load: an alert with a "Try again" action.
 */
export function EmptyState({
	variant = "inline",
	title,
	description,
	action: actionProp,
	onRetry,
	framed = true,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	variant?: "inline" | "block";
	title?: React.ReactNode;
	description?: React.ReactNode;
	action?: React.ReactNode;
	onRetry?: () => void;
	framed?: boolean;
}) {
	const action =
		actionProp ??
		(onRetry ? (
			<Button variant="outline" size="sm" onClick={onRetry}>
				Try again
			</Button>
		) : null);
	const role = onRetry ? "alert" : undefined;

	if (variant === "inline") {
		return (
			<div
				data-slot="empty-state"
				className={cn(
					"text-[15px] text-muted-foreground text-pretty md:text-sm",
					framed && "surface-card px-4 py-3.5",
					className,
				)}
				role={role}
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
			className={cn("flex flex-col items-center px-6 py-10 text-center", framed && "surface-card", className)}
			role={role}
			{...props}
		>
			<BrandLogo size={48} />
			{title ? <p className="mt-3 text-row text-foreground text-balance">{title}</p> : null}
			{description ? <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">{description}</p> : null}
			{action ? <div className="mt-4">{action}</div> : null}
		</div>
	);
}
