"use client";

import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";

/**
 * Width (px) of the chart card's content box from which the wide (Recharts) chart replaces
 * the phone chart. Equal to Tailwind's `@xl` container size (36rem), so the phone chart
 * hides with `@xl:hidden` inside a card marked `@container` at exactly the same width.
 */
export const WIDE_CHART_MIN_WIDTH = 576;

function useIsWide(ref: React.RefObject<HTMLElement | null>, minWidth: number) {
	const [isWide, setIsWide] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const update = () => setIsWide(element.getBoundingClientRect().width >= minWidth);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref, minWidth]);

	return isWide;
}

/**
 * Mounts the wide chart only when the card it sits in is wide enough: content width, not
 * viewport (decision 1), so 820px with the admin sidebar open keeps the phone chart. Put it
 * next to the phone chart inside an `@container` card whose phone chart uses `@xl:hidden`.
 */
export function DesktopChartSlot({ children, fallbackClassName }: { children: ReactNode; fallbackClassName: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const isWide = useIsWide(ref, WIDE_CHART_MIN_WIDTH);

	return (
		<div ref={ref} className="w-full">
			{isWide ? (
				<Suspense fallback={<div className={fallbackClassName} aria-hidden="true" />}>{children}</Suspense>
			) : null}
		</div>
	);
}
