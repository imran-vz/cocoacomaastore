"use client";

import type * as React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-control";
import { sectionViews } from "@/features/shell/routes";
import { usePageTitle } from "@/features/shell/use-page-chrome";

const INSIGHTS_VIEWS = sectionViews("admin", "insights");

/**
 * Shared header for Insights › Day and Insights › Month: the title, the Day | Month
 * switch, and (on Day) the date stepper, which alone carries the date. Both controls sit
 * left-aligned under the title, where Orders puts its stepper; side by side once the
 * content column has room.
 */
export function InsightsHeader({ children }: { children?: React.ReactNode }) {
	const title = usePageTitle();
	return (
		<PageHeader title={title}>
			<div className="flex flex-col gap-3 @2xl/main:flex-row @2xl/main:items-center">
				<div className="@lg/main:w-56 @lg/main:shrink-0">
					<SegmentedLinks aria-label="Insights period" items={INSIGHTS_VIEWS} size="sm" />
				</div>
				{children}
			</div>
		</PageHeader>
	);
}
