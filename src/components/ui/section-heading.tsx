import type * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ROW_CLASS = "flex min-h-8 items-center justify-between gap-3 pb-2";

/** The one section heading (DESIGN.md §Type): a title, an optional muted count and a quiet action ("Show all"). */
function SectionHeading({
	title,
	count,
	action,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
	count?: number | string;
	action?: React.ReactNode;
}) {
	return (
		<div data-slot="section-heading" className={cn(ROW_CLASS, className)} {...props}>
			<h2 className="text-row text-foreground">
				{title}
				{count !== undefined ? (
					<span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{count}</span>
				) : null}
			</h2>
			{action ? <div className="shrink-0 text-sm">{action}</div> : null}
		</div>
	);
}

/** `SectionHeading` while its page loads. */
function SectionHeadingSkeleton({ width = "w-28", action }: { width?: string; action?: React.ReactNode }) {
	return (
		<div className={ROW_CLASS}>
			<Skeleton className={cn("h-4", width)} />
			{action}
		</div>
	);
}

export { SectionHeading, SectionHeadingSkeleton };
