package scheduler

import (
	"log"

	"github.com/hibiken/asynq"

	"cocoacomaa/analytics-worker/internal/config"
	"cocoacomaa/analytics-worker/internal/jobs"
)

func SetupScheduler(cfg *config.Config, redisAddr string) (*asynq.Scheduler, error) {
	location := cfg.ISTLocation
	scheduler := asynq.NewScheduler(
		asynq.RedisClientOpt{Addr: redisAddr},
		&asynq.SchedulerOpts{Location: location},
	)

	// Daily revenue job - run at 1:00 AM IST for previous day
	// Task is created with empty date; handler will calculate yesterday
	dailyRevenueTask, err := jobs.NewScheduledDailyRevenueTask()
	if err != nil {
		return nil, err
	}
	_, err = scheduler.Register("0 1 * * *", dailyRevenueTask, asynq.Queue("analytics"))
	if err != nil {
		return nil, err
	}

	// Per-dessert daily revenue - run at 1:00 AM IST for previous day
	dailyDessertRevenueTask, err := jobs.NewScheduledDailyDessertRevenueTask()
	if err != nil {
		return nil, err
	}
	_, err = scheduler.Register("0 1 * * *", dailyDessertRevenueTask, asynq.Queue("analytics"))
	if err != nil {
		return nil, err
	}

	// Daily item sales - run at 1:00 AM IST for previous day
	dailyItemSalesTask, err := jobs.NewScheduledDailyItemSalesTask()
	if err != nil {
		return nil, err
	}
	_, err = scheduler.Register("0 1 * * *", dailyItemSalesTask, asynq.Queue("analytics"))
	if err != nil {
		return nil, err
	}

	// Daily EOD stock - run at 1:00 AM IST for previous day
	dailyEodStockTask, err := jobs.NewScheduledDailyEodStockTask()
	if err != nil {
		return nil, err
	}
	_, err = scheduler.Register("0 1 * * *", dailyEodStockTask, asynq.Queue("analytics"))
	if err != nil {
		return nil, err
	}

	// Weekly revenue - run at 1:00 AM IST every Monday for previous week (Mon-Sun)
	weeklyRevenueTask, err := jobs.NewScheduledWeeklyRevenueTask()
	if err != nil {
		return nil, err
	}
	_, err = scheduler.Register("0 1 * * 1", weeklyRevenueTask, asynq.Queue("analytics"))
	if err != nil {
		return nil, err
	}

	// Monthly revenue - run at 1:00 AM IST on 1st of month for previous month
	monthlyRevenueTask, err := jobs.NewScheduledMonthlyRevenueTask()
	if err != nil {
		return nil, err
	}
	_, err = scheduler.Register("0 1 1 * *", monthlyRevenueTask, asynq.Queue("analytics"))
	if err != nil {
		return nil, err
	}

	// Monthly dessert revenue - run at 1:00 AM IST on 1st of month for previous month
	monthlyDessertRevenueTask, err := jobs.NewScheduledMonthlyDessertRevenueTask()
	if err != nil {
		return nil, err
	}
	_, err = scheduler.Register("0 1 1 * *", monthlyDessertRevenueTask, asynq.Queue("analytics"))
	if err != nil {
		return nil, err
	}

	log.Println("INFO: Scheduler setup complete with IST timezone")
	log.Println("INFO: Daily jobs (revenue, dessert revenue, item sales, EOD stock) run at 01:00 IST")
	log.Println("INFO: Weekly job runs at 01:00 IST every Monday for previous week")
	log.Println("INFO: Monthly jobs (revenue, dessert revenue) run at 01:00 IST on 1st of month")

	return scheduler, nil
}
