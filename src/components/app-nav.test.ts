import { describe, expect, it } from "vitest";

import { activeTabHref, adminMoreLinks, adminTabs, managerMoreLinks, managerTabs, routeInfo } from "./app-nav";

describe("app navigation model", () => {
	it("gives both roles the same five-slot tab bar", () => {
		expect(managerTabs.map((tab) => tab.label)).toEqual(["Sell", "Orders", "Stock", "Catalog"]);
		expect(adminTabs.map((tab) => tab.label)).toEqual(["Sell", "Orders", "Insights", "Catalog"]);
	});

	it("keeps every manager route one tap from the tab bar or the More sheet", () => {
		const reachable = [...managerTabs, ...managerMoreLinks].map((link) => link.href);
		for (const href of [
			"/manager",
			"/manager/orders",
			"/manager/inventory",
			"/manager/desserts",
			"/manager/combos",
			"/manager/settings",
		]) {
			expect(reachable).toContain(href);
		}
	});

	it("keeps every admin route reachable from the tab bar or the More sheet", () => {
		const reachable = [...adminTabs, ...adminMoreLinks].map((link) => link.href);
		for (const href of [
			"/admin",
			"/admin/orders",
			"/admin/dashboard",
			"/admin/analytics",
			"/admin/desserts",
			"/admin/combos",
			"/admin/settings",
			"/admin/settings/managers",
			"/admin/settings/upi",
		]) {
			expect(reachable).toContain(href);
		}
	});

	it("activates the tab that owns the route, and More for everything else", () => {
		expect(activeTabHref("manager", "/manager")).toBe("/manager");
		expect(activeTabHref("manager", "/manager/combos")).toBe("/manager/desserts");
		expect(activeTabHref("manager", "/manager/settings")).toBe("more");
		expect(activeTabHref("admin", "/admin/analytics")).toBe("/admin/dashboard");
		expect(activeTabHref("admin", "/admin/settings/upi")).toBe("more");
		expect(activeTabHref("admin", "/admin/orders/")).toBe("/admin/orders");
	});

	it("titles pages with their nav label and gives settings sub-pages a back target", () => {
		expect(routeInfo("/manager/inventory").title).toBe("Stock");
		expect(routeInfo("/admin/dashboard").title).toBe("Insights");
		expect(routeInfo("/admin/settings/upi")).toMatchObject({
			title: "UPI accounts",
			back: { href: "/admin/settings", label: "Settings" },
		});
		expect(routeInfo("/admin/settings/managers/123").title).toBe("Managers");
		expect(routeInfo("/manager").home).toBe(true);
	});
});
