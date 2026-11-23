import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is not defined");
}

// The app may connect through Supabase's transaction-mode pooler (port 6543), which doesn't
// support the prepared statements and session state drizzle-kit uses; the same pooler host
// serves session-mode connections on 5432.
const url = new URL(process.env.DATABASE_URL);
if (url.port === "6543") url.port = "5432";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: url.toString(),
	},
});
