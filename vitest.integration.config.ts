import { defineConfig } from "vitest/config";
import unitConfig from "./vitest.config";

export default defineConfig({
	resolve: unitConfig.resolve,
	test: {
		include: ["src/**/*.integration.test.ts"],
		// The files share one database, which each test truncates.
		fileParallelism: false,
		testTimeout: 15_000,
		hookTimeout: 30_000,
		teardownTimeout: 30_000,
	},
});
