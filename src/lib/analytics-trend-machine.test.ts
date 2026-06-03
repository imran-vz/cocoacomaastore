import { describe, expect, test } from "vitest";
import {
	displayedTrendMonth,
	getTrendTransition,
	initialTrendState,
	isReturningToMonthly,
	selectedTrendMonth,
	type TrendState,
	trendReducer,
} from "@/lib/analytics-trend-machine";

const entering: TrendState = { status: "entering", month: "2024-05" };
const weekly: TrendState = { status: "weekly", month: "2024-05" };
const exiting: TrendState = { status: "exiting", month: "2024-05" };

describe("analytics-trend-machine", () => {
	describe("transitions", () => {
		test("select drills into a month from any state", () => {
			for (const state of [initialTrendState, entering, weekly, exiting]) {
				expect(trendReducer(state, { type: "select", month: "2024-07" })).toEqual({
					status: "entering",
					month: "2024-07",
				});
			}
		});

		test("loaded commits the weekly view only while entering", () => {
			expect(trendReducer(entering, { type: "loaded" })).toEqual(weekly);
			expect(trendReducer(initialTrendState, { type: "loaded" })).toBe(initialTrendState);
			expect(trendReducer(weekly, { type: "loaded" })).toBe(weekly);
			expect(trendReducer(exiting, { type: "loaded" })).toBe(exiting);
		});

		test("clear starts the exit animation only from the weekly view", () => {
			expect(trendReducer(weekly, { type: "clear" })).toEqual(exiting);
			expect(trendReducer(initialTrendState, { type: "clear" })).toBe(initialTrendState);
			expect(trendReducer(entering, { type: "clear" })).toBe(entering);
			expect(trendReducer(exiting, { type: "clear" })).toBe(exiting);
		});

		test("exitComplete returns to monthly only while exiting", () => {
			expect(trendReducer(exiting, { type: "exitComplete" })).toEqual(initialTrendState);
			expect(trendReducer(initialTrendState, { type: "exitComplete" })).toBe(initialTrendState);
			expect(trendReducer(entering, { type: "exitComplete" })).toBe(entering);
			expect(trendReducer(weekly, { type: "exitComplete" })).toBe(weekly);
		});

		test("a full drill-in and back cycle", () => {
			let state = initialTrendState;
			state = trendReducer(state, { type: "select", month: "2024-05" });
			expect(state).toEqual(entering);
			state = trendReducer(state, { type: "loaded" });
			expect(state).toEqual(weekly);
			state = trendReducer(state, { type: "clear" });
			expect(state).toEqual(exiting);
			state = trendReducer(state, { type: "exitComplete" });
			expect(state).toEqual(initialTrendState);
		});
	});

	describe("selectors", () => {
		test("selectedTrendMonth tracks every non-monthly state", () => {
			expect(selectedTrendMonth(initialTrendState)).toBeNull();
			expect(selectedTrendMonth(entering)).toBe("2024-05");
			expect(selectedTrendMonth(weekly)).toBe("2024-05");
			expect(selectedTrendMonth(exiting)).toBe("2024-05");
		});

		test("displayedTrendMonth lags until the weekly view is committed", () => {
			expect(displayedTrendMonth(initialTrendState)).toBeNull();
			expect(displayedTrendMonth(entering)).toBeNull();
			expect(displayedTrendMonth(weekly)).toBe("2024-05");
			expect(displayedTrendMonth(exiting)).toBe("2024-05");
		});

		test("isReturningToMonthly is only true while exiting", () => {
			expect(isReturningToMonthly(exiting)).toBe(true);
			for (const state of [initialTrendState, entering, weekly]) {
				expect(isReturningToMonthly(state)).toBe(false);
			}
		});
	});

	describe("getTrendTransition", () => {
		test("monthly view is never weekly or transitioning", () => {
			for (const isFetching of [false, true]) {
				expect(getTrendTransition(initialTrendState, isFetching)).toEqual({
					isWeeklyTrend: false,
					isLoadingTrendMonth: false,
					isTrendTransitioning: false,
				});
			}
		});

		test("entering transitions only while the weekly query is fetching", () => {
			expect(getTrendTransition(entering, true)).toEqual({
				isWeeklyTrend: false,
				isLoadingTrendMonth: true,
				isTrendTransitioning: true,
			});
			expect(getTrendTransition(entering, false)).toEqual({
				isWeeklyTrend: false,
				isLoadingTrendMonth: false,
				isTrendTransitioning: false,
			});
		});

		test("weekly view is settled regardless of fetching", () => {
			for (const isFetching of [false, true]) {
				expect(getTrendTransition(weekly, isFetching)).toEqual({
					isWeeklyTrend: true,
					isLoadingTrendMonth: false,
					isTrendTransitioning: false,
				});
			}
		});

		test("exiting view stays weekly and transitioning", () => {
			for (const isFetching of [false, true]) {
				expect(getTrendTransition(exiting, isFetching)).toEqual({
					isWeeklyTrend: true,
					isLoadingTrendMonth: false,
					isTrendTransitioning: true,
				});
			}
		});
	});
});
