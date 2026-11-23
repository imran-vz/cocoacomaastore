import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isQueryTimingEnabled, withQueryTiming } from "@/db/query-logger";
import * as schema from "@/db/schema";
import { DatabaseUnavailableError } from "@/lib/errors";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	// Staff see the database-unavailable screen; the log names the cause.
	console.error("[db] DATABASE_URL is not set");
	throw new DatabaseUnavailableError({ cause: new Error("DATABASE_URL is not set") });
}

const client = withQueryTiming(postgres(connectionString, { prepare: false }));
export const db = drizzle(client, {
	schema,
	logger: process.env.NODE_ENV === "development" && !isQueryTimingEnabled(),
});

export type AppDatabase = typeof db;

/** The handle a `db.transaction` callback receives. */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The database or a transaction on it, for reads that run in either. */
export type Queryable = AppDatabase | Transaction;
