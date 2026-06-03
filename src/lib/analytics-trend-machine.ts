/**
 * State machine for the analytics revenue-trend drill-down.
 *
 * The trend card shows monthly revenue by default. Clicking a month drills into
 * that month's weekly breakdown, which requires an async fetch, and clearing it
 * plays a short exit animation before returning to the monthly view. Modelling
 * those phases as one discriminated state keeps the legal combinations
 * (selected month vs. displayed month vs. exiting) impossible to violate.
 */
export type TrendState =
	| { status: "monthly" }
	| { status: "entering"; month: string }
	| { status: "weekly"; month: string }
	| { status: "exiting"; month: string };

export type TrendEvent =
	| { type: "select"; month: string }
	| { type: "loaded" }
	| { type: "clear" }
	| { type: "exitComplete" };

export const initialTrendState: TrendState = { status: "monthly" };

export function trendReducer(state: TrendState, event: TrendEvent): TrendState {
	switch (event.type) {
		case "select":
			return { status: "entering", month: event.month };
		case "loaded":
			return state.status === "entering" ? { status: "weekly", month: state.month } : state;
		case "clear":
			return state.status === "weekly" ? { status: "exiting", month: state.month } : state;
		case "exitComplete":
			return state.status === "exiting" ? initialTrendState : state;
	}
}

/** Month whose weekly data should be fetched (drives the weekly query). */
export function selectedTrendMonth(state: TrendState): string | null {
	return state.status === "monthly" ? null : state.month;
}

/** Month currently rendered as a weekly view (lags `selected` until data loads). */
export function displayedTrendMonth(state: TrendState): string | null {
	return state.status === "weekly" || state.status === "exiting" ? state.month : null;
}

export function isReturningToMonthly(state: TrendState): boolean {
	return state.status === "exiting";
}

/** Derived presentation flags. `isFetchingWeekly` comes from the weekly query. */
export function getTrendTransition(state: TrendState, isFetchingWeekly: boolean) {
	const isWeeklyTrend = state.status === "weekly" || state.status === "exiting";
	const isLoadingTrendMonth = state.status === "entering" && isFetchingWeekly;
	return {
		isWeeklyTrend,
		isLoadingTrendMonth,
		isTrendTransitioning: isLoadingTrendMonth || state.status === "exiting",
	};
}
