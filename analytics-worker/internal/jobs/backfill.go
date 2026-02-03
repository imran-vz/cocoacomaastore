package jobs

import (
	"context"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"cocoacomaa/analytics-worker/internal/config"
)

// EnqueueBackfillTasks enqueues analytics jobs for all historical dates
func EnqueueBackfillTasks(
	ctx context.Context,
	pool *pgxpool.Pool,
	client *asynq.Client,
	cfg *config.Config,
) error {
	log.Println("INFO: Starting backfill process...")

	// Find earliest order date
	var earliestDate time.Time
	err := pool.QueryRow(ctx, `
		SELECT MIN("createdAt") FROM orders WHERE "isDeleted" = false
	`).Scan(&earliestDate)
	if err != nil {
		log.Printf("ERROR: Failed to find earliest order: %v", err)
		return err
	}

	// Convert to IST and start of day
	earliestDay := cfg.StartOfDayIST(earliestDate.In(cfg.ISTLocation))
	yesterday := cfg.StartOfDayIST(time.Now().In(cfg.ISTLocation).AddDate(0, 0, -1))

	log.Printf("INFO: Backfilling from %s to %s", earliestDay.Format("2006-01-02"), yesterday.Format("2006-01-02"))

	// Enqueue daily jobs for each day
	dayCount := 0
	for d := earliestDay; !d.After(yesterday); d = d.AddDate(0, 0, 1) {
		task, _ := NewDailyRevenueTask(d)
		if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
			log.Printf("ERROR: Failed to enqueue daily revenue for %s: %v", d.Format("2006-01-02"), err)
			return err
		}

		task, _ = NewDailyDessertRevenueTask(d)
		if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
			log.Printf("ERROR: Failed to enqueue daily dessert revenue for %s: %v", d.Format("2006-01-02"), err)
			return err
		}

		task, _ = NewDailyItemSalesTask(d)
		if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
			log.Printf("ERROR: Failed to enqueue daily item sales for %s: %v", d.Format("2006-01-02"), err)
			return err
		}

		task, _ = NewDailyEodStockTask(d)
		if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
			log.Printf("ERROR: Failed to enqueue daily EOD stock for %s: %v", d.Format("2006-01-02"), err)
			return err
		}

		dayCount++
	}

	log.Printf("INFO: Enqueued %d daily job quads (revenue, dessert revenue, item sales, EOD stock)", dayCount)

	// Enqueue weekly jobs (every Monday)
	weekCount := 0
	for d := earliestDay; !d.After(yesterday); d = d.AddDate(0, 0, 1) {
		if d.Weekday() == time.Monday {
			task, _ := NewWeeklyRevenueTask(d)
			if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
				log.Printf("ERROR: Failed to enqueue weekly revenue for %s: %v", d.Format("2006-01-02"), err)
				return err
			}
			weekCount++
		}
	}

	log.Printf("INFO: Enqueued %d weekly jobs", weekCount)

	// Enqueue monthly jobs (1st of each month from earliest to current)
	monthCount := 0
	currentMonth := earliestDay.Month()
	currentYear := earliestDay.Year()

	for d := earliestDay; !d.After(yesterday); d = d.AddDate(0, 0, 1) {
		if d.Month() != currentMonth {
			// We've entered a new month, process the previous month
			prevMonth := time.Date(currentYear, currentMonth, 1, 0, 0, 0, 0, cfg.ISTLocation)

			// Monthly revenue
			task, _ := NewMonthlyRevenueTask(prevMonth)
			if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
				log.Printf("ERROR: Failed to enqueue monthly revenue for %s: %v", prevMonth.Format("2006-01"), err)
				return err
			}

			// Monthly dessert revenue
			task, _ = NewMonthlyDessertRevenueTask(prevMonth)
			if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
				log.Printf("ERROR: Failed to enqueue monthly dessert revenue for %s: %v", prevMonth.Format("2006-01"), err)
				return err
			}

			monthCount++
			currentMonth = d.Month()
			currentYear = d.Year()
		}
	}

	// Process the last month if we ended in a different month than we started
	if time.Date(currentYear, currentMonth, 1, 0, 0, 0, 0, cfg.ISTLocation).Before(yesterday) {
		lastMonth := time.Date(currentYear, currentMonth, 1, 0, 0, 0, 0, cfg.ISTLocation)

		// Monthly revenue
		task, _ := NewMonthlyRevenueTask(lastMonth)
		if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
			log.Printf("ERROR: Failed to enqueue monthly revenue for %s: %v", lastMonth.Format("2006-01"), err)
			return err
		}

		// Monthly dessert revenue
		task, _ = NewMonthlyDessertRevenueTask(lastMonth)
		if _, err := client.Enqueue(task, asynq.Queue("analytics")); err != nil {
			log.Printf("ERROR: Failed to enqueue monthly dessert revenue for %s: %v", lastMonth.Format("2006-01"), err)
			return err
		}

		monthCount++
	}

	log.Printf("INFO: Enqueued %d monthly job pairs (revenue, dessert revenue)", monthCount)
	log.Printf("INFO: Backfill complete - total tasks: %d daily quads, %d weekly, %d monthly pairs", dayCount, weekCount, monthCount)

	return nil
}
