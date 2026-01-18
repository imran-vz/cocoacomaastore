package jobs

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"cocoacomaa/analytics-worker/internal/config"
)

const TypeDailyDessertRevenue = "analytics:daily_dessert_revenue"

type DailyDessertRevenuePayload struct {
	Date string // YYYY-MM-DD, empty string means "calculate yesterday"
}

// NewDailyDessertRevenueTask creates a task for a specific date (used for backfill)
func NewDailyDessertRevenueTask(date time.Time) (*asynq.Task, error) {
	payload, err := json.Marshal(DailyDessertRevenuePayload{
		Date: date.Format("2006-01-02"),
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailyDessertRevenue, payload), nil
}

// NewScheduledDailyDessertRevenueTask creates a task that will calculate yesterday at execution time
func NewScheduledDailyDessertRevenueTask() (*asynq.Task, error) {
	payload, err := json.Marshal(DailyDessertRevenuePayload{
		Date: "", // Empty means calculate yesterday at execution time
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailyDessertRevenue, payload), nil
}

func HandleDailyDessertRevenue(pool *pgxpool.Pool, cfg *config.Config) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		var p DailyDessertRevenuePayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("ERROR: Failed to unmarshal daily dessert revenue payload: %v", err)
			return err
		}

		// Calculate date: if empty, use yesterday in IST
		var date time.Time
		if p.Date == "" {
			date = time.Now().In(cfg.ISTLocation).AddDate(0, 0, -1)
			p.Date = date.Format("2006-01-02")
			log.Printf("INFO: Scheduled daily dessert revenue job - calculated date: %s", p.Date)
		} else {
			date, _ = time.Parse("2006-01-02", p.Date)
		}

		log.Printf("INFO: Starting daily dessert revenue job for date: %s", p.Date)

		// Use UTC midnight for the day column (for consistent querying)
		dayUTC := cfg.StartOfDayUTC(date)
		// Use IST range for querying orders (business day in IST)
		dayStartIST := cfg.StartOfDayIST(date)
		dayEndIST := cfg.EndOfDayIST(date)

		// Query joins orders, order_items, desserts
		// Includes both base desserts and modifiers from order_item_modifiers
		query := `
			WITH base_items AS (
				SELECT
					oi."dessertId",
					SUM(oi."unitPrice" * oi.quantity) AS revenue,
					SUM(oi.quantity) AS quantity,
					COUNT(DISTINCT oi."orderId") AS order_count
				FROM order_items oi
				INNER JOIN orders o ON o.id = oi."orderId"
				WHERE o.status = 'completed'
				  AND o."isDeleted" = false
				  AND o."createdAt" >= $2
				  AND o."createdAt" < $3
				GROUP BY oi."dessertId"
			),
			modifier_items AS (
				SELECT
					oim."dessertId",
					SUM(oi."unitPrice" * oim.quantity) AS revenue,
					SUM(oim.quantity) AS quantity,
					COUNT(DISTINCT oi."orderId") AS order_count
				FROM order_item_modifiers oim
				INNER JOIN order_items oi ON oi.id = oim."orderItemId"
				INNER JOIN orders o ON o.id = oi."orderId"
				WHERE o.status = 'completed'
				  AND o."isDeleted" = false
				  AND o."createdAt" >= $2
				  AND o."createdAt" < $3
				GROUP BY oim."dessertId"
			),
			combined AS (
				SELECT "dessertId", revenue, quantity, order_count FROM base_items
				UNION ALL
				SELECT "dessertId", revenue, quantity, order_count FROM modifier_items
			)
			INSERT INTO analytics_daily_dessert_revenue (day, dessert_id, gross_revenue, quantity_sold, order_count)
			SELECT
				$1::timestamp AS day,
				"dessertId",
				SUM(revenue) AS gross_revenue,
				SUM(quantity) AS quantity_sold,
				SUM(order_count) AS order_count
			FROM combined
			GROUP BY "dessertId"
			ON CONFLICT (day, dessert_id)
			DO UPDATE SET
				gross_revenue = EXCLUDED.gross_revenue,
				quantity_sold = EXCLUDED.quantity_sold,
				order_count = EXCLUDED.order_count;
		`

		result, err := pool.Exec(ctx, query, dayUTC, dayStartIST, dayEndIST)
		if err != nil {
			log.Printf("ERROR: Daily dessert revenue job failed for date %s: %v", p.Date, err)
			return err
		}

		log.Printf("INFO: Daily dessert revenue job completed for date %s (rows affected: %d)", p.Date, result.RowsAffected())
		return nil
	}
}
