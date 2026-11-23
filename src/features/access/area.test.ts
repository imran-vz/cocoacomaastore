import { describe, expect, it } from "vitest";
import { areaOf } from "@/features/access/area";

describe("areaOf", () => {
	it("sends admins to the admin area and every other staff role to the manager area", () => {
		expect(areaOf("admin")).toBe("admin");
		expect(areaOf("user")).toBe("manager");
		expect(areaOf(null)).toBe("manager");
	});
});
