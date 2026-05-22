import { tasks } from "@trigger.dev/sdk";
import type { dailyAnalyticsJob, monthlyAnalyticsJob } from "../src/trigger/analytics";

const job = process.argv[2];

if (job !== "daily" && job !== "monthly") {
	console.error("Usage: pnpm analytics:trigger -- daily|monthly");
	process.exit(1);
}

if (!process.env.TRIGGER_SECRET_KEY) {
	console.error("TRIGGER_SECRET_KEY is required to trigger analytics jobs.");
	process.exit(1);
}

const manualSchedulePayload = {
	type: "IMPERATIVE" as const,
	timestamp: new Date(),
	timezone: "Asia/Calcutta",
	scheduleId: "manual-operator-cli",
	upcoming: [],
};

const handle =
	job === "daily"
		? await tasks.trigger<typeof dailyAnalyticsJob>("daily-analytics", manualSchedulePayload)
		: await tasks.trigger<typeof monthlyAnalyticsJob>("monthly-analytics", manualSchedulePayload);

console.log(`Triggered ${job} analytics job: ${handle.id}`);
