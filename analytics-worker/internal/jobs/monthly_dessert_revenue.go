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

const TypeMonthlyDessertRevenue = "analytics:monthly_dessert_revenue"

type MonthlyDessertRevenuePayload struct {
	Month string // YYYY-MM, empty string means "calculate previous month"
}

// NewMonthlyDessertRevenueTask creates a task for a specific month (used for backfill)
func NewMonthlyDessertRevenueTask(date time.Time) (*asynq.Task, error) {
	payload, err := json.Marshal(MonthlyDessertRevenuePayload{
		Month: date.Format("2006-01"),
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeMonthlyDessertRevenue, payload), nil
}

// NewScheduledMonthlyDessertRevenueTask creates a task that will calculate previous month at execution time
func NewScheduledMonthlyDessertRevenueTask() (*asynq.Task, error) {
	payload, err := json.Marshal(MonthlyDessertRevenuePayload{
		Month: "", // Empty means calculate previous month at execution time
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeMonthlyDessertRevenue, payload), nil
}

func HandleMonthlyDessertRevenue(pool *pgxpool.Pool, cfg *config.Config) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		var p MonthlyDessertRevenuePayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("ERROR: Failed to unmarshal monthly dessert revenue payload: %v", err)
			return err
		}

		// Calculate month: if empty, use previous month
		var monthDate time.Time
		if p.Month == "" {
			now := time.Now().In(cfg.ISTLocation)
			monthDate = now.AddDate(0, -1, 0)
			p.Month = monthDate.Format("2006-01")
			log.Printf("INFO: Scheduled monthly dessert revenue job - calculated month: %s", p.Month)
		} else {
			monthDate, _ = time.Parse("2006-01", p.Month)
		}

		log.Printf("INFO: Starting monthly dessert revenue job for month: %s", p.Month)

		// Parse month and get boundaries (UTC since analytics_daily_dessert_revenue stores UTC midnight)
		monthStart := time.Date(monthDate.Year(), monthDate.Month(), 1, 0, 0, 0, 0, time.UTC)
		nextMonth := monthStart.AddDate(0, 1, 0)

		// Aggregate from analytics_daily_dessert_revenue table (already excludes combos)
		query := `
			INSERT INTO analytics_monthly_dessert_revenue (month, dessert_id, gross_revenue, quantity_sold, order_count)
			SELECT
				$1 AS month,
				dessert_id,
				COALESCE(SUM(gross_revenue), 0) AS gross_revenue,
				COALESCE(SUM(quantity_sold), 0) AS quantity_sold,
				COALESCE(SUM(order_count), 0) AS order_count
			FROM analytics_daily_dessert_revenue
			WHERE day >= $2
			  AND day < $3
			GROUP BY dessert_id
			ON CONFLICT (month, dessert_id)
			DO UPDATE SET
				gross_revenue = EXCLUDED.gross_revenue,
				quantity_sold = EXCLUDED.quantity_sold,
				order_count = EXCLUDED.order_count;
		`

		result, err := pool.Exec(ctx, query, p.Month, monthStart, nextMonth)
		if err != nil {
			log.Printf("ERROR: Monthly dessert revenue job failed for month %s: %v", p.Month, err)
			return err
		}

		log.Printf("INFO: Monthly dessert revenue job completed for month %s (rows affected: %d)", p.Month, result.RowsAffected())
		return nil
	}
}
