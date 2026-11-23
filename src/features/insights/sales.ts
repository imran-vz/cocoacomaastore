import { and, eq, gte, lt, type SQL, sql } from "drizzle-orm";
import type { Queryable } from "@/db";
import { orderItemsTable, ordersTable } from "@/db/schema";
import { SALE_STATUS } from "@/features/orders/sale";

/** Completed, non-deleted orders placed in [start, end): the only orders that count as sales. */
export function completedOrdersBetween(start: Date, end: Date): SQL {
	return and(
		eq(ordersTable.status, SALE_STATUS),
		eq(ordersTable.isDeleted, false),
		gte(ordersTable.createdAt, start),
		lt(ordersTable.createdAt, end),
	) as SQL;
}

/** Revenue (a decimal string, as Postgres sums it) and order count of the sales in [start, end). */
export async function salesTotals(db: Queryable, start: Date, end: Date): Promise<{ revenue: string; orders: number }> {
	const [row] = await db
		.select({
			revenue: sql<string>`coalesce(sum(${ordersTable.total}), 0)::text`,
			orders: sql<number>`count(*)::int`,
		})
		.from(ordersTable)
		.where(completedOrdersBetween(start, end));
	return { revenue: row?.revenue ?? "0", orders: row?.orders ?? 0 };
}

/**
 * Items sold in [start, end): the quantities of the order lines, as the Orders page and the
 * cart count them. A combo is one item; its add-on modifiers are not counted again.
 */
export async function itemsSold(db: Queryable, start: Date, end: Date): Promise<number> {
	const [row] = await db
		.select({ items: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)::int` })
		.from(orderItemsTable)
		.innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
		.where(completedOrdersBetween(start, end));
	return row?.items ?? 0;
}
