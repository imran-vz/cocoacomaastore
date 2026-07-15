import { describe, expect, it } from "vitest";
import { parseTestDatabaseUrl } from "../../scripts/test-database-url";

describe("parseTestDatabaseUrl", () => {
	it("accepts the loopback test target", () => {
		const targetUrl = "postgresql://postgres:password@127.0.0.1:5432/cocoacomaa_test";

		expect(parseTestDatabaseUrl(targetUrl)).toEqual({
			targetUrl,
			maintenanceUrl: "postgresql://postgres:password@127.0.0.1:5432/postgres",
		});
	});

	it("rejects a missing or blank value", () => {
		expect(() => parseTestDatabaseUrl(undefined)).toThrow("TEST_DATABASE_URL is required");
		expect(() => parseTestDatabaseUrl(" \t ")).toThrow("TEST_DATABASE_URL is required");
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
});
