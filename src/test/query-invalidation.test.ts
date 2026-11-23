import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { comboCatalogQuery, dessertsQuery } from "@/features/catalog/client";
import { COMBO_TAGS, DESSERT_TAGS } from "@/features/catalog/tags";
import { insightsQueries } from "@/features/insights/client";
import { todayInventoryQuery } from "@/features/inventory/client";
import { stockChangeTags } from "@/features/inventory/tags";
import { dayOrdersQuery } from "@/features/orders/client";
import { orderChangeTags } from "@/features/orders/tags";
import { staffAccountsQuery } from "@/features/staff/client";
import { STAFF_TAGS } from "@/features/staff/tags";
import { upiAccountsQuery } from "@/features/upi/client";
import { UPI_TAGS } from "@/features/upi/tags";
import { runAction } from "@/lib/action-result";
import { ALL_CACHE_TAGS } from "@/lib/cache-tags";
import { asStaff, mockStaffSessions } from "@/test/staff-session";

vi.doMock("next/cache", () => ({ updateTag: vi.fn() }));
mockStaffSessions();

const { staffAction } = await import("@/features/access/action");
const { updateTags } = await import("@/server/next-cache");

const TODAY = "2026-07-15";
const YESTERDAY = "2026-07-14";

/** Every client query a screen can hold, built from the features' own options, by a readable name. */
const screens = {
	"orders today": dayOrdersQuery(TODAY),
	"orders yesterday": dayOrdersQuery(YESTERDAY),
	"stock today": todayInventoryQuery(TODAY),
	"insights today": insightsQueries.day(TODAY, TODAY),
	"insights yesterday": insightsQueries.day(YESTERDAY, TODAY),
	"weeks this month": insightsQueries.businessWeeks("2026-07"),
	"weeks last month": insightsQueries.businessWeeks("2026-06"),
	months: insightsQueries.overview(),
	"dessert sales": insightsQueries.dessertSales("2026-06"),
	desserts: dessertsQuery,
	combos: comboCatalogQuery,
	staff: staffAccountsQuery,
	upi: upiAccountsQuery,
};
type Screen = keyof typeof screens;

/**
 * The screens a server action refreshes on the client when it expires `tags` on the server: the
 * action reports what it refreshed, and running it from the client refreshes those queries.
 */
async function refreshedBy(tags: readonly string[]) {
	const queryClient = new QueryClient();
	const cache = queryClient.getQueryCache();
	const queries = Object.entries(screens).map(([name, options]) => ({
		name: name as Screen,
		query: cache.build(queryClient, options as Parameters<typeof cache.build>[1]),
	}));
	const change = staffAction(async () => updateTags(tags));
	const result = await runAction(queryClient, asStaff({ id: "manager", area: "manager" }, change));
	expect(result).toMatchObject({ ok: true });
	return queries.filter(({ query }) => query.state.isInvalidated).map(({ name }) => name);
}

describe("a server change refreshes the client queries that show it", () => {
	it("an order: the day's orders and stock, and today's live insights", async () => {
		expect(await refreshedBy(orderChangeTags(TODAY))).toEqual(["orders today", "stock today", "insights today"]);
	});

	it("a stock count: the day's stock and today's insights", async () => {
		expect(await refreshedBy(stockChangeTags(TODAY))).toEqual(["stock today", "insights today"]);
	});

	it("a dessert: everything that shows desserts; a combo: only combos", async () => {
		expect(await refreshedBy(DESSERT_TAGS)).toEqual([
			"insights today",
			"insights yesterday",
			"dessert sales",
			"desserts",
			"combos",
		]);
		expect(await refreshedBy(COMBO_TAGS)).toEqual(["combos"]);
	});

	it("staff and UPI accounts: their own lists", async () => {
		expect(await refreshedBy(STAFF_TAGS)).toEqual(["staff"]);
		expect(await refreshedBy(UPI_TAGS)).toEqual(["upi"]);
	});

	it("Refresh data: every screen", async () => {
		expect(await refreshedBy(ALL_CACHE_TAGS)).toEqual(Object.keys(screens));
	});

	it("nothing when the action refreshed nothing", async () => {
		expect(await refreshedBy([])).toEqual([]);
	});
});
