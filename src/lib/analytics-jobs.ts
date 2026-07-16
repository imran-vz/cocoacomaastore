import { Effect } from "effect";
import { getAnalyticsDay, istMidnightToUTC } from "@/lib/ist-date";
import { recomputeDayAnalyticsEffect, recomputeMonthAnalyticsEffect } from "@/lib/recompute-day-analytics";
import { CacheRevalidator } from "@/server/effect/services/cache";

const DAY_MS = 86_400_000;
const DEFAULT_DAILY_REPAIR_DAYS = 7;

type YearMonth = {
	year: number;
	month: number;
};

function formatDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function formatMonth({ year, month }: YearMonth): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}

function previousMonth({ year, month }: YearMonth): YearMonth {
	return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function getCurrentISTYearMonth(now = new Date()): YearMonth {
	const analyticsDay = getAnalyticsDay(now);
	return {
		year: analyticsDay.getUTCFullYear(),
		month: analyticsDay.getUTCMonth() + 1,
	};
}

export function getClosedAnalyticsDays(now = new Date(), days = DEFAULT_DAILY_REPAIR_DAYS): Date[] {
	const currentISTDay = getAnalyticsDay(now);

	return Array.from({ length: days }, (_, index) => {
		const daysAgo = days - index;
		return new Date(currentISTDay.getTime() - daysAgo * DAY_MS);
	});
}

function compileDailyAnalyticsRepairWindowEffect(now = new Date(), days = DEFAULT_DAILY_REPAIR_DAYS) {
	const dates = getClosedAnalyticsDays(now, days);

	return Effect.gen(function* () {
		yield* Effect.forEach(dates, (date) => recomputeDayAnalyticsEffect(date), {
			discard: true,
		});

		return {
			compiledDays: dates.map(formatDay),
		};
	});
}

function compilePreviousClosedMonthEffect(now = new Date()) {
	const month = previousMonth(getCurrentISTYearMonth(now));
	const monthDate = istMidnightToUTC(month.year, month.month, 1);

	return Effect.gen(function* () {
		yield* recomputeMonthAnalyticsEffect(monthDate);

		return {
			compiledMonth: formatMonth(month),
		};
	});
}

function revalidateAnalyticsCachesEffect() {
	return Effect.gen(function* () {
		const cache = yield* CacheRevalidator;

		return yield* cache.revalidateAnalyticsCaches();
	});
}

export function compileDailyAnalyticsTaskEffect(now = new Date()) {
	return Effect.gen(function* () {
		const result = yield* compileDailyAnalyticsRepairWindowEffect(now);
		const revalidation = yield* revalidateAnalyticsCachesEffect();

		return {
			...result,
			revalidation,
		};
	});
}

export function compileMonthlyAnalyticsTaskEffect(now = new Date()) {
	return Effect.gen(function* () {
		const result = yield* compilePreviousClosedMonthEffect(now);
		const revalidation = yield* revalidateAnalyticsCachesEffect();

		return {
			...result,
			revalidation,
		};
	});
}
