import postgres from "postgres";

const backfill = process.argv.includes("--backfill");

if (!process.env.DATABASE_URL) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 86_400_000;

function getISTNow(): { year: number; month: number } {
	const ist = new Date(Date.now() + IST_OFFSET_MS);
	return { year: ist.getUTCFullYear(), month: ist.getUTCMonth() + 1 };
}

function istMidnightToUTC(year: number, month: number, day = 1): Date {
	return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

function fmtMonth(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}

function nextMonth(year: number, month: number): { year: number; month: number } {
	return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function expandToFullISOWeeks(start: Date, end: Date): { start: Date; end: Date } {
	const startIST = new Date(start.getTime() + IST_OFFSET_MS);
	const startDow = startIST.getUTCDay();
	const daysBack = startDow === 0 ? 6 : startDow - 1;
	const expandedStartIST = new Date(
		Date.UTC(startIST.getUTCFullYear(), startIST.getUTCMonth(), startIST.getUTCDate() - daysBack),
	);

	const lastIST = new Date(end.getTime() + IST_OFFSET_MS - DAY_MS);
	const lastDow = lastIST.getUTCDay();
	const daysForward = lastDow === 0 ? 1 : 8 - lastDow;
	const expandedEndIST = new Date(
		Date.UTC(lastIST.getUTCFullYear(), lastIST.getUTCMonth(), lastIST.getUTCDate() + daysForward),
	);

	return {
		start: new Date(expandedStartIST.getTime() - IST_OFFSET_MS),
		end: new Date(expandedEndIST.getTime() - IST_OFFSET_MS),
	};
}

async function getFirstOrderMonth(): Promise<{ year: number; month: number }> {
	const [row] = await client`
		SELECT MIN("createdAt") as min_date FROM orders
		WHERE status = 'completed' AND "isDeleted" = false
	`;
	if (!row?.min_date) throw new Error("No completed orders found");
	const ist = new Date(new Date(row.min_date).getTime() + IST_OFFSET_MS);
	return { year: ist.getUTCFullYear(), month: ist.getUTCMonth() + 1 };
}

function generateMonths(
	from: { year: number; month: number },
	to: { year: number; month: number },
): Array<{ year: number; month: number }> {
	const months: Array<{ year: number; month: number }> = [];
	let { year, month } = from;
	while (year < to.year || (year === to.year && month <= to.month)) {
		months.push({ year, month });
		const next = nextMonth(year, month);
		year = next.year;
		month = next.month;
	}
	return months;
}

async function compileDailyRevenue(start: Date, end: Date) {
	await client`
		INSERT INTO analytics_daily_revenue (day, gross_revenue, order_count)
		SELECT
			d.day,
			COALESCE(SUM(o.total::numeric), 0),
			COUNT(o.id)
		FROM generate_series(
			${start} AT TIME ZONE 'Asia/Kolkata',
			(${end} AT TIME ZONE 'Asia/Kolkata') - interval '1 day',
			interval '1 day'
		) AS d(day)
		LEFT JOIN orders o ON
			date_trunc('day', o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = d.day
			AND o.status = 'completed'
			AND o."isDeleted" = false
		GROUP BY d.day
		ON CONFLICT (day) DO UPDATE SET
			gross_revenue = EXCLUDED.gross_revenue,
			order_count = EXCLUDED.order_count
	`;
}

async function compileDailyDessertRevenue(start: Date, end: Date) {
	await client`
		WITH base_items AS (
			SELECT
				oi."dessertId" AS dessert_id,
				date_trunc('day', o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day,
				SUM(oi."unitPrice"::numeric * oi.quantity) AS revenue,
				SUM(oi.quantity) AS quantity,
				COUNT(DISTINCT oi."orderId") AS order_count
			FROM order_items oi
			INNER JOIN orders o ON o.id = oi."orderId"
			WHERE o.status = 'completed'
				AND o."isDeleted" = false
				AND o."createdAt" >= ${start}
				AND o."createdAt" < ${end}
			GROUP BY oi."dessertId", 2
		),
		modifier_items AS (
			SELECT
				oim."dessertId" AS dessert_id,
				date_trunc('day', o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS day,
				0::numeric AS revenue,
				SUM(oim.quantity * oi.quantity) AS quantity,
				COUNT(DISTINCT oi."orderId") AS order_count
			FROM order_item_modifiers oim
			INNER JOIN order_items oi ON oi.id = oim."orderItemId"
			INNER JOIN orders o ON o.id = oi."orderId"
			WHERE o.status = 'completed'
				AND o."isDeleted" = false
				AND o."createdAt" >= ${start}
				AND o."createdAt" < ${end}
			GROUP BY oim."dessertId", 2
		),
		combined AS (
			SELECT dessert_id, day, revenue, quantity, order_count FROM base_items
			UNION ALL
			SELECT dessert_id, day, revenue, quantity, order_count FROM modifier_items
		)
		INSERT INTO analytics_daily_dessert_revenue (day, dessert_id, gross_revenue, quantity_sold, order_count)
		SELECT day, dessert_id, SUM(revenue), SUM(quantity), SUM(order_count)
		FROM combined
		GROUP BY day, dessert_id
		ON CONFLICT (day, dessert_id) DO UPDATE SET
			gross_revenue = EXCLUDED.gross_revenue,
			quantity_sold = EXCLUDED.quantity_sold,
			order_count = EXCLUDED.order_count
	`;
}

async function compileWeeklyRevenue(start: Date, end: Date) {
	const { start: weekStart, end: weekEnd } = expandToFullISOWeeks(start, end);

	await client`
		INSERT INTO analytics_weekly_revenue (week_start, week_end, gross_revenue, order_count)
		SELECT
			w.week_start,
			(w.week_start + interval '6 days')::timestamp AS week_end,
			COALESCE(SUM(o.total::numeric), 0),
			COUNT(o.id)
		FROM generate_series(
			${weekStart} AT TIME ZONE 'Asia/Kolkata',
			(${weekEnd} AT TIME ZONE 'Asia/Kolkata') - interval '7 days',
			interval '1 week'
		) AS w(week_start)
		LEFT JOIN orders o ON
			date_trunc('week', o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = w.week_start
			AND o.status = 'completed'
			AND o."isDeleted" = false
		GROUP BY w.week_start
		ON CONFLICT (week_start) DO UPDATE SET
			week_end = EXCLUDED.week_end,
			gross_revenue = EXCLUDED.gross_revenue,
			order_count = EXCLUDED.order_count
	`;
}

async function compileMonthlyRevenue(label: string, start: Date, end: Date) {
	await client`
		INSERT INTO analytics_monthly_revenue (month, gross_revenue, order_count)
		SELECT
			${label} AS month,
			COALESCE(SUM(total::numeric), 0),
			COUNT(*)
		FROM orders
		WHERE status = 'completed'
			AND "isDeleted" = false
			AND "createdAt" >= ${start}
			AND "createdAt" < ${end}
		ON CONFLICT (month) DO UPDATE SET
			gross_revenue = EXCLUDED.gross_revenue,
			order_count = EXCLUDED.order_count
	`;
}

async function compileMonthlyDessertRevenue(label: string, start: Date, end: Date) {
	await client`
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
				AND o."createdAt" >= ${start}
				AND o."createdAt" < ${end}
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
				AND o."createdAt" >= ${start}
				AND o."createdAt" < ${end}
			GROUP BY oim."dessertId"
		),
		combined AS (
			SELECT dessert_id, revenue, quantity, order_count FROM base_items
			UNION ALL
			SELECT dessert_id, revenue, quantity, order_count FROM modifier_items
		)
		INSERT INTO analytics_monthly_dessert_revenue (month, dessert_id, gross_revenue, quantity_sold, order_count)
		SELECT ${label}, dessert_id, SUM(revenue), SUM(quantity), SUM(order_count)
		FROM combined
		GROUP BY dessert_id
		ON CONFLICT (month, dessert_id) DO UPDATE SET
			gross_revenue = EXCLUDED.gross_revenue,
			quantity_sold = EXCLUDED.quantity_sold,
			order_count = EXCLUDED.order_count
	`;
}

async function compileDailyEodStock(start: Date, end: Date) {
	await client`
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
			WHERE "createdAt" >= ${start}
				AND "createdAt" < ${end}
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
	`;
}

async function main() {
	const current = getISTNow();
	let months: Array<{ year: number; month: number }>;

	if (backfill) {
		const first = await getFirstOrderMonth();
		months = generateMonths(first, current);
		console.log(
			`Backfilling ${months.length} months from ${fmtMonth(first.year, first.month)} to ${fmtMonth(current.year, current.month)}`,
		);
	} else {
		months = [current];
		console.log(`Compiling analytics for ${fmtMonth(current.year, current.month)}`);
	}

	for (const { year, month } of months) {
		const label = fmtMonth(year, month);
		const nm = nextMonth(year, month);
		const start = istMidnightToUTC(year, month, 1);
		const end = istMidnightToUTC(nm.year, nm.month, 1);

		process.stdout.write(`  ${label}`);

		process.stdout.write(" daily");
		await compileDailyRevenue(start, end);
		await compileDailyDessertRevenue(start, end);

		process.stdout.write(" monthly");
		await compileMonthlyRevenue(label, start, end);
		await compileMonthlyDessertRevenue(label, start, end);

		process.stdout.write(" eod-stock");
		await compileDailyEodStock(start, end);

		console.log(" done");
	}

	const first = months[0];
	const last = months[months.length - 1];
	const nm = nextMonth(last.year, last.month);

	process.stdout.write("  weekly revenue...");
	await compileWeeklyRevenue(istMidnightToUTC(first.year, first.month, 1), istMidnightToUTC(nm.year, nm.month, 1));
	console.log(" done");

	console.log("All analytics compiled successfully.");
	await client.end();
}

main().catch((err) => {
	console.error("Failed:", err.message);
	process.exit(1);
});
