const TEST_DATABASE_NAME = "cocoacomaa_test";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type TestDatabaseUrls = {
	targetUrl: string;
	maintenanceUrl: string;
};

export function parseTestDatabaseUrl(value: string | undefined): TestDatabaseUrls {
	if (value === undefined || value.trim() === "") {
		throw new Error("TEST_DATABASE_URL is required");
	}

	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL");
	}

	if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
		throw new Error("TEST_DATABASE_URL must use the postgres or postgresql protocol");
	}

	if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
		throw new Error("TEST_DATABASE_URL must use a loopback host");
	}

	let databaseName: string;
	try {
		databaseName = decodeURIComponent(parsed.pathname.slice(1));
	} catch {
		throw new Error("TEST_DATABASE_URL must contain a valid database name");
	}
	if (databaseName !== TEST_DATABASE_NAME) {
		throw new Error(`TEST_DATABASE_URL database must be exactly ${TEST_DATABASE_NAME}`);
	}

	const maintenance = new URL(parsed);
	maintenance.pathname = "/postgres";

	return {
		targetUrl: value,
		maintenanceUrl: maintenance.toString(),
	};
}

export function getTestDatabaseUrls(): TestDatabaseUrls {
	return parseTestDatabaseUrl(process.env.TEST_DATABASE_URL);
}
