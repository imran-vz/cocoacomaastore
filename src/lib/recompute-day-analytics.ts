import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { fmtMonth, getAnalyticsDay, getStartOfDayIST, istMidnightToUTC, nextMonth, pgTimestamp } from "@/lib/ist-date";
import { Database } from "@/server/effect/services/db";

export function recomputeDayAnalyticsEffect(date: Date) {
	const dayStart = getStartOfDayIST(date);
	const dayEnd = new Date(dayStart.getTime() + 86_400_000);
	const analyticsDay = getAnalyticsDay(date);
	const dayStartValue = pgTimestamp(dayStart);
	const dayEndValue = pgTimestamp(dayEnd);
	const analyticsDayValue = pgTimestamp(analyticsDay);

	return Effect.gen(function* () {
		const database = yield* Database;
		const { db } = database;

		yield* database.attempt("recompute daily revenue", () =>
			db.execute(sql`
				WITH day_data AS (
					SELECT
						date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day,
						total::numeric AS total,
						id
					FROM orders
					WHERE status = 'completed'
						AND "isDeleted" = false
						AND "createdAt" >= ${dayStartValue}::timestamp
						AND "createdAt" < ${dayEndValue}::timestamp
				)
				INSERT INTO analytics_daily_revenue (day, gross_revenue, order_count)
				SELECT
					${analyticsDayValue}::timestamp AS day,
					COALESCE(SUM(total), 0),
					COUNT(id)
				FROM day_data
			ON CONFLICT (day) DO UPDATE SET
				gross_revenue = EXCLUDED.gross_revenue,
				order_count = EXCLUDED.order_count
		`),
		);

		yield* database.attempt("recompute daily dessert revenue", () =>
			db.transaction(async (tx) => {
				await tx.execute(sql`DELETE FROM analytics_daily_dessert_revenue WHERE day = ${analyticsDayValue}::timestamp`);

				await tx.execute(sql`
					WITH base_items AS (
						SELECT
							oi."dessertId" AS dessert_id,
							oi."orderId" AS order_id,
							SUM(oi."unitPrice"::numeric * oi.quantity) AS revenue,
							SUM(oi.quantity) AS quantity
						FROM order_items oi
						INNER JOIN orders o ON o.id = oi."orderId"
						WHERE o.status = 'completed'
							AND o."isDeleted" = false
							AND o."createdAt" >= ${dayStartValue}::timestamp
							AND o."createdAt" < ${dayEndValue}::timestamp
						GROUP BY oi."dessertId", oi."orderId"
					),
					modifier_items AS (
						SELECT
							oim."dessertId" AS dessert_id,
							oi."orderId" AS order_id,
							0::numeric AS revenue,
							SUM(oim.quantity * oi.quantity) AS quantity
						FROM order_item_modifiers oim
						INNER JOIN order_items oi ON oi.id = oim."orderItemId"
						INNER JOIN orders o ON o.id = oi."orderId"
						WHERE o.status = 'completed'
							AND o."isDeleted" = false
							AND o."createdAt" >= ${dayStartValue}::timestamp
							AND o."createdAt" < ${dayEndValue}::timestamp
						GROUP BY oim."dessertId", oi."orderId"
					),
					combined AS (
						SELECT dessert_id, order_id, revenue, quantity FROM base_items
						UNION ALL
						SELECT dessert_id, order_id, revenue, quantity FROM modifier_items
					)
					INSERT INTO analytics_daily_dessert_revenue (day, dessert_id, gross_revenue, quantity_sold, order_count)
					SELECT
						${analyticsDayValue}::timestamp,
						dessert_id, SUM(revenue), SUM(quantity), COUNT(DISTINCT order_id)
					FROM combined
					GROUP BY dessert_id
				`);
			}),
		);

		yield* database.attempt("recompute daily end-of-day stock", () =>
			db.transaction(async (tx) => {
				await tx.execute(sql`DELETE FROM analytics_daily_eod_stock WHERE day = ${analyticsDayValue}::timestamp`);

				await tx.execute(sql`
					WITH ranked AS (
						SELECT
							${analyticsDayValue}::timestamp AS day,
							"dessertId" AS dessert_id,
							"previousQuantity",
							"newQuantity",
							ROW_NUMBER() OVER (
								PARTITION BY "dessertId"
								ORDER BY "createdAt" ASC, id ASC
							) AS rn_asc,
							ROW_NUMBER() OVER (
								PARTITION BY "dessertId"
								ORDER BY "createdAt" DESC, id DESC
							) AS rn_desc
						FROM inventory_audit_log
						WHERE "createdAt" >= ${dayStartValue}::timestamp
							AND "createdAt" < ${dayEndValue}::timestamp
							AND "dessertId" IS NOT NULL
					),
					first_entries AS (
						SELECT day, dessert_id, "previousQuantity" AS initial_stock
						FROM ranked WHERE rn_asc = 1
					),
					last_entries AS (
						SELECT day, dessert_id, "newQuantity" AS remaining_stock
						FROM ranked WHERE rn_desc = 1
					)
					INSERT INTO analytics_daily_eod_stock (day, dessert_id, initial_stock, remaining_stock)
					SELECT f.day, f.dessert_id, f.initial_stock, l.remaining_stock
					FROM first_entries f
					INNER JOIN last_entries l ON f.day = l.day AND f.dessert_id = l.dessert_id
				`);
			}),
		);
	});
}

