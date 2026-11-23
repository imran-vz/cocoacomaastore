import { defineConfig } from "drizzle-kit";
import { getTestDatabaseUrls } from "./src/test/integration/test-database-url";

const { targetUrl } = getTestDatabaseUrls();

export default defineConfig({
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: targetUrl,
	},
});
