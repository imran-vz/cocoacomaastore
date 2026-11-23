/** One bar on a revenue chart: a day, week, month or hour. */
export type ChartSlot = {
	key: string;
	/** Short axis label: `23`, `Sep`, `W2`, `2 PM`. */
	axisLabel: string;
	revenue: number;
	orders: number;
};

export type RevenueSlot = ChartSlot & {
	/** Names the slot in the tooltip and the summary under the chart. */
	title: string;
	subtitle?: string;
	/** Axis label when the chart is wide, if it differs from the phone's `axisLabel`. */
	wideAxisLabel?: string;
};

export const PHONE_CHART_HEIGHT = "h-40 md:h-48";
export const DESKTOP_CHART_HEIGHT = "h-64";

/**
 * Bar colours shared by the phone and desktop charts: the selected bar in primary, the rest
 * in primary at 25%. The phone chart draws with the classes, Recharts with the fills.
 */
export const BAR_COLOUR = {
	selected: { className: "bg-primary", fill: "var(--primary)" },
	rest: {
		className: "bg-primary/25 group-hover:bg-primary/40",
		fill: "color-mix(in oklch, var(--primary) 25%, transparent)",
	},
} as const;

/** Rounds up to 1, 2, 2.5 or 5 × 10ⁿ. */
function niceCeil(value: number): number {
	if (value <= 0) return 1;
	const exponent = 10 ** Math.floor(Math.log10(value));
	const fraction = value / exponent;
	const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
	return nice * exponent;
}

/** Three ticks (0, mid, top) with a round top above the largest revenue. */
export function chartScale(slots: readonly ChartSlot[]): { top: number; ticks: [number, number, number] } {
	const maxValue = Math.max(...slots.map((slot) => slot.revenue), 0);
	const step = niceCeil(Math.max(maxValue, 1) / 2);
	return { top: step * 2, ticks: [0, step, step * 2] };
}

/** A trend chart, and a "best" slot, need this many slots with sales; with fewer, a sentence replaces the chart. */
const MIN_SALES_SLOTS = 2;

export function hasTrend(slots: readonly { revenue: number }[]): boolean {
	return slots.filter((slot) => slot.revenue > 0).length >= MIN_SALES_SLOTS;
}

export function bestSlot<T extends ChartSlot>(slots: readonly T[]): T | null {
	return slots.reduce<T | null>((best, slot) => (slot.revenue > (best?.revenue ?? 0) ? slot : best), null);
}

export type SlotStepper = {
	onPrevious: () => void;
	onNext: () => void;
	canPrevious: boolean;
	canNext: boolean;
	previousLabel: string;
	nextLabel: string;
};

/** Previous/next controls that move a selection through `slots` without wrapping. */
export function slotStepper<T extends ChartSlot>(
	slots: readonly T[],
	selected: T | null,
	onSelect: (key: string) => void,
	unit: string,
): SlotStepper | undefined {
	if (!selected || slots.length < 2) return undefined;
	const index = slots.findIndex((slot) => slot.key === selected.key);
	return {
		onPrevious: () => {
			const previous = slots[index - 1];
			if (previous) onSelect(previous.key);
		},
		onNext: () => {
			const next = slots[index + 1];
			if (next) onSelect(next.key);
		},
		canPrevious: index > 0,
		canNext: index < slots.length - 1,
		previousLabel: `Previous ${unit}`,
		nextLabel: `Next ${unit}`,
	};
}
