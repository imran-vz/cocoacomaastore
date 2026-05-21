import { getAnalyticsDay, istMidnightToUTC } from "@/lib/ist-date";
import { recomputeDayAnalytics, recomputeMonthAnalytics } from "@/lib/recompute-day-analytics";

const DAY_MS = 86_400_000;
const DEFAULT_DAILY_REPAIR_DAYS = 7;

type YearMonth = {
	year: number;
	month: number;
};

export type DailyAnalyticsRepairResult = {
	compiledDays: string[];
};

export type MonthlyAnalyticsResult = {
	compiledMonth: string;
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

export async function compileDailyAnalyticsRepairWindow(
	now = new Date(),
	days = DEFAULT_DAILY_REPAIR_DAYS,
): Promise<DailyAnalyticsRepairResult> {
	const dates = getClosedAnalyticsDays(now, days);

	for (const date of dates) {
		await recomputeDayAnalytics(date);
	}

	return {
		compiledDays: dates.map(formatDay),
	};
}

export async function compilePreviousClosedMonth(now = new Date()): Promise<MonthlyAnalyticsResult> {
	const month = previousMonth(getCurrentISTYearMonth(now));
	const monthDate = istMidnightToUTC(month.year, month.month, 1);

	await recomputeMonthAnalytics(monthDate);

	return {
		compiledMonth: formatMonth(month),
	};
}

export async function revalidateAnalyticsCaches() {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL;
	const secret = process.env.REVALIDATE_SECRET;

	if (!appUrl || !secret) {
		return {
			revalidated: false,
			reason: "NEXT_PUBLIC_APP_URL or REVALIDATE_SECRET is not configured",
		};
	}

	await Promise.all(
		["dashboard", "analytics"].map((tag) =>
			fetch(new URL("/api/revalidate", appUrl), {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({ tag, secret }),
			}).then((response) => {
				if (!response.ok) {
					throw new Error(`Failed to revalidate ${tag}: ${response.status}`);
				}
			}),
		),
	);

	return { revalidated: true };
}
