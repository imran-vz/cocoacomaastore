"use client";

import type * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

/** A Recharts chart that fills its box, with axis ticks, grid and cursor in the theme colours. */
function ChartContainer({
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
	return (
		<div
			data-slot="chart"
			className={cn(
				"flex justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-wrapper]:outline-none! [&_.recharts-wrapper_*]:outline-none!",
				className,
			)}
			{...props}
		>
			<RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
		</div>
	);
}

type TooltipItem = { dataKey?: string | number; name?: string | number; payload?: Record<string, unknown> };

/** The tooltip card: a `title` for the hovered point, then one `renderItem` per series. */
function ChartTooltipContent({
	active,
	payload,
	title,
	renderItem,
}: {
	active?: boolean;
	payload?: TooltipItem[];
	title: (items: TooltipItem[]) => React.ReactNode;
	renderItem: (item: TooltipItem) => React.ReactNode;
}) {
	if (!active || !payload?.length) return null;

	return (
		<div className="grid min-w-38 gap-2 rounded-xl border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/10">
			<div className="font-medium">{title(payload)}</div>
			<div className="grid gap-2">
				{payload.map((item, index) => (
					<div key={item.dataKey ?? item.name ?? index} className="flex w-full flex-wrap items-stretch gap-2">
						{renderItem(item)}
					</div>
				))}
			</div>
		</div>
	);
}

export { ChartContainer, ChartTooltipContent };
