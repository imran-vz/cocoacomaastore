import "server-only";

import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { ordersTable } from "@/db/schema";
import { AccessError, requireStaff } from "@/features/access/session";
import { canBrowsePastDays, type DayOrders, type OrderRecord } from "@/features/orders/contract";
import { dayOrdersTags } from "@/features/orders/tags";
import { TAGGED_READ_REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { type DayKey, dayEnd, dayKeyOf, dayStart } from "@/lib/shop-calendar";

async function readDayOrders(day: DayKey): Promise<OrderRecord[]> {
	const rows = await db.query.ordersTable.findMany({
		where: and(
			eq(ordersTable.isDeleted, false),
			gte(ordersTable.createdAt, dayStart(day)),
			lt(ordersTable.createdAt, dayEnd(day)),
		),
		orderBy: [desc(ordersTable.createdAt), desc(ordersTable.id)],
		columns: { id: true, customerName: true, createdAt: true, status: true, deliveryCost: true, total: true },
		with: {
			orderItems: {
				orderBy: (items) => [asc(items.id)],
				columns: { id: true, quantity: true, unitPrice: true, baseDessertName: true, comboName: true },
				with: {
					modifiers: {
						orderBy: (modifiers) => [asc(modifiers.id)],
						columns: { id: true, dessertName: true, quantity: true },
					},
				},
			},
		},
	});

	return rows.map(({ orderItems, createdAt, ...order }) => ({
		...order,
		createdAt: createdAt.toISOString(),
		lines: orderItems.map(({ baseDessertName, modifiers, ...item }) => ({
			...item,
			dessertName: baseDessertName,
			modifiers: modifiers.map(({ dessertName, ...modifier }) => ({ ...modifier, name: dessertName })),
		})),
	}));
}

/** One shop day's orders, newest first. Order changes refresh the day's tag (`orderChangeTags`). */
export async function getDayOrders(day: DayKey): Promise<DayOrders> {
	const today = dayKeyOf();
	const user = await requireStaff();
	if (day !== today && !canBrowsePastDays(user.area)) throw new AccessError(403);
	const orders = await unstable_cache(() => readDayOrders(day), ["orders-day", day], {
		revalidate: TAGGED_READ_REVALIDATE_SECONDS,
		tags: dayOrdersTags(day),
	})();
	return { day, today, orders };
}
