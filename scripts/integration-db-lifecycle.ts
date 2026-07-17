import postgres from "postgres";
import {
	assertDatabaseName,
	getTestDatabaseUrls,
	TEST_DATABASE_MAINTENANCE_NAME,
	TEST_DATABASE_NAME,
} from "./test-database-url";

async function readCurrentDatabase(client: ReturnType<typeof postgres>) {
	const [row] = await client<{ currentDatabase: string }[]>`
		SELECT current_database() AS "currentDatabase"
	`;
	return row?.currentDatabase;
}

async function main() {
	const command = process.argv[2];

	if (command !== "create" && command !== "drop") {
		throw new Error("Expected an integration database lifecycle command: create or drop");
	}

	const { maintenanceUrl, targetUrl } = getTestDatabaseUrls();
	const maintenanceClient = postgres(maintenanceUrl, { max: 1 });

	try {
		assertDatabaseName(await readCurrentDatabase(maintenanceClient), TEST_DATABASE_MAINTENANCE_NAME);
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
				assertDatabaseName(await readCurrentDatabase(targetClient), TEST_DATABASE_NAME);
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

main().catch(() => {
	console.error("Integration database lifecycle failed.");
	process.exitCode = 1;
});
