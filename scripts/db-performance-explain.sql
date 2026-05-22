-- Run against a local clone:
--   psql "$DATABASE_URL" -f scripts/db-performance-explain.sql
--
-- Optional overrides:
--   psql "$DATABASE_URL" \
--     -v target_day="'2026-05-22'" \
--     -v target_month="'2026-05'" \
--     -f scripts/db-performance-explain.sql

\set ON_ERROR_STOP on
\timing on

\if :{?target_day}
\else
\set target_day '''2026-05-22'''
\endif

\if :{?target_month}
\else
\set target_month '''2026-05'''
\endif

SELECT
	:target_day::date AS target_day,
	:target_month::text AS target_month;

-- 1. Admin/manager orders list: active orders for a day, newest first.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM orders
WHERE "isDeleted" = false
	AND "createdAt" >= :target_day::date
	AND "createdAt" < (:target_day::date + interval '1 day')
ORDER BY "createdAt" DESC;

-- 2. Dashboard today's completed order count and revenue.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT count(*)::int AS count, coalesce(sum(total), 0) AS revenue
FROM orders
WHERE status = 'completed'
	AND "isDeleted" = false
	AND "createdAt" >= :target_day::date
	AND "createdAt" < (:target_day::date + interval '1 day');

-- 3. Dashboard today's item count through order_items -> orders.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT coalesce(sum(oi.quantity), 0)::int AS total_items
FROM order_items oi
INNER JOIN orders o ON oi."orderId" = o.id
WHERE o.status = 'completed'
	AND o."isDeleted" = false
	AND o."createdAt" >= :target_day::date
	AND o."createdAt" < (:target_day::date + interval '1 day');

-- 4. Public/admin dessert list: visible desserts sorted by sequence.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM desserts
WHERE "isDeleted" = false
ORDER BY sequence ASC;

-- 5. Public dessert list: enabled visible desserts sorted by sequence.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM desserts
WHERE "isDeleted" = false
	AND enabled = true
ORDER BY sequence ASC;

-- 6. Modifier picker: enabled modifier desserts sorted by sequence.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, name, price
FROM desserts
WHERE "isDeleted" = false
	AND enabled = true
	AND kind = 'modifier'
ORDER BY sequence ASC;

-- 7. Combo list: enabled visible combos sorted by sequence.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM dessert_combos
WHERE "isDeleted" = false
	AND enabled = true
ORDER BY sequence ASC;

-- 8. UPI picker: enabled visible accounts sorted by sequence.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM upi_accounts
WHERE "isDeleted" = false
	AND enabled = true
ORDER BY sequence ASC;

-- 9. Today's inventory lookup and lock/update target shape.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT "dessertId", quantity
FROM daily_dessert_inventory
WHERE day = :target_day::date;

-- 10. Dashboard audit log: today's audit entries, newest first.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT ial.id,
	ial.day,
	d.name AS dessert_name,
	ial.action,
	ial."previousQuantity",
	ial."newQuantity",
	ial."orderId",
	ial."createdAt",
	ial.note
FROM inventory_audit_log ial
INNER JOIN desserts d ON ial."dessertId" = d.id
WHERE ial."createdAt" >= :target_day::date
	AND ial."createdAt" < (:target_day::date + interval '1 day')
ORDER BY ial."createdAt" DESC
LIMIT 50;

-- 11. Daily analytics recompute: base item aggregation.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT oi."dessertId" AS dessert_id,
	oi."orderId" AS order_id,
	sum(oi."unitPrice"::numeric * oi.quantity) AS revenue,
	sum(oi.quantity) AS quantity
FROM order_items oi
INNER JOIN orders o ON o.id = oi."orderId"
WHERE o.status = 'completed'
	AND o."isDeleted" = false
	AND o."createdAt" >= :target_day::date
	AND o."createdAt" < (:target_day::date + interval '1 day')
GROUP BY oi."dessertId", oi."orderId";

-- 12. Daily analytics recompute: modifier item aggregation.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT oim."dessertId" AS dessert_id,
	oi."orderId" AS order_id,
	0::numeric AS revenue,
	sum(oim.quantity * oi.quantity) AS quantity
FROM order_item_modifiers oim
INNER JOIN order_items oi ON oi.id = oim."orderItemId"
INNER JOIN orders o ON o.id = oi."orderId"
WHERE o.status = 'completed'
	AND o."isDeleted" = false
	AND o."createdAt" >= :target_day::date
	AND o."createdAt" < (:target_day::date + interval '1 day')
GROUP BY oim."dessertId", oi."orderId";

-- 13. EOD stock recompute: audit-log window function source.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT "dessertId",
	"previousQuantity",
	"newQuantity",
	row_number() OVER (
		PARTITION BY "dessertId"
		ORDER BY "createdAt" ASC, id ASC
	) AS rn_asc,
	row_number() OVER (
		PARTITION BY "dessertId"
		ORDER BY "createdAt" DESC, id DESC
	) AS rn_desc
FROM inventory_audit_log
WHERE "createdAt" >= :target_day::date
	AND "createdAt" < (:target_day::date + interval '1 day')
	AND "dessertId" IS NOT NULL;

-- 14. Monthly dessert revenue chart.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT amdr.month,
	amdr.dessert_id,
	d.name AS dessert_name,
	amdr.gross_revenue,
	amdr.quantity_sold,
	amdr.order_count
FROM analytics_monthly_dessert_revenue amdr
INNER JOIN desserts d ON amdr.dessert_id = d.id
WHERE amdr.month = :target_month
ORDER BY amdr.gross_revenue DESC;

-- 15. EOD stock trend chart.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT aes.day,
	aes.dessert_id,
	d.name AS dessert_name,
	aes.initial_stock,
	aes.remaining_stock
FROM analytics_daily_eod_stock aes
INNER JOIN desserts d ON aes.dessert_id = d.id
WHERE aes.day >= (:target_day::date - interval '13 days')
	AND aes.day <= :target_day::date
ORDER BY aes.day, d.name;
