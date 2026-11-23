import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { Queryable } from "@/db";
import {
	analyticsDailyDessertRevenueTable,
	analyticsDailyEodStockTable,
	analyticsDailyRevenueTable,
	analyticsMonthlyDessertRevenueTable,
	analyticsMonthlyRevenueTable,
	inventoryAuditLogTable,
	orderItemModifiersTable,
	orderItemsTable,
	ordersTable,
} from "@/db/schema";
import { completedOrdersBetween, salesTotals } from "@/features/insights/sales";
import { analyticsDate, type DayKey, dayEnd, dayStart, type MonthKey, monthEnd, monthStart } from "@/lib/shop-calendar";
import { Database } from "@/server/effect/services/db";

type DessertSalesRow = { dessertId: number; revenue: string; quantity: number; orderCount: number };

/**
 * Per-dessert sales in [start, end). A modifier counts its quantity (per unit of its line)
 * but no revenue; it earns revenue only when sold as a base line.
 */
async function dessertSalesBetween(db: Queryable, start: Date, end: Date): Promise<DessertSalesRow[]> {
	const rows = await db.execute<DessertSalesRow>(sql`
		WITH base_items AS (
			SELECT
				${orderItemsTable.dessertId} AS dessert_id,
				${orderItemsTable.orderId} AS order_id,
				SUM(${orderItemsTable.unitPrice} * ${orderItemsTable.quantity}) AS revenue,
				SUM(${orderItemsTable.quantity}) AS quantity
			FROM ${orderItemsTable}
			INNER JOIN ${ordersTable} ON ${ordersTable.id} = ${orderItemsTable.orderId}
			WHERE ${completedOrdersBetween(start, end)}
			GROUP BY ${orderItemsTable.dessertId}, ${orderItemsTable.orderId}
		),
		modifier_items AS (
			SELECT
				${orderItemModifiersTable.dessertId} AS dessert_id,
				${orderItemsTable.orderId} AS order_id,
				0::numeric AS revenue,
				SUM(${orderItemModifiersTable.quantity} * ${orderItemsTable.quantity}) AS quantity
			FROM ${orderItemModifiersTable}
			INNER JOIN ${orderItemsTable} ON ${orderItemsTable.id} = ${orderItemModifiersTable.orderItemId}
			INNER JOIN ${ordersTable} ON ${ordersTable.id} = ${orderItemsTable.orderId}
			WHERE ${completedOrdersBetween(start, end)}
			GROUP BY ${orderItemModifiersTable.dessertId}, ${orderItemsTable.orderId}
		),
		combined AS (
			SELECT * FROM base_items
			UNION ALL
			SELECT * FROM modifier_items
		)
		SELECT
			dessert_id AS "dessertId",
			SUM(revenue)::text AS revenue,
			SUM(quantity)::int AS quantity,
			COUNT(DISTINCT order_id)::int AS "orderCount"
		FROM combined
		GROUP BY dessert_id
	`);
	return [...rows];
}

/** Each dessert's stock before its first and after its last change to the stock of `day` (an `analyticsDate`). */
async function dayStockMovement(db: Queryable, day: Date) {
	const rows = await db.execute<{ dessertId: number; initialStock: number; remainingStock: number }>(sql`
		WITH ranked AS (
			SELECT
				${inventoryAuditLogTable.dessertId} AS dessert_id,
				${inventoryAuditLogTable.previousQuantity} AS previous_quantity,
				${inventoryAuditLogTable.newQuantity} AS new_quantity,
				ROW_NUMBER() OVER (
					PARTITION BY ${inventoryAuditLogTable.dessertId}
					ORDER BY ${inventoryAuditLogTable.createdAt} ASC, ${inventoryAuditLogTable.id} ASC
				) AS rn_first,
				ROW_NUMBER() OVER (
					PARTITION BY ${inventoryAuditLogTable.dessertId}
					ORDER BY ${inventoryAuditLogTable.createdAt} DESC, ${inventoryAuditLogTable.id} DESC
				) AS rn_last
			FROM ${inventoryAuditLogTable}
			WHERE ${and(eq(inventoryAuditLogTable.day, day), isNotNull(inventoryAuditLogTable.dessertId))}
		)
		SELECT
			opening.dessert_id AS "dessertId",
			opening.previous_quantity AS "initialStock",
			closing.new_quantity AS "remainingStock"
		FROM ranked opening
		INNER JOIN ranked closing ON closing.dessert_id = opening.dessert_id AND closing.rn_last = 1
		WHERE opening.rn_first = 1
	`);
	return [...rows];
}

/** Overwrites one closed shop day's analytics rows from the order and stock tables. */
export function recomputeDay(day: DayKey) {
	const start = dayStart(day);
	const end = dayEnd(day);
	const date = analyticsDate(day);

	return Effect.gen(function* () {
		const database = yield* Database;
		yield* database.attempt(`recompute analytics for ${day}`, (db) =>
			db.transaction(async (tx) => {
				const totals = await salesTotals(tx, start, end);
				await tx
					.insert(analyticsDailyRevenueTable)
					.values({ day: date, grossRevenue: totals.revenue, orderCount: totals.orders })
					.onConflictDoUpdate({
						target: analyticsDailyRevenueTable.day,
						set: { grossRevenue: totals.revenue, orderCount: totals.orders },
					});

				const desserts = await dessertSalesBetween(tx, start, end);
				await tx.delete(analyticsDailyDessertRevenueTable).where(eq(analyticsDailyDessertRevenueTable.day, date));
				if (desserts.length > 0) {
					await tx.insert(analyticsDailyDessertRevenueTable).values(
						desserts.map((row) => ({
							day: date,
							dessertId: row.dessertId,
							grossRevenue: row.revenue,
							quantitySold: row.quantity,
							orderCount: row.orderCount,
						})),
					);
				}

				const stock = await dayStockMovement(tx, date);
				await tx.delete(analyticsDailyEodStockTable).where(eq(analyticsDailyEodStockTable.day, date));
				if (stock.length > 0) {
					await tx.insert(analyticsDailyEodStockTable).values(stock.map((row) => ({ day: date, ...row })));
				}
			}),
		);
	});
}

/** Overwrites one shop month's analytics rows from the order tables. */
export function recomputeMonth(month: MonthKey) {
	const start = monthStart(month);
	const end = monthEnd(month);

	return Effect.gen(function* () {
		const database = yield* Database;
		yield* database.attempt(`recompute analytics for ${month}`, (db) =>
			db.transaction(async (tx) => {
				const totals = await salesTotals(tx, start, end);
				await tx
					.insert(analyticsMonthlyRevenueTable)
					.values({ month, grossRevenue: totals.revenue, orderCount: totals.orders })
					.onConflictDoUpdate({
						target: analyticsMonthlyRevenueTable.month,
						set: { grossRevenue: totals.revenue, orderCount: totals.orders },
					});

				const desserts = await dessertSalesBetween(tx, start, end);
				await tx
					.delete(analyticsMonthlyDessertRevenueTable)
					.where(eq(analyticsMonthlyDessertRevenueTable.month, month));
				if (desserts.length > 0) {
					await tx.insert(analyticsMonthlyDessertRevenueTable).values(
						desserts.map((row) => ({
							month,
							dessertId: row.dessertId,
							grossRevenue: row.revenue,
							quantitySold: row.quantity,
							orderCount: row.orderCount,
						})),
					);
				}
			}),
		);
	});
}
