import postgres from "postgres";
import { getTestDatabaseUrls } from "./test-database-url";

const TEST_DATABASE_NAME = "cocoacomaa_test";

async function main() {
	const command = process.argv[2];

	if (command !== "create" && command !== "drop") {
		throw new Error("Expected an integration database lifecycle command: create or drop");
	}

	const { maintenanceUrl } = getTestDatabaseUrls();
	const maintenanceClient = postgres(maintenanceUrl, { max: 1 });

	try {
		await maintenanceClient`
			SELECT pg_terminate_backend(pid)
			FROM pg_stat_activity
			WHERE datname = ${TEST_DATABASE_NAME}
				AND pid <> pg_backend_pid()
		`;
		await maintenanceClient.unsafe(`DROP DATABASE IF EXISTS "${TEST_DATABASE_NAME}"`);

		if (command === "create") {
			await maintenanceClient.unsafe(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
			console.log("Created disposable integration database.");
		} else {
			console.log("Dropped disposable integration database.");
		}
	} finally {
		await maintenanceClient.end();
	}
}

function getSafeErrorMessage(error: unknown) {
	if (!(error instanceof Error)) return "Unknown error";
	return error.message
		.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted database URL]")
		.replace(/password=\S+/gi, "password=[redacted]");
}

main().catch((error) => {
	console.error(`Integration database lifecycle failed: ${getSafeErrorMessage(error)}`);
	process.exitCode = 1;
});
