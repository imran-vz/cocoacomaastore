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

const TypeWeeklyRevenue = "analytics:weekly_revenue"

type WeeklyRevenuePayload struct {
	WeekStart string // YYYY-MM-DD (Monday), empty string means "calculate previous week"
}

// NewWeeklyRevenueTask creates a task for a specific week (used for backfill)
func NewWeeklyRevenueTask(monday time.Time) (*asynq.Task, error) {
	payload, err := json.Marshal(WeeklyRevenuePayload{
		WeekStart: monday.Format("2006-01-02"),
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeWeeklyRevenue, payload), nil
}

// NewScheduledWeeklyRevenueTask creates a task that will calculate previous week at execution time
func NewScheduledWeeklyRevenueTask() (*asynq.Task, error) {
	payload, err := json.Marshal(WeeklyRevenuePayload{
		WeekStart: "", // Empty means calculate previous week at execution time
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeWeeklyRevenue, payload), nil
}

func HandleWeeklyRevenue(pool *pgxpool.Pool, cfg *config.Config) asynq.HandlerFunc {
	return func(ctx context.Context, t *asynq.Task) error {
		var p WeeklyRevenuePayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			log.Printf("ERROR: Failed to unmarshal weekly revenue payload: %v", err)
			return err
		}

		// Calculate week start: if empty, calculate previous week's Monday
		var weekStart time.Time
		if p.WeekStart == "" {
			now := time.Now().In(cfg.ISTLocation)
			// Go back 7 days to get into the previous week
			previousWeek := now.AddDate(0, 0, -7)
			// Find Monday of that week
			for previousWeek.Weekday() != time.Monday {
				previousWeek = previousWeek.AddDate(0, 0, -1)
			}
			weekStart = previousWeek
			p.WeekStart = weekStart.Format("2006-01-02")
			log.Printf("INFO: Scheduled weekly revenue job - calculated week start: %s", p.WeekStart)
		} else {
			weekStart, _ = time.Parse("2006-01-02", p.WeekStart)
		}

		log.Printf("INFO: Starting weekly revenue job for week starting: %s", p.WeekStart)

		weekEnd := weekStart.AddDate(0, 0, 6) // Sunday
		// Use UTC midnight for the week_start/week_end columns (for consistent querying)
		weekStartUTC := cfg.StartOfDayUTC(weekStart)
		weekEndUTC := cfg.StartOfDayUTC(weekEnd)

		// Aggregate from analytics_daily_revenue table
		query := `
			INSERT INTO analytics_weekly_revenue (week_start, week_end, gross_revenue, order_count)
			SELECT
				$1::timestamp AS week_start,
				$2::timestamp AS week_end,
				COALESCE(SUM(gross_revenue), 0) AS gross_revenue,
				COALESCE(SUM(order_count), 0) AS order_count
			FROM analytics_daily_revenue
			WHERE day >= $1
			  AND day <= $2
			ON CONFLICT (week_start)
			DO UPDATE SET
				week_end = EXCLUDED.week_end,
				gross_revenue = EXCLUDED.gross_revenue,
				order_count = EXCLUDED.order_count;
		`

		result, err := pool.Exec(ctx, query, weekStartUTC, weekEndUTC)
		if err != nil {
			log.Printf("ERROR: Weekly revenue job failed for week %s: %v", p.WeekStart, err)
			return err
		}

		log.Printf("INFO: Weekly revenue job completed for week %s (rows affected: %d)", p.WeekStart, result.RowsAffected())
		return nil
	}
}
