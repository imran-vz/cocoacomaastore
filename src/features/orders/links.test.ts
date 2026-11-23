import { describe, expect, it } from "vitest";
import { orderHref } from "@/features/orders/links";

describe("order links", () => {
	it("open an admin's Orders page on the order's day", () => {
		expect(orderHref("admin", "2026-07-10", 42)).toBe("/admin/orders?date=2026-07-10&orderId=42");
	});

	it("leave the day out for managers, whose Orders page only shows today", () => {
		expect(orderHref("manager", "2026-07-10", 42)).toBe("/manager/orders?orderId=42");
	});
});
