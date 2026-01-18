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

const TypeMonthlyStock = "analytics:monthly_stock"

type MonthlyStockPayload struct {
	Month string // YYYY-MM, empty string means "calculate previous month"
}

// NewMonthlyStockTask creates a task for a specific month (used for backfill)
func NewMonthlyStockTask(date time.Time) (*asynq.Task, error) {
	payload, err := json.Marshal(MonthlyStockPayload{
		Month: date.Format("2006-01"),
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeMonthlyStock, payload), nil
}

// NewScheduledMonthlyStockTask creates a task that will calculate previous month at execution time
func NewScheduledMonthlyStockTask() (*asynq.Task, error) {
	payload, err := json.Marshal(MonthlyStockPayload{
		Month: "", // Empty means calculate previous month at execution time
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeMonthlyStock, payload), nil
}

func HandleMonthlyStock(pool *pgxpool.Pool, cfg *config.Config) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		var p MonthlyStockPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("ERROR: Failed to unmarshal monthly stock payload: %v", err)
			return err
		}

		// Calculate month: if empty, use previous month
		var monthDate time.Time
		if p.Month == "" {
			now := time.Now().In(cfg.ISTLocation)
			monthDate = now.AddDate(0, -1, 0)
			p.Month = monthDate.Format("2006-01")
			log.Printf("INFO: Scheduled monthly stock job - calculated month: %s", p.Month)
		} else {
			monthDate, _ = time.Parse("2006-01", p.Month)
		}

		log.Printf("INFO: Starting monthly stock job for month: %s", p.Month)

		// Parse month and get boundaries (use UTC since daily_dessert_inventory stores UTC midnight)
		monthStart := time.Date(monthDate.Year(), monthDate.Month(), 1, 0, 0, 0, 0, time.UTC)
		nextMonth := monthStart.AddDate(0, 1, 0)

		// Query daily_dessert_inventory for latest snapshot per dessert in month with quantity > 0
		query := `
			WITH ranked_inventory AS (
				SELECT
					"dessertId",
					day,
					quantity,
					ROW_NUMBER() OVER (PARTITION BY "dessertId" ORDER BY day DESC) AS rn
				FROM daily_dessert_inventory
				WHERE day >= $2
				  AND day < $3
				  AND quantity > 0
			)
			INSERT INTO analytics_monthly_eod_stock (month, dessert_id, snapshot_day, quantity)
			SELECT
				$1 AS month,
				"dessertId",
				day AS snapshot_day,
				quantity
			FROM ranked_inventory
			WHERE rn = 1
			ON CONFLICT (month, dessert_id)
			DO UPDATE SET
				snapshot_day = EXCLUDED.snapshot_day,
				quantity = EXCLUDED.quantity;
		`

		result, err := pool.Exec(ctx, query, p.Month, monthStart, nextMonth)
		if err != nil {
			log.Printf("ERROR: Monthly stock job failed for month %s: %v", p.Month, err)
			return err
		}

		log.Printf("INFO: Monthly stock job completed for month %s (rows affected: %d)", p.Month, result.RowsAffected())
		return nil
	}
}
