import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A status exception the reader must notice (DESIGN.md §Badges): `destructive` for Cancelled,
 * Disabled, Out of stock; `warning` for Low. Routine states get no badge.
 */
function Badge({
	variant,
	className,
	...props
}: React.ComponentProps<"span"> & { variant: "destructive" | "warning" }) {
	return (
		<span
			data-slot="badge"
			className={cn(
				"inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full px-2 text-xs font-semibold tabular-nums [&>svg]:pointer-events-none [&>svg]:size-3!",
				variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-warning/12 text-warning",
				className,
			)}
			{...props}
		/>
	);
}

export { Badge };
