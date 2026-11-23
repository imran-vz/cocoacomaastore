import { describe, expect, it } from "vitest";
import { INLINE_CART_MIN_PANE, SHOWN_WITH_INLINE_CART } from "@/features/pos/layout";

describe("POS layout", () => {
	it("shows the skeleton's inline cart at the content width where the live cart goes inline", () => {
		expect(SHOWN_WITH_INLINE_CART).toContain(`@min-[${INLINE_CART_MIN_PANE}px]/pos:`);
	});
});