export function recomputeMonthAnalyticsEffect(date: Date) {
	const analyticsDay = getAnalyticsDay(date);
	const year = analyticsDay.getUTCFullYear();
	const month = analyticsDay.getUTCMonth() + 1;
	const label = fmtMonth(year, month);
	const next = nextMonth(year, month);
	const monthStart = istMidnightToUTC(year, month);
	const monthEnd = istMidnightToUTC(next.year, next.month);
	const monthStartValue = pgTimestamp(monthStart);
	const monthEndValue = pgTimestamp(monthEnd);

	return Effect.gen(function* () {
		const database = yield* Database;
		const { db } = database;

		yield* database.attempt("recompute monthly revenue", () =>
			db.execute(sql`
				INSERT INTO analytics_monthly_revenue (month, gross_revenue, order_count)
				SELECT
					${label} AS month,
					COALESCE(SUM(total::numeric), 0),
					COUNT(*)
				FROM orders
				WHERE status = 'completed'
					AND "isDeleted" = false
					AND "createdAt" >= ${monthStartValue}::timestamp
					AND "createdAt" < ${monthEndValue}::timestamp
				ON CONFLICT (month) DO UPDATE SET
					gross_revenue = EXCLUDED.gross_revenue,
					order_count = EXCLUDED.order_count
		`),
		);

		yield* database.attempt("recompute monthly dessert revenue", () =>
			db.transaction(async (tx) => {
				await tx.execute(sql`DELETE FROM analytics_monthly_dessert_revenue WHERE month = ${label}`);

				await tx.execute(sql`
					WITH base_items AS (
						SELECT
							oi."dessertId" AS dessert_id,
							oi."orderId" AS order_id,
							SUM(oi."unitPrice"::numeric * oi.quantity) AS revenue,
							SUM(oi.quantity) AS quantity
						FROM order_items oi
						INNER JOIN orders o ON o.id = oi."orderId"
						WHERE o.status = 'completed'
							AND o."isDeleted" = false
							AND o."createdAt" >= ${monthStartValue}::timestamp
							AND o."createdAt" < ${monthEndValue}::timestamp
						GROUP BY oi."dessertId", oi."orderId"
					),
					modifier_items AS (
						SELECT
							oim."dessertId" AS dessert_id,
							oi."orderId" AS order_id,
							0::numeric AS revenue,
							SUM(oim.quantity * oi.quantity) AS quantity
						FROM order_item_modifiers oim
						INNER JOIN order_items oi ON oi.id = oim."orderItemId"
						INNER JOIN orders o ON o.id = oi."orderId"
						WHERE o.status = 'completed'
							AND o."isDeleted" = false
							AND o."createdAt" >= ${monthStartValue}::timestamp
							AND o."createdAt" < ${monthEndValue}::timestamp
						GROUP BY oim."dessertId", oi."orderId"
					),
					combined AS (
						SELECT dessert_id, order_id, revenue, quantity FROM base_items
						UNION ALL
						SELECT dessert_id, order_id, revenue, quantity FROM modifier_items
					)
					INSERT INTO analytics_monthly_dessert_revenue (month, dessert_id, gross_revenue, quantity_sold, order_count)
					SELECT ${label}, dessert_id, SUM(revenue), SUM(quantity), COUNT(DISTINCT order_id)
					FROM combined
					GROUP BY dessert_id
				`);
			}),
		);
	});
}

export function recomputeAnalyticsForDateEffect(date: Date) {
	return Effect.gen(function* () {
		yield* recomputeDayAnalyticsEffect(date);
		yield* recomputeMonthAnalyticsEffect(date);
	});
}
