import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { Effect, Layer } from "effect";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { BackendDatabaseError } from "@/server/effect/errors";
import { Database } from "@/server/effect/services/db";
import {
	assertDatabaseName,
	getTestDatabaseUrls,
	parseTestDatabaseUrl,
	TEST_DATABASE_NAME,
} from "../../../scripts/test-database-url";

const { targetUrl } = getTestDatabaseUrls();
const databaseTargetUrl = parseTestDatabaseUrl(process.env.DATABASE_URL, "DATABASE_URL").targetUrl;
if (databaseTargetUrl !== targetUrl) {
	throw new Error("DATABASE_URL must exactly match TEST_DATABASE_URL for integration tests");
}

const client = postgres(targetUrl);

async function assertConnectedToTestDatabase() {
	const [row] = await client<{ currentDatabase: string }[]>`
		SELECT current_database() AS "currentDatabase"
	`;
	assertDatabaseName(row?.currentDatabase, TEST_DATABASE_NAME);
}

try {
	await assertConnectedToTestDatabase();
} catch (error) {
	await client.end();
	throw error;
}

export const integrationDb = drizzle(client, { schema });

export const integrationDatabaseLayer = Layer.succeed(Database, {
	db: integrationDb,
	attempt: (operation, run) =>
		Effect.tryPromise({
			try: () => run(integrationDb),
			catch: (cause) => new BackendDatabaseError({ operation, cause }),
		}),
});

export async function resetIntegrationData() {
	await assertConnectedToTestDatabase();
	await integrationDb.execute(
		sql.raw(`
		DO $$
		DECLARE
			tables text;
		BEGIN
			SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
			INTO tables
			FROM pg_tables
			WHERE schemaname = 'public';

			IF tables IS NOT NULL THEN
				EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE';
			END IF;
		END $$;
	`),
	);
}

export async function closeIntegrationDatabase() {
	await client.end();
}
