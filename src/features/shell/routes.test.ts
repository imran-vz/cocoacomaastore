import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import type { Area } from "@/features/access/area";
import {
	accountLinksFor,
	activeTabHref,
	moreLinksFor,
	pageMetadata,
	routeInfo,
	sectionViews,
	sidebarFor,
	tabsFor,
} from "@/features/shell/routes";

const APP = join(__dirname, "..", "..", "app");

/** The URL of every page under an area, with route groups like `(sell)` dropped. */
function pageUrls(area: Area): string[] {
	const root = join(APP, area);
	const urls: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else if (entry.name === "page.tsx") {
				const segments = relative(root, dir)
					.split(sep)
					.filter((segment) => segment && !segment.startsWith("("));
				urls.push(["", area, ...segments].join("/"));
			}
		}
	};
	walk(root);
	return urls.sort();
}

describe.each(["admin", "manager"] as const)("the %s route map", (area) => {
	it("links only to the area's pages", () => {
		const linked = [
			...sidebarFor(area).flatMap((item) => [item, ...item.items]),
			...moreLinksFor(area),
			...accountLinksFor(area),
		].map((link) => link.href);
		for (const href of linked) expect(pageUrls(area)).toContain(href);
	});

	it("reaches every page from the tab bar, a section's views, the More sheet or the account menu", () => {
		const reachable = new Set([
			...tabsFor(area).map((tab) => tab.href),
			...(["catalog", "insights"] as const).flatMap((id) => sectionViews(area, id).map((view) => view.href)),
			...moreLinksFor(area).map((link) => link.href),
			...accountLinksFor(area).map((link) => link.href),
		]);
		for (const url of pageUrls(area)) expect(reachable).toContain(url);
	});

	it("titles and describes every screen but the Sell home", () => {
		for (const url of pageUrls(area)) {
			if (routeInfo(url).home) continue;
			expect(pageMetadata(url).title, url).not.toBe("");
			expect(pageMetadata(url).description, url).toBeTruthy();
		}
	});

	it("activates the tab of the section that names each route, and More for the rest", () => {
		const tabLabels = tabsFor(area).map((tab) => tab.label);
		for (const url of pageUrls(area)) {
			const { title, crumbs } = routeInfo(url);
			const section = crumbs[0]?.label ?? title;
			const active = activeTabHref(area, url);
			const tab = tabsFor(area).find((candidate) => candidate.href === active);
			if (tabLabels.includes(section)) expect(tab?.label, url).toBe(section);
			else expect(active, url).toBe("more");
		}
	});
});

describe("route info", () => {
	it("lets deeper paths and trailing slashes inherit from their page", () => {
		expect(routeInfo("/admin/settings/managers/123")).toMatchObject({ title: "Managers" });
		expect(activeTabHref("admin", "/admin/orders/")).toBe("/admin/orders");
	});

	it("gives a hub's sub-pages a way back, and a section's views the section's title", () => {
		expect(routeInfo("/admin/settings/upi")).toMatchObject({
			title: "UPI accounts",
			back: { href: "/admin/settings", label: "Settings" },
		});
		expect(routeInfo("/manager/combos").title).toBe("Catalog");
		expect(routeInfo("/manager/combos").back).toBeUndefined();
	});

	it("treats only the area home as home", () => {
		expect(routeInfo("/manager").home).toBe(true);
		expect(routeInfo("/manager/orders").home).toBe(false);
	});
});

describe("page metadata", () => {
	it("titles a screen by its trail and describes it like its settings row", () => {
		expect(pageMetadata("/admin/settings/upi")).toEqual({
			title: "Settings › UPI accounts",
			description: "Payment handles shown at checkout",
		});
		expect(pageMetadata("/admin/analytics").title).toBe("Insights › Month");
		expect(pageMetadata("/manager/orders").title).toBe("Orders");
	});
});
