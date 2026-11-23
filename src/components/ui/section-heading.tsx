import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The one section heading style (DESIGN.md §Type): sentence case, 15/600, foreground,
 * with an optional count in muted text and an optional quiet trailing action
 * ("Show all"). Never coloured, never an emoji.
 */
export type SectionHeadingProps = Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
	count?: number | string;
	action?: React.ReactNode;
	/** Heading level; defaults to h2. */
	as?: "h2" | "h3";
};

function SectionHeading({ title, count, action, as: Tag = "h2", className, ...props }: SectionHeadingProps) {
	return (
		<div
			data-slot="section-heading"
			className={cn("flex min-h-8 items-center justify-between gap-3 pb-2", className)}
			{...props}
		>
			<Tag className="text-[15px] leading-5 font-semibold text-foreground">
				{title}
				{count !== undefined ? (
					<span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{count}</span>
				) : null}
			</Tag>
			{action ? <div className="shrink-0 text-sm">{action}</div> : null}
		</div>
	);
}

export { SectionHeading };
