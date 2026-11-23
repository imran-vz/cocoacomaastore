import { describe, expect, it } from "vitest";
import { DatabaseUnavailableError, isDatabaseUnavailableError, UserFacingError, userFacingMessage } from "@/lib/errors";

const DATABASE_DOWN = new DatabaseUnavailableError().message;

describe("isDatabaseUnavailableError", () => {
	it("recognises connection failures by code or message anywhere in the cause chain", () => {
		const refused = Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" });
		expect(isDatabaseUnavailableError(refused)).toBe(true);
		expect(isDatabaseUnavailableError({ code: "57P01" })).toBe(true);
		expect(isDatabaseUnavailableError(new Error("Connection terminated unexpectedly"))).toBe(true);
		expect(
			isDatabaseUnavailableError(new Error("query failed", { cause: new Error("outer", { cause: refused }) })),
		).toBe(true);
		expect(isDatabaseUnavailableError(new DatabaseUnavailableError())).toBe(true);
	});

	it("leaves query errors and non-errors alone", () => {
		expect(isDatabaseUnavailableError(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(false);
		expect(isDatabaseUnavailableError(new UserFacingError("Out of stock"))).toBe(false);
		expect(isDatabaseUnavailableError(undefined)).toBe(false);
		expect(isDatabaseUnavailableError("ECONNREFUSED")).toBe(false);
	});
});

describe("userFacingMessage", () => {
	it("returns the message of the nearest user-facing error in the cause chain", () => {
		expect(userFacingMessage(new UserFacingError("Out of stock"))).toBe("Out of stock");
		expect(userFacingMessage(new Error("wrapper", { cause: new UserFacingError("Order not found") }))).toBe(
			"Order not found",
		);
	});

	it("names an unreachable database, even when a user-facing error wraps it", () => {
		const refused = Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" });
		expect(userFacingMessage(refused)).toBe(DATABASE_DOWN);
		expect(userFacingMessage(new UserFacingError("Couldn't save", { cause: refused }))).toBe(DATABASE_DOWN);
	});

	it("is undefined for unexpected failures", () => {
		expect(userFacingMessage(new Error("boom"))).toBeUndefined();
		expect(userFacingMessage(null)).toBeUndefined();
	});
});
