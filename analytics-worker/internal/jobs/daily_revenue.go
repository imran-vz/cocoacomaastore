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

const TypeDailyRevenue = "analytics:daily_revenue"

type DailyRevenuePayload struct {
	Date string // YYYY-MM-DD, empty string means "calculate yesterday"
}

// NewDailyRevenueTask creates a task for a specific date (used for backfill)
func NewDailyRevenueTask(date time.Time) (*asynq.Task, error) {
	payload, err := json.Marshal(DailyRevenuePayload{
		Date: date.Format("2006-01-02"),
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailyRevenue, payload), nil
}

// NewScheduledDailyRevenueTask creates a task that will calculate yesterday at execution time
func NewScheduledDailyRevenueTask() (*asynq.Task, error) {
	payload, err := json.Marshal(DailyRevenuePayload{
		Date: "", // Empty means calculate yesterday at execution time
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailyRevenue, payload), nil
}

func HandleDailyRevenue(pool *pgxpool.Pool, cfg *config.Config) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		var p DailyRevenuePayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("ERROR: Failed to unmarshal daily revenue payload: %v", err)
			return err
		}

		// Calculate date: if empty, use yesterday in IST
		var date time.Time
		if p.Date == "" {
			date = time.Now().In(cfg.ISTLocation).AddDate(0, 0, -1)
			p.Date = date.Format("2006-01-02")
			log.Printf("INFO: Scheduled daily revenue job - calculated date: %s", p.Date)
		} else {
			date, _ = time.Parse("2006-01-02", p.Date)
		}

		log.Printf("INFO: Starting daily revenue job for date: %s", p.Date)

		// Use UTC midnight for the day column (for consistent querying)
		dayUTC := cfg.StartOfDayUTC(date)
		// Use IST range for querying orders (business day in IST)
		dayStartIST := cfg.StartOfDayIST(date)
		dayEndIST := cfg.EndOfDayIST(date)

		// Query orders table for completed, non-deleted orders
		query := `
			INSERT INTO analytics_daily_revenue (day, gross_revenue, order_count)
			SELECT
				$1::timestamp AS day,
				COALESCE(SUM(total), 0) AS gross_revenue,
				COUNT(*) AS order_count
			FROM orders
			WHERE status = 'completed'
			  AND "isDeleted" = false
			  AND "createdAt" >= $2
			  AND "createdAt" < $3
			ON CONFLICT (day)
			DO UPDATE SET
				gross_revenue = EXCLUDED.gross_revenue,
				order_count = EXCLUDED.order_count;
		`

		result, err := pool.Exec(ctx, query, dayUTC, dayStartIST, dayEndIST)
		if err != nil {
			log.Printf("ERROR: Daily revenue job failed for date %s: %v", p.Date, err)
			return err
		}

		log.Printf("INFO: Daily revenue job completed for date %s (rows affected: %d)", p.Date, result.RowsAffected())
		return nil
	}
}
