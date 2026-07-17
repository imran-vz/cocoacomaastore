import { describe, expect, it } from "vitest";
import { assertDatabaseName, parseTestDatabaseUrl } from "../../scripts/test-database-url";

const validTarget = "postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test";

describe("parseTestDatabaseUrl", () => {
	it("accepts and canonicalizes the loopback test target", () => {
		expect(parseTestDatabaseUrl(`  ${validTarget}  `)).toEqual({
			targetUrl: validTarget,
			maintenanceUrl: "postgresql://postgres:password@127.0.0.1:5432/postgres",
		});
	});

	it("rejects a missing or blank value", () => {
		expect(() => parseTestDatabaseUrl(undefined)).toThrow("TEST_DATABASE_URL is required");
		expect(() => parseTestDatabaseUrl(" \t ")).toThrow("TEST_DATABASE_URL is required");
	});

	it("uses the requested environment variable name in safe errors", () => {
		expect(() => parseTestDatabaseUrl(undefined, "DATABASE_URL")).toThrow("DATABASE_URL is required");
	});

	it("rejects an unsupported protocol", () => {
		expect(() => parseTestDatabaseUrl("mysql://postgres:password@127.0.0.1:5432/cocoacomaa_test")).toThrow(
			"TEST_DATABASE_URL must use the postgres or postgresql protocol",
		);
	});

	it("rejects a non-loopback host", () => {
		expect(() => parseTestDatabaseUrl("postgresql://test:test@db.example.com:5432/cocoacomaa_test")).toThrow(
			"TEST_DATABASE_URL must use a loopback host",
		);
	});

	it("rejects a loopback URL for the maintenance database", () => {
		expect(() => parseTestDatabaseUrl("postgresql://postgres:password@127.0.0.1:5432/postgres")).toThrow(
			"TEST_DATABASE_URL database must be exactly cocoacomaa_test",
		);
	});

	it("rejects every query parameter, including database startup overrides", () => {
		for (const query of [
			"database=developer_app",
			"DATABASE=developer_app",
			"data%62ase=developer_app",
			"database=developer_app&database=cocoacomaa_test",
			"application_name=integration-tests",
		]) {
			expect(() => parseTestDatabaseUrl(`${validTarget}?${query}`)).toThrow(
				"TEST_DATABASE_URL must not contain query parameters",
			);
		}
	});

	it("rejects fragments instead of passing ambiguous connection strings onward", () => {
		expect(() => parseTestDatabaseUrl(`${validTarget}#database=developer_app`)).toThrow(
			"TEST_DATABASE_URL must not contain a fragment",
		);
	});

	it("never includes credentials or query values in rejection messages", () => {
		const password = "sentinel-password";
		const database = "sentinel-database";
		let message = "";
		try {
			parseTestDatabaseUrl(`postgresql://postgres:${password}@127.0.0.1:5432/cocoacomaa_test?database=${database}`);
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).not.toContain(password);
		expect(message).not.toContain(database);
	});
});

describe("assertDatabaseName", () => {
	it("accepts the exact expected database and rejects every mismatch", () => {
		expect(() => assertDatabaseName("cocoacomaa_test", "cocoacomaa_test")).not.toThrow();
		expect(() => assertDatabaseName("developer_app", "cocoacomaa_test")).toThrow(
			"Refusing database operation: connected database must be exactly cocoacomaa_test",
		);
		expect(() => assertDatabaseName(undefined, "cocoacomaa_test")).toThrow(
			"Refusing database operation: connected database must be exactly cocoacomaa_test",
		);
	});
});
