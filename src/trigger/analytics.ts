import { AbortTaskRunError, logger, schedules } from "@trigger.dev/sdk";
import type { Effect } from "effect";
import { type CacheRevalidator, RevalidationNotConfiguredError } from "@/features/insights/cache-revalidator";
import { compileDailyAnalytics, compileMonthlyAnalytics, runAnalyticsJob } from "@/features/insights/jobs";
import type { Database } from "@/server/effect/services/db";
import { ANALYTICS_TASK_ID, TRIGGER_SHOP_TIME_ZONE } from "@/trigger/analytics-schedule";

/** Missing configuration will not fix itself between attempts, so it ends the run instead of retrying. */
async function run<A, E>(job: Effect.Effect<A, E, Database | CacheRevalidator>) {
	try {
		return await runAnalyticsJob(job);
	} catch (error) {
		if (error instanceof RevalidationNotConfiguredError) throw new AbortTaskRunError(error.message);
		throw error;
	}
}

export const dailyAnalyticsJob = schedules.task({
	id: ANALYTICS_TASK_ID.daily,
	cron: {
		pattern: "10 0 * * *",
		timezone: TRIGGER_SHOP_TIME_ZONE,
	},
	run: async (payload) => {
		logger.info("Starting daily analytics repair window", { scheduledAt: payload.timestamp });
		const result = await run(compileDailyAnalytics(payload.timestamp));
		logger.info("Finished daily analytics repair window", result);
		return result;
	},
});

export const monthlyAnalyticsJob = schedules.task({
	id: ANALYTICS_TASK_ID.monthly,
	cron: {
		pattern: "20 0 1 * *",
		timezone: TRIGGER_SHOP_TIME_ZONE,
	},
	run: async (payload) => {
		logger.info("Starting monthly analytics compilation", { scheduledAt: payload.timestamp });
		const result = await run(compileMonthlyAnalytics(payload.timestamp));
		logger.info("Finished monthly analytics compilation", result);
		return result;
	},
});
