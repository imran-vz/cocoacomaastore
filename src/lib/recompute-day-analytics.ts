import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function recomputeDayAnalytics(date: Date) {
	const dayStart = new Date(date);
	dayStart.setUTCHours(0, 0, 0, 0);
	const dayEnd = new Date(dayStart);
	dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

	await db.execute(sql`
		WITH day_data AS (
			SELECT
				date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day,
				total::numeric AS total,
				id
			FROM orders
			WHERE status = 'completed'
				AND "isDeleted" = false
				AND "createdAt" >= ${dayStart}
				AND "createdAt" < ${dayEnd}
		)
		INSERT INTO analytics_daily_revenue (day, gross_revenue, order_count)
		SELECT
			date_trunc('day', ${dayStart} AT TIME ZONE 'Asia/Kolkata') AS day,
			COALESCE(SUM(total), 0),
			COUNT(id)
		FROM day_data
		ON CONFLICT (day) DO UPDATE SET
			gross_revenue = EXCLUDED.gross_revenue,
			order_count = EXCLUDED.order_count
	`);

	await db.execute(sql`
		WITH base_items AS (
			SELECT
				oi."dessertId" AS dessert_id,
				SUM(oi."unitPrice"::numeric * oi.quantity) AS revenue,
				SUM(oi.quantity) AS quantity,
				COUNT(DISTINCT oi."orderId") AS order_count
			FROM order_items oi
			INNER JOIN orders o ON o.id = oi."orderId"
			WHERE o.status = 'completed'
				AND o."isDeleted" = false
				AND o."createdAt" >= ${dayStart}
				AND o."createdAt" < ${dayEnd}
			GROUP BY oi."dessertId"
		),
		modifier_items AS (
			SELECT
				oim."dessertId" AS dessert_id,
				0::numeric AS revenue,
				SUM(oim.quantity * oi.quantity) AS quantity,
				COUNT(DISTINCT oi."orderId") AS order_count
			FROM order_item_modifiers oim
			INNER JOIN order_items oi ON oi.id = oim."orderItemId"
			INNER JOIN orders o ON o.id = oi."orderId"
			WHERE o.status = 'completed'
				AND o."isDeleted" = false
				AND o."createdAt" >= ${dayStart}
				AND o."createdAt" < ${dayEnd}
			GROUP BY oim."dessertId"
		),
		combined AS (
			SELECT dessert_id, revenue, quantity, order_count FROM base_items
			UNION ALL
			SELECT dessert_id, revenue, quantity, order_count FROM modifier_items
		)
		INSERT INTO analytics_daily_dessert_revenue (day, dessert_id, gross_revenue, quantity_sold, order_count)
		SELECT
			date_trunc('day', ${dayStart} AT TIME ZONE 'Asia/Kolkata'),
			dessert_id, SUM(revenue), SUM(quantity), SUM(order_count)
		FROM combined
		GROUP BY dessert_id
		ON CONFLICT (day, dessert_id) DO UPDATE SET
			gross_revenue = EXCLUDED.gross_revenue,
			quantity_sold = EXCLUDED.quantity_sold,
			order_count = EXCLUDED.order_count
	`);

	await db.execute(sql`
		WITH ranked AS (
			SELECT
				date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day,
				"dessertId" AS dessert_id,
				"previousQuantity",
				"newQuantity",
				ROW_NUMBER() OVER (
					PARTITION BY date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'), "dessertId"
					ORDER BY "createdAt" ASC, id ASC
				) AS rn_asc,
				ROW_NUMBER() OVER (
					PARTITION BY date_trunc('day', "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'), "dessertId"
					ORDER BY "createdAt" DESC, id DESC
				) AS rn_desc
			FROM inventory_audit_log
			WHERE "createdAt" >= ${dayStart}
				AND "createdAt" < ${dayEnd}
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
		ON CONFLICT (day, dessert_id) DO UPDATE SET
			initial_stock = EXCLUDED.initial_stock,
			remaining_stock = EXCLUDED.remaining_stock
	`);
}
