import { describe, expect, it, vi } from "vitest";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

vi.mock("next/navigation", () => ({
	RedirectType: { replace: "replace" },
	redirect: (url: string) => {
		throw new Error(`redirect:${url}`);
	},
}));
mockStaffSessions();

const { requireArea } = await import("@/features/access/session");

describe("requireArea", () => {
	it("sends visitors to sign in", async () => {
		await expect(asStaff(null, () => requireArea("manager"))).rejects.toThrow("redirect:/login");
	});

	it("sends staff from the other area to their own home", async () => {
		await expect(asStaff({ id: "manager", area: "manager" }, () => requireArea("admin"))).rejects.toThrow(
			"redirect:/manager",
		);
		await expect(asStaff({ id: "admin", area: "admin" }, () => requireArea("manager"))).rejects.toThrow(
			"redirect:/admin",
		);
	});

	it("returns the staff member in their own area", async () => {
		await expect(asStaff({ id: "admin", area: "admin" }, () => requireArea("admin"))).resolves.toMatchObject({
			id: "admin",
			area: "admin",
		});
	});
});
