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

const TypeDailyEodStock = "analytics:daily_eod_stock"

type DailyEodStockPayload struct {
	Date string // YYYY-MM-DD, empty string means "calculate yesterday"
}

// NewDailyEodStockTask creates a task for a specific date (used for backfill)
func NewDailyEodStockTask(date time.Time) (*asynq.Task, error) {
	payload, err := json.Marshal(DailyEodStockPayload{
		Date: date.Format("2006-01-02"),
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailyEodStock, payload), nil
}

// NewScheduledDailyEodStockTask creates a task that will calculate yesterday at execution time
func NewScheduledDailyEodStockTask() (*asynq.Task, error) {
	payload, err := json.Marshal(DailyEodStockPayload{
		Date: "", // Empty means calculate yesterday at execution time
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailyEodStock, payload), nil
}

func HandleDailyEodStock(pool *pgxpool.Pool, cfg *config.Config) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		var p DailyEodStockPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("ERROR: Failed to unmarshal daily EOD stock payload: %v", err)
			return err
		}

		// Calculate date: if empty, use yesterday in IST
		var date time.Time
		if p.Date == "" {
			date = time.Now().In(cfg.ISTLocation).AddDate(0, 0, -1)
			p.Date = date.Format("2006-01-02")
			log.Printf("INFO: Scheduled daily EOD stock job - calculated date: %s", p.Date)
		} else {
			date, _ = time.Parse("2006-01-02", p.Date)
		}

		log.Printf("INFO: Starting daily EOD stock job for date: %s", p.Date)

		// Use UTC midnight for the day column (for consistent querying)
		dayUTC := cfg.StartOfDayUTC(date)
		// Use IST range for querying orders (business day in IST)
		dayStartIST := cfg.StartOfDayIST(date)
		dayEndIST := cfg.EndOfDayIST(date)

		// Query captures:
		// - remaining_stock: EOD stock from daily_dessert_inventory
		// - initial_stock: remaining_stock + quantity sold that day
		// Only records desserts where remaining_stock > 0
		query := `
			WITH eod_inventory AS (
				-- Get the EOD stock for each dessert from daily_dessert_inventory
				SELECT
					"dessertId",
					quantity AS remaining_stock
				FROM daily_dessert_inventory
				WHERE day = $1
				  AND quantity > 0
			),
			daily_sales AS (
				-- Calculate quantity sold per dessert for this day (includes all sales)
				SELECT
					oi."dessertId",
					SUM(oi.quantity) AS quantity_sold
				FROM order_items oi
				INNER JOIN orders o ON o.id = oi."orderId"
				WHERE o.status = 'completed'
				  AND o."isDeleted" = false
				  AND o."createdAt" >= $2
				  AND o."createdAt" < $3
				GROUP BY oi."dessertId"
			)
			INSERT INTO analytics_daily_eod_stock (day, dessert_id, initial_stock, remaining_stock)
			SELECT
				$1::timestamp AS day,
				ei."dessertId",
				ei.remaining_stock + COALESCE(ds.quantity_sold, 0) AS initial_stock,
				ei.remaining_stock
			FROM eod_inventory ei
			LEFT JOIN daily_sales ds ON ds."dessertId" = ei."dessertId"
			ON CONFLICT (day, dessert_id)
			DO UPDATE SET
				initial_stock = EXCLUDED.initial_stock,
				remaining_stock = EXCLUDED.remaining_stock;
		`

		result, err := pool.Exec(ctx, query, dayUTC, dayStartIST, dayEndIST)
		if err != nil {
			log.Printf("ERROR: Daily EOD stock job failed for date %s: %v", p.Date, err)
			return err
		}

		log.Printf("INFO: Daily EOD stock job completed for date %s (rows affected: %d)", p.Date, result.RowsAffected())
		return nil
	}
}
