import postgres from "postgres";
import { isDatabaseUnavailableError } from "@/lib/errors";
import { safeErrorCode } from "@/lib/safe-diagnostics";
import {
	assertDatabaseName,
	getTestDatabaseUrls,
	TEST_DATABASE_MAINTENANCE_NAME,
	TEST_DATABASE_NAME,
} from "@/test/integration/test-database-url";

/** A failure whose message is safe to print (it never contains the URL's credentials). */
class LifecycleError extends Error {}

function safely<T>(run: () => T): T {
	try {
		return run();
	} catch (error) {
		throw new LifecycleError((error as Error).message);
	}
}

async function readCurrentDatabase(client: ReturnType<typeof postgres>) {
	const [row] = await client<{ currentDatabase: string }[]>`
		SELECT current_database() AS "currentDatabase"
	`;
	return row?.currentDatabase;
}

async function main() {
	const command = process.argv[2];

	if (command !== "create" && command !== "drop") {
		throw new LifecycleError("Expected an integration database lifecycle command: create or drop");
	}

	const { maintenanceUrl, targetUrl } = safely(getTestDatabaseUrls);
	const maintenanceClient = postgres(maintenanceUrl, { max: 1, onnotice: () => undefined });

	try {
		const maintenanceName = await readCurrentDatabase(maintenanceClient);
		safely(() => assertDatabaseName(maintenanceName, TEST_DATABASE_MAINTENANCE_NAME));
		await maintenanceClient`
			SELECT pg_terminate_backend(pid)
			FROM pg_stat_activity
			WHERE datname = ${TEST_DATABASE_NAME}
				AND pid <> pg_backend_pid()
		`;
		await maintenanceClient.unsafe(`DROP DATABASE IF EXISTS "${TEST_DATABASE_NAME}"`);

		if (command === "create") {
			await maintenanceClient.unsafe(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
			const targetClient = postgres(targetUrl, { max: 1 });
			try {
				const targetName = await readCurrentDatabase(targetClient);
				safely(() => assertDatabaseName(targetName, TEST_DATABASE_NAME));
			} finally {
				await targetClient.end();
			}
			console.log("Created disposable integration database.");
		} else {
			console.log("Dropped disposable integration database.");
		}
	} finally {
		await maintenanceClient.end();
	}
}

function describeFailure(error: unknown): string {
	if (error instanceof LifecycleError) return error.message;
	if (isDatabaseUnavailableError(error)) {
		return "Cannot reach PostgreSQL at TEST_DATABASE_URL. Is the database container running?";
	}
	const code = safeErrorCode(error);
	return code ? `PostgreSQL refused the operation (${code}).` : "Unexpected error.";
}

main().catch((error: unknown) => {
	console.error(`Integration database lifecycle failed: ${describeFailure(error)}`);
	process.exitCode = 1;
});
