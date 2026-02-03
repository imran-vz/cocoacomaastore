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

const TypeMonthlyRevenue = "analytics:monthly_revenue"

type MonthlyRevenuePayload struct {
	Month string // YYYY-MM, empty string means "calculate previous month"
}

// NewMonthlyRevenueTask creates a task for a specific month (used for backfill)
func NewMonthlyRevenueTask(date time.Time) (*asynq.Task, error) {
	payload, err := json.Marshal(MonthlyRevenuePayload{
		Month: date.Format("2006-01"),
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeMonthlyRevenue, payload), nil
}

// NewScheduledMonthlyRevenueTask creates a task that will calculate previous month at execution time
func NewScheduledMonthlyRevenueTask() (*asynq.Task, error) {
	payload, err := json.Marshal(MonthlyRevenuePayload{
		Month: "", // Empty means calculate previous month at execution time
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeMonthlyRevenue, payload), nil
}

func HandleMonthlyRevenue(pool *pgxpool.Pool, cfg *config.Config) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		var p MonthlyRevenuePayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("ERROR: Failed to unmarshal monthly revenue payload: %v", err)
			return err
		}

		// Calculate month: if empty, use previous month
		var monthDate time.Time
		if p.Month == "" {
			now := time.Now().In(cfg.ISTLocation)
			monthDate = now.AddDate(0, -1, 0)
			p.Month = monthDate.Format("2006-01")
			log.Printf("INFO: Scheduled monthly revenue job - calculated month: %s", p.Month)
		} else {
			monthDate, _ = time.Parse("2006-01", p.Month)
		}

		log.Printf("INFO: Starting monthly revenue job for month: %s", p.Month)

		// Parse month and get boundaries (UTC since analytics_daily_revenue stores UTC midnight)
		monthStart := time.Date(monthDate.Year(), monthDate.Month(), 1, 0, 0, 0, 0, time.UTC)
		nextMonth := monthStart.AddDate(0, 1, 0)

		// Aggregate from analytics_daily_revenue table
		query := `
			INSERT INTO analytics_monthly_revenue (month, gross_revenue, order_count)
			SELECT
				$1 AS month,
				COALESCE(SUM(gross_revenue), 0) AS gross_revenue,
				COALESCE(SUM(order_count), 0) AS order_count
			FROM analytics_daily_revenue
			WHERE day >= $2
			  AND day < $3
			ON CONFLICT (month)
			DO UPDATE SET
				gross_revenue = EXCLUDED.gross_revenue,
				order_count = EXCLUDED.order_count;
		`

		result, err := pool.Exec(ctx, query, p.Month, monthStart, nextMonth)
		if err != nil {
			log.Printf("ERROR: Monthly revenue job failed for month %s: %v", p.Month, err)
			return err
		}

		log.Printf("INFO: Monthly revenue job completed for month %s (rows affected: %d)", p.Month, result.RowsAffected())
		return nil
	}
}
