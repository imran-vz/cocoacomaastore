import { tasks } from "@trigger.dev/sdk";
import type { dailyAnalyticsJob, monthlyAnalyticsJob } from "@/trigger/analytics";
import { ANALYTICS_TASK_ID, TRIGGER_SHOP_TIME_ZONE } from "@/trigger/analytics-schedule";

const USAGE = "Usage: pnpm analytics:trigger:daily | pnpm analytics:trigger:monthly";

async function main() {
	const job = process.argv[2];

	if (job !== "daily" && job !== "monthly") {
		console.error(USAGE);
		process.exit(1);
	}

	if (!process.env.TRIGGER_SECRET_KEY) {
		console.error("TRIGGER_SECRET_KEY is required to trigger analytics jobs.");
		process.exit(1);
	}

	const manualSchedulePayload = {
		type: "IMPERATIVE" as const,
		timestamp: new Date(),
		timezone: TRIGGER_SHOP_TIME_ZONE,
		scheduleId: "manual-operator-cli",
		upcoming: [],
	};

	const handle =
		job === "daily"
			? await tasks.trigger<typeof dailyAnalyticsJob>(ANALYTICS_TASK_ID.daily, manualSchedulePayload)
			: await tasks.trigger<typeof monthlyAnalyticsJob>(ANALYTICS_TASK_ID.monthly, manualSchedulePayload);

	console.log(`Triggered ${job} analytics job: ${handle.id}`);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
