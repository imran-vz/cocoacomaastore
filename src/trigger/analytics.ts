import { logger, schedules } from "@trigger.dev/sdk";
import {
	compileDailyAnalyticsRepairWindow,
	compilePreviousClosedMonth,
	revalidateAnalyticsCaches,
} from "@/lib/analytics-jobs";

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

		const result = await compileDailyAnalyticsRepairWindow(payload.timestamp);
		const revalidation = await revalidateAnalyticsCaches();

		logger.info("Finished daily analytics repair window", {
			...result,
			revalidation,
		});

		return {
			...result,
			revalidation,
		};
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

		const result = await compilePreviousClosedMonth(payload.timestamp);
		const revalidation = await revalidateAnalyticsCaches();

		logger.info("Finished monthly analytics compilation", {
			...result,
			revalidation,
		});

		return {
			...result,
			revalidation,
		};
	},
});
