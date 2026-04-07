import { describe, expect, test } from "bun:test";
import { closest, distance } from "./levenshtein-distance";

describe("levenshtein-distance", () => {
	describe("distance", () => {
		test("should return 0 for identical strings", () => {
			expect(distance("a", "a")).toBe(0);
			expect(distance("abc", "abc")).toBe(0);
			expect(distance("", "")).toBe(0);
		});

		test("should return length of string if one is empty", () => {
			expect(distance("a", "")).toBe(1);
			expect(distance("", "abc")).toBe(3);
		});

		test("should compute correct distance for small strings", () => {
			expect(distance("kitten", "sitting")).toBe(3);
			expect(distance("flaw", "lawn")).toBe(2);
			expect(distance("intention", "execution")).toBe(5);
			expect(distance("rosettacode", "raisethysword")).toBe(8);
			expect(distance("gumbo", "gambol")).toBe(2);
		});

		test("should handle case sensitivity", () => {
			expect(distance("A", "a")).toBe(1);
			expect(distance("Kitten", "kitten")).toBe(1);
		});

		test("should handle strings longer than 32 characters (myers_x branch)", () => {
			const str1 = "this is a very long string that exceeds thirty two characters";
			const str2 = "this is a very long string that also exceeds thirty two characters!";
			expect(distance(str1, str2)).toBe(6);

			const str3 = "a".repeat(40);
			const str4 = "a".repeat(35) + "b".repeat(5);
			expect(distance(str3, str4)).toBe(5);

			const str5 = "abcdefghijklmnopqrstuvwxyz1234567890";
			const str6 = "1234567890abcdefghijklmnopqrstuvwxyz";
			expect(distance(str5, str6)).toBe(20);
		});

		test("should handle strings completely different", () => {
			expect(distance("abc", "def")).toBe(3);
			expect(distance("abcdef", "123456")).toBe(6);
		});
	});

	describe("closest", () => {
		test("should find the closest string in array", () => {
			expect(closest("kitten", ["sitting", "kitten", "bitten"])).toBe("kitten");
			expect(closest("kit", ["sitting", "kitten", "bitten"])).toBe("kitten");
			expect(closest("apple", ["banana", "orange", "apples", "pear"])).toBe("apples");
		});

		test("should return the first match if multiple have same distance", () => {
			expect(closest("a", ["b", "c"])).toBe("b");
		});

		test("should return correct item if target is completely empty", () => {
			expect(closest("", ["a", "ab", "abc"])).toBe("a");
		});
	});
});
