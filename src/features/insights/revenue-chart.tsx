"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart } from "@/features/insights/bar-chart";
import { DESKTOP_CHART_HEIGHT, PHONE_CHART_HEIGHT, type RevenueSlot } from "@/features/insights/chart-slots";
import { formatCount, formatINR, UNIT } from "@/lib/format";
import { cn } from "@/lib/utils";

const DesktopRevenueChart = lazy(() => import("@/features/insights/revenue-chart-desktop"));

/**
 * Card width (px) from which the Recharts chart replaces the phone chart: Tailwind's `@xl`
 * container size (36rem), which hides the phone chart below.
 */
const WIDE_CHART_MIN_WIDTH = 576;

function useIsWide(ref: React.RefObject<HTMLElement | null>) {
	const [isWide, setIsWide] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const update = () => setIsWide(element.getBoundingClientRect().width >= WIDE_CHART_MIN_WIDTH);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);

	return isWide;
}

/** A bar's accessible name: "Mon, 23 Nov, ₹7,750, 15 orders". */
function describeSlot(slot: RevenueSlot) {
	return `${slot.title}, ${formatINR(slot.revenue)}, ${formatCount(slot.orders, UNIT.order)}`;
}

/**
 * A revenue bar chart with one selected bar. It answers to the width of the card it sits in,
 * not the viewport, so a tablet with the sidebar open keeps the phone chart; the wide chart
 * loads only when it is shown.
 */
export function RevenueChart({
	slots,
	selectedKey,
	onSelect,
	disabled = false,
}: {
	slots: readonly RevenueSlot[];
	selectedKey: string | null;
	onSelect: (key: string) => void;
	disabled?: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const isWide = useIsWide(ref);

	return (
		<div ref={ref} className="@container">
			<div className="@xl:hidden">
				<BarChart
					slots={slots}
					selectedKey={selectedKey}
					onSelect={onSelect}
					describe={describeSlot}
					disabled={disabled}
				/>
			</div>
			{isWide ? (
				<Suspense fallback={<div className={DESKTOP_CHART_HEIGHT} aria-hidden="true" />}>
					<DesktopRevenueChart slots={slots} selectedKey={selectedKey} onSelect={onSelect} disabled={disabled} />
				</Suspense>
			) : null}
		</div>
	);
}

/** Card-sized placeholder for a chart while its data loads. */
export function ChartCardSkeleton() {
	return (
		<div className="surface-card p-4" aria-hidden="true">
			<Skeleton className={cn("w-full", PHONE_CHART_HEIGHT)} />
			<Skeleton className="mx-auto mt-4 h-4 w-40" />
		</div>
	);
}
