import { describe, expect, it } from "vitest";
import { nameHint } from "@/features/catalog/name-hint";

const catalog = ["Choco Fudge Brownie", "Choco Lava", "Tiramisu", "Nutella Waffle"];

describe("nameHint", () => {
	it("says nothing for a new name or a blank field", () => {
		expect(nameHint("Mango Cheesecake", catalog)).toBeNull();
		expect(nameHint("   ", catalog)).toBeNull();
	});

	it("flags a name already in the catalog, ignoring case and surrounding spaces", () => {
		expect(nameHint("  tiramisu ", catalog)).toEqual({
			tier: "exact",
			message: 'A dessert named "Tiramisu" already exists',
		});
	});

	it("lists up to three desserts that start with what was typed, from the third character", () => {
		expect(nameHint("ch", catalog)).toBeNull();
		expect(nameHint("cho", catalog)).toEqual({
			tier: "starts-with",
			message: "Similar desserts exist: Choco Fudge Brownie, Choco Lava",
		});
	});

	it("suggests a likely typo of an existing name, from the sixth character", () => {
		expect(nameHint("Tiramsu", catalog)).toEqual({
			tier: "close",
			message: 'Did you mean "Tiramisu"?',
			match: "Tiramisu",
		});
		expect(nameHint("Nutela Wafle", catalog)).toMatchObject({ tier: "close", match: "Nutella Waffle" });
	});

	it("does not treat a short or more distant name as a typo", () => {
		expect(nameHint("Lav", ["Law"])).toBeNull();
		expect(nameHint("Tirxmxsx", catalog)).toBeNull();
	});
});
