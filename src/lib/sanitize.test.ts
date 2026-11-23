import { describe, expect, it } from "vitest";
import { stripMarkup } from "@/lib/sanitize";

describe("stripMarkup", () => {
	it("removes tags, comments and script fragments", () => {
		expect(stripMarkup(' <b>Rich</b> <img src=x onerror="alert(1)"> <!-- note -->cake ')).toBe("Rich  cake");
		expect(stripMarkup('<a href="javascript:alert(1)">x</a>')).toBe("x");
		expect(stripMarkup("Choco\u0000late")).toBe("Chocolate");
	});

	it("keeps text outside tags, including comparison signs and words before an equals sign", () => {
		expect(stripMarkup("a < b > c")).toBe("a < b > c");
		expect(stripMarkup("2 <3")).toBe("2 <3");
		expect(stripMarkup("Bonbons = 5, one = 1")).toBe("Bonbons = 5, one = 1");
	});
});
