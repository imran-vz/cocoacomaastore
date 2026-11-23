import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { CacheRevalidator } from "@/features/insights/cache-revalidator";
import { compileDailyAnalytics, compileMonthlyAnalytics } from "@/features/insights/jobs";
import { Database } from "@/server/effect/services/db";

/** Runs a job against a database and cache that only record that they were used, in order. */
function runRecorded<A, E>(job: Effect.Effect<A, E, Database | CacheRevalidator>) {
	const steps: string[] = [];
	const layer = Layer.mergeAll(
		Layer.succeed(Database, {
			attempt: () =>
				Effect.sync(() => {
					steps.push("compile");
					return undefined as never;
				}),
		}),
		Layer.succeed(CacheRevalidator, {
			revalidateCompiledAnalytics: () => Effect.sync(() => void steps.push("revalidate")),
		}),
	);
	return Effect.runPromise(job.pipe(Effect.provide(layer))).then((result) => ({ result, steps }));
}

describe("analytics jobs", () => {
	it("recompiles the seven closed shop days before the 00:10 IST run, then refreshes the app's caches", async () => {
		// 2026-07-15 00:10 IST
		const { result, steps } = await runRecorded(compileDailyAnalytics(new Date("2026-07-14T18:40:00.000Z")));
		const days = ["2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14"];

		expect(result).toEqual({ compiledDays: days });
		expect(steps).toEqual([...days.map(() => "compile"), "revalidate"]);
	});

	it("compiles the shop month that just closed", async () => {
		// 2026-08-01 00:20 IST
		const { result, steps } = await runRecorded(compileMonthlyAnalytics(new Date("2026-07-31T18:50:00.000Z")));

		expect(result).toEqual({ compiledMonth: "2026-07" });
		expect(steps).toEqual(["compile", "revalidate"]);
	});
});
