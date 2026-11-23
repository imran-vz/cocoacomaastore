import { Effect, Layer } from "effect";
import { CacheRevalidator } from "@/features/insights/cache-revalidator";
import { recomputeDay, recomputeMonth } from "@/features/insights/compile";
import { addDays, addMonths, type DayKey, dayKeyOf, daysBetween, monthKeyOf } from "@/lib/shop-calendar";
import { Database } from "@/server/effect/services/db";

/** Closed days the daily job rewrites, so the days of runs that were missed or failed are caught up. */
const DAILY_REPAIR_DAYS = 7;

/** The closed shop days the daily job compiles when it runs at `now`, oldest first. */
function dailyRepairWindow(now: Date): DayKey[] {
	const today = dayKeyOf(now);
	return daysBetween(addDays(today, -DAILY_REPAIR_DAYS), addDays(today, -1));
}

const revalidateCompiledAnalytics = Effect.gen(function* () {
	const cache = yield* CacheRevalidator;
	yield* cache.revalidateCompiledAnalytics();
});

export function compileDailyAnalytics(now: Date) {
	const days = dailyRepairWindow(now);
	return Effect.gen(function* () {
		yield* Effect.forEach(days, (day) => recomputeDay(day), { discard: true });
		yield* revalidateCompiledAnalytics;
		return { compiledDays: days };
	});
}

export function compileMonthlyAnalytics(now: Date) {
	const month = addMonths(monthKeyOf(now), -1);
	return Effect.gen(function* () {
		yield* recomputeMonth(month);
		yield* revalidateCompiledAnalytics;
		return { compiledMonth: month };
	});
}

/** The revalidator is built first, so a job missing its configuration never opens the database. */
const AnalyticsJobLive = Database.Live.pipe(Layer.provideMerge(CacheRevalidator.Live));

/**
 * Runs an analytics job outside Next.js. It rejects with `RevalidationNotConfiguredError`
 * before the job starts when the app cannot be asked to refresh its caches.
 */
export function runAnalyticsJob<A, E>(job: Effect.Effect<A, E, Database | CacheRevalidator>) {
	return Effect.runPromise(job.pipe(Effect.provide(AnalyticsJobLive)));
}
