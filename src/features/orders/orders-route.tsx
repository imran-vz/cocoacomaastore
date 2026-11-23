import "server-only";

import type { Area } from "@/features/access/area";
import { ORDERS_DATE_PARAM } from "@/features/orders/links";
import { OrdersPage } from "@/features/orders/orders-page";
import { shownDay } from "@/features/orders/presentation";
import { getDayOrders } from "@/features/orders/queries";
import { snapshot } from "@/lib/server-snapshot";
import { dayKeyOf, parseDayKey } from "@/lib/shop-calendar";

/** What a Next page receives as `searchParams`. */
export type OrdersSearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The Orders route for `area`: the page opens on the day its URL picks, where the area may pick one. */
export function OrdersRoute({ area, searchParams }: { area: Area; searchParams: OrdersSearchParams }) {
	const initial = searchParams.then((params) => {
		const picked = params[ORDERS_DATE_PARAM];
		return snapshot(getDayOrders(shownDay(area, parseDayKey(typeof picked === "string" ? picked : null), dayKeyOf())));
	});
	return <OrdersPage area={area} initial={initial} />;
}
