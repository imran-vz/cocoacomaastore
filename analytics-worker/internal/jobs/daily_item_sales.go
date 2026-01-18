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

const TypeDailyItemSales = "analytics:daily_item_sales"

type DailyItemSalesPayload struct {
	Date string // YYYY-MM-DD, empty string means "calculate yesterday"
}

// NewDailyItemSalesTask creates a task for a specific date (used for backfill)
func NewDailyItemSalesTask(date time.Time) (*asynq.Task, error) {
	payload, err := json.Marshal(DailyItemSalesPayload{
		Date: date.Format("2006-01-02"),
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailyItemSales, payload), nil
}

// NewScheduledDailyItemSalesTask creates a task that will calculate yesterday at execution time
func NewScheduledDailyItemSalesTask() (*asynq.Task, error) {
	payload, err := json.Marshal(DailyItemSalesPayload{
		Date: "", // Empty means calculate yesterday at execution time
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailyItemSales, payload), nil
}

func HandleDailyItemSales(pool *pgxpool.Pool, cfg *config.Config) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		var p DailyItemSalesPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("ERROR: Failed to unmarshal daily item sales payload: %v", err)
			return err
		}

		// Calculate date: if empty, use yesterday in IST
		var date time.Time
		if p.Date == "" {
			date = time.Now().In(cfg.ISTLocation).AddDate(0, 0, -1)
			p.Date = date.Format("2006-01-02")
			log.Printf("INFO: Scheduled daily item sales job - calculated date: %s", p.Date)
		} else {
			date, _ = time.Parse("2006-01-02", p.Date)
		}

		log.Printf("INFO: Starting daily item sales job for date: %s", p.Date)

		// Use UTC midnight for the day column (for consistent querying)
		dayUTC := cfg.StartOfDayUTC(date)
		// Use IST range for querying orders (business day in IST)
		dayStartIST := cfg.StartOfDayIST(date)
		dayEndIST := cfg.EndOfDayIST(date)

		// Query order items for completed orders, separated by item type (dessert vs combo)
		query := `
			WITH dessert_sales AS (
				-- Individual desserts (not part of combo)
				SELECT
					oi."dessertId" as item_id,
					'dessert' as item_type,
					SUM(oi.quantity) as quantity_sold
				FROM order_items oi
				INNER JOIN orders o ON o.id = oi."orderId"
				WHERE o.status = 'completed'
					AND o."isDeleted" = false
					AND o."createdAt" >= $2
					AND o."createdAt" < $3
					AND oi."comboId" IS NULL  -- exclude combo orders
				GROUP BY oi."dessertId"
			),
			combo_sales AS (
				-- Combos counted as single units
				SELECT
					oi."comboId" as item_id,
					'combo' as item_type,
					SUM(oi.quantity) as quantity_sold
				FROM order_items oi
				INNER JOIN orders o ON o.id = oi."orderId"
				WHERE o.status = 'completed'
					AND o."isDeleted" = false
					AND o."createdAt" >= $2
					AND o."createdAt" < $3
					AND oi."comboId" IS NOT NULL
				GROUP BY oi."comboId"
			)
			INSERT INTO analytics_daily_item_sales (day, item_type, item_id, quantity_sold)
			SELECT $1::timestamp, item_type, item_id, quantity_sold FROM dessert_sales
			UNION ALL
			SELECT $1::timestamp, item_type, item_id, quantity_sold FROM combo_sales
			ON CONFLICT (day, item_type, item_id)
			DO UPDATE SET
				quantity_sold = EXCLUDED.quantity_sold;
		`

		result, err := pool.Exec(ctx, query, dayUTC, dayStartIST, dayEndIST)
		if err != nil {
			log.Printf("ERROR: Daily item sales job failed for date %s: %v", p.Date, err)
			return err
		}

		log.Printf("INFO: Daily item sales job completed for date %s (rows affected: %d)", p.Date, result.RowsAffected())
		return nil
	}
}
