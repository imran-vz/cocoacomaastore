import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { UserFacingError } from "@/lib/errors";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

mockStaffSessions();

const { adminAction, staffAction } = await import("@/features/access/action");

const manager = { id: "manager", area: "manager" } as const;
const admin = { id: "admin", area: "admin" } as const;

describe("staff actions", () => {
	it("pass the signed-in user and the arguments, and wrap the result", async () => {
		const echo = staffAction(async (user, a: number, b: number) => `${user.id}:${a + b}`);
		await expect(asStaff(manager, () => echo(1, 2))).resolves.toEqual({ ok: true, data: "manager:3" });
	});

	it("are refused to anyone signed out without running", async () => {
		const run = vi.fn(async () => "ran");
		await expect(asStaff(null, staffAction(run))).resolves.toEqual({
			ok: false,
			error: "Your session has ended. Sign in again.",
		});
		expect(run).not.toHaveBeenCalled();
	});

	it("report the first validation issue", async () => {
		const parse = staffAction(async (_user, input: unknown) =>
			z.object({ name: z.string().min(1, "Enter a name"), price: z.number("Enter a price") }).parse(input),
		);
		await expect(asStaff(manager, () => parse({ name: "", price: "x" }))).resolves.toEqual({
			ok: false,
			error: "Enter a name",
		});
	});

	it("report user-facing errors and an unreachable database", async () => {
		const refuse = staffAction(async () => {
			throw new UserFacingError("Out of stock");
		});
		await expect(asStaff(manager, refuse)).resolves.toEqual({ ok: false, error: "Out of stock" });

		const unreachable = staffAction(async () => {
			throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
		});
		await expect(asStaff(manager, unreachable)).resolves.toEqual({
			ok: false,
			error: "Database is unavailable. Please try again.",
		});
	});

	it("rethrow unexpected failures", async () => {
		const failure = new Error("boom");
		const broken = staffAction(async () => {
			throw failure;
		});
		await expect(asStaff(manager, broken)).rejects.toBe(failure);
	});
});

describe("admin actions", () => {
	it("are refused to managers without running", async () => {
		const run = vi.fn(async () => "ran");
		await expect(asStaff(manager, adminAction(run))).resolves.toEqual({
			ok: false,
			error: "You don't have access to this.",
		});
		expect(run).not.toHaveBeenCalled();
	});

	it("run for admins", async () => {
		await expect(
			asStaff(
				admin,
				adminAction(async (user) => user.id),
			),
		).resolves.toEqual({ ok: true, data: "admin" });
	});
});
