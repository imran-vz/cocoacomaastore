import { afterEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ opened: false }));

vi.mock("@trigger.dev/sdk", async (importOriginal) => ({
	...(await importOriginal<typeof import("@trigger.dev/sdk")>()),
	// The task's own definition, so its `run` can be called here.
	schedules: { task: (definition: unknown) => definition },
	logger: { info: () => {} },
}));
vi.mock("@/db", () => {
	database.opened = true;
	return { db: {} };
});

const { AbortTaskRunError } = await import("@trigger.dev/sdk");
const analytics = await import("@/trigger/analytics");

type ScheduledRun = { run: (payload: { timestamp: Date }) => Promise<unknown> };

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("analytics tasks", () => {
	it.each([
		["NEXT_PUBLIC_APP_URL", "daily", analytics.dailyAnalyticsJob],
		["REVALIDATE_SECRET", "daily", analytics.dailyAnalyticsJob],
		["NEXT_PUBLIC_APP_URL", "monthly", analytics.monthlyAnalyticsJob],
	])("end the run without retrying or opening the database when %s is missing (%s)", async (missing, _job, task) => {
		vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://shop.example");
		vi.stubEnv("REVALIDATE_SECRET", "secret");
		vi.stubEnv(missing, "");

		const run = (task as unknown as ScheduledRun).run({ timestamp: new Date("2026-07-14T18:40:00.000Z") });

		await expect(run).rejects.toBeInstanceOf(AbortTaskRunError);
		await expect(run).rejects.toThrow("NEXT_PUBLIC_APP_URL and REVALIDATE_SECRET must be set for analytics jobs");
		expect(database.opened).toBe(false);
	});
});
