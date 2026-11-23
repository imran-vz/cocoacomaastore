import { isLoopbackHost, parsePostgresUrl } from "@/lib/postgres-url";

export const TEST_DATABASE_NAME = "cocoacomaa_test";
export const TEST_DATABASE_MAINTENANCE_NAME = "postgres";

type TestDatabaseUrls = {
	targetUrl: string;
	maintenanceUrl: string;
};

export function assertDatabaseName(actual: string | undefined, expected: string) {
	if (actual !== expected) {
		throw new Error(`Refusing database operation: connected database must be exactly ${expected}`);
	}
}

export function parseTestDatabaseUrl(value: string | undefined, variableName = "TEST_DATABASE_URL"): TestDatabaseUrls {
	const parsed = parsePostgresUrl(value, variableName);
	if (!isLoopbackHost(parsed)) {
		throw new Error(`${variableName} must use a loopback host`);
	}

	if (parsed.search !== "") {
		throw new Error(`${variableName} must not contain query parameters`);
	}
	if (parsed.hash !== "") {
		throw new Error(`${variableName} must not contain a fragment`);
	}

	let databaseName: string;
	try {
		databaseName = decodeURIComponent(parsed.pathname.slice(1));
	} catch {
		throw new Error(`${variableName} must contain a valid database name`);
	}
	if (databaseName !== TEST_DATABASE_NAME) {
		throw new Error(`${variableName} database must be exactly ${TEST_DATABASE_NAME}`);
	}

	const maintenance = new URL(parsed);
	maintenance.pathname = `/${TEST_DATABASE_MAINTENANCE_NAME}`;

	return {
		targetUrl: parsed.toString(),
		maintenanceUrl: maintenance.toString(),
	};
}

export function getTestDatabaseUrls(): TestDatabaseUrls {
	return parseTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}
