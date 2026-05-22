import { logger, schedules } from "@trigger.dev/sdk";
import { compileDailyAnalyticsTaskEffect, compileMonthlyAnalyticsTaskEffect } from "@/lib/analytics-jobs";
import { runAppEffect } from "@/server/effect/runtime";

export const dailyAnalyticsJob = schedules.task({
	id: "daily-analytics",
	cron: {
		pattern: "10 0 * * *",
		timezone: "Asia/Calcutta",
	},
	run: async (payload) => {
		logger.info("Starting daily analytics repair window", {
			scheduledAt: payload.timestamp,
			timezone: payload.timezone,
		});

		const result = await runAppEffect(compileDailyAnalyticsTaskEffect(payload.timestamp));

		logger.info("Finished daily analytics repair window", {
			...result,
		});

		return result;
	},
});

export const monthlyAnalyticsJob = schedules.task({
	id: "monthly-analytics",
	cron: {
		pattern: "20 0 1 * *",
		timezone: "Asia/Calcutta",
	},
	run: async (payload) => {
		logger.info("Starting monthly analytics compilation", {
			scheduledAt: payload.timestamp,
			timezone: payload.timezone,
		});

		const result = await runAppEffect(compileMonthlyAnalyticsTaskEffect(payload.timestamp));

		logger.info("Finished monthly analytics compilation", {
			...result,
		});

		return result;
	},
});
