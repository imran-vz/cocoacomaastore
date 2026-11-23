import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
	it("keeps a type role next to a text colour", () => {
		expect(cn("text-meta text-muted-foreground")).toBe("text-meta text-muted-foreground");
		expect(cn("text-sheet-title", "text-foreground")).toBe("text-sheet-title text-foreground");
	});

	it("lets a later font size or layer replace an earlier one", () => {
		expect(cn("text-sm", "text-row")).toBe("text-row");
		expect(cn("z-10", "z-overlay")).toBe("z-overlay");
	});
});
