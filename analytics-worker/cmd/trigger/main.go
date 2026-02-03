package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/hibiken/asynq"
	"github.com/joho/godotenv"

	"cocoacomaa/analytics-worker/internal/config"
	"cocoacomaa/analytics-worker/internal/jobs"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("INFO: No .env file found, using environment variables")
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("FATAL: Failed to load config: %v", err)
	}

	// Create Asynq client
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.RedisAddr})
	defer client.Close()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	jobType := os.Args[1]

	switch jobType {
	case "daily":
		triggerDaily(client, cfg, os.Args[2:])
	case "daily-dessert":
		triggerDailyDessert(client, cfg, os.Args[2:])
	case "daily-eod-stock":
		triggerDailyEodStock(client, cfg, os.Args[2:])
	case "weekly":
		triggerWeekly(client, cfg, os.Args[2:])
	case "monthly-revenue":
		triggerMonthlyRevenue(client, cfg, os.Args[2:])
	case "monthly-dessert-revenue":
		triggerMonthlyDessertRevenue(client, cfg, os.Args[2:])
	default:
		log.Printf("ERROR: Unknown job type: %s", jobType)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage: trigger <job-type> [date]")
	fmt.Println()
	fmt.Println("Job types:")
	fmt.Println("  daily                   - Daily revenue job")
	fmt.Println("  daily-dessert           - Daily per-dessert revenue job")
	fmt.Println("  daily-eod-stock         - Daily end-of-day stock snapshot job")
	fmt.Println("  weekly                  - Weekly revenue job")
	fmt.Println("  monthly-revenue         - Monthly total revenue job")
	fmt.Println("  monthly-dessert-revenue - Monthly per-dessert revenue job")
	fmt.Println()
	fmt.Println("Date formats:")
	fmt.Println("  daily/daily-dessert/daily-eod-stock: YYYY-MM-DD (defaults to yesterday)")
	fmt.Println("  weekly: YYYY-MM-DD (Monday, defaults to last Monday)")
	fmt.Println("  monthly-*: YYYY-MM (defaults to last month)")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  trigger daily 2024-01-15")
	fmt.Println("  trigger daily-dessert 2024-01-15")
	fmt.Println("  trigger daily-eod-stock 2024-01-15")
	fmt.Println("  trigger weekly 2024-01-08")
	fmt.Println("  trigger monthly-revenue 2024-01")
	fmt.Println("  trigger monthly-dessert-revenue 2024-01")
	fmt.Println("  trigger daily  # yesterday")
}

func triggerDaily(client *asynq.Client, cfg *config.Config, args []string) {
	var date time.Time
	var err error

	if len(args) > 0 {
		date, err = time.Parse("2006-01-02", args[0])
		if err != nil {
			log.Fatalf("FATAL: Invalid date format: %v", err)
		}
	} else {
		date = time.Now().In(cfg.ISTLocation).AddDate(0, 0, -1)
	}

	task, err := jobs.NewDailyRevenueTask(date)
	if err != nil {
		log.Fatalf("FATAL: Failed to create task: %v", err)
	}

	info, err := client.Enqueue(task, asynq.Queue("analytics"))
	if err != nil {
		log.Fatalf("FATAL: Failed to enqueue task: %v", err)
	}

	log.Printf("SUCCESS: Enqueued daily revenue job for %s", date.Format("2006-01-02"))
	log.Printf("Task ID: %s, Queue: %s", info.ID, info.Queue)
}

func triggerDailyDessert(client *asynq.Client, cfg *config.Config, args []string) {
	var date time.Time
	var err error

	if len(args) > 0 {
		date, err = time.Parse("2006-01-02", args[0])
		if err != nil {
			log.Fatalf("FATAL: Invalid date format: %v", err)
		}
	} else {
		date = time.Now().In(cfg.ISTLocation).AddDate(0, 0, -1)
	}

	task, err := jobs.NewDailyDessertRevenueTask(date)
	if err != nil {
		log.Fatalf("FATAL: Failed to create task: %v", err)
	}

	info, err := client.Enqueue(task, asynq.Queue("analytics"))
	if err != nil {
		log.Fatalf("FATAL: Failed to enqueue task: %v", err)
	}

	log.Printf("SUCCESS: Enqueued daily dessert revenue job for %s", date.Format("2006-01-02"))
	log.Printf("Task ID: %s, Queue: %s", info.ID, info.Queue)
}

func triggerDailyEodStock(client *asynq.Client, cfg *config.Config, args []string) {
	var date time.Time
	var err error

	if len(args) > 0 {
		date, err = time.Parse("2006-01-02", args[0])
		if err != nil {
			log.Fatalf("FATAL: Invalid date format: %v", err)
		}
	} else {
		date = time.Now().In(cfg.ISTLocation).AddDate(0, 0, -1)
	}

	task, err := jobs.NewDailyEodStockTask(date)
	if err != nil {
		log.Fatalf("FATAL: Failed to create task: %v", err)
	}

	info, err := client.Enqueue(task, asynq.Queue("analytics"))
	if err != nil {
		log.Fatalf("FATAL: Failed to enqueue task: %v", err)
	}

	log.Printf("SUCCESS: Enqueued daily EOD stock job for %s", date.Format("2006-01-02"))
	log.Printf("Task ID: %s, Queue: %s", info.ID, info.Queue)
}

func triggerWeekly(client *asynq.Client, cfg *config.Config, args []string) {
	var date time.Time
	var err error

	if len(args) > 0 {
		date, err = time.Parse("2006-01-02", args[0])
		if err != nil {
			log.Fatalf("FATAL: Invalid date format: %v", err)
		}
		if date.Weekday() != time.Monday {
			log.Fatalf("FATAL: Date must be a Monday")
		}
	} else {
		now := time.Now().In(cfg.ISTLocation)
		date = now.AddDate(0, 0, -7-int(now.Weekday())+1)
	}

	task, err := jobs.NewWeeklyRevenueTask(date)
	if err != nil {
		log.Fatalf("FATAL: Failed to create task: %v", err)
	}

	info, err := client.Enqueue(task, asynq.Queue("analytics"))
	if err != nil {
		log.Fatalf("FATAL: Failed to enqueue task: %v", err)
	}

	log.Printf("SUCCESS: Enqueued weekly revenue job for week starting %s", date.Format("2006-01-02"))
	log.Printf("Task ID: %s, Queue: %s", info.ID, info.Queue)
}

func triggerMonthlyRevenue(client *asynq.Client, cfg *config.Config, args []string) {
	var date time.Time
	var err error

	if len(args) > 0 {
		date, err = time.Parse("2006-01", args[0])
		if err != nil {
			log.Fatalf("FATAL: Invalid month format: %v", err)
		}
	} else {
		date = time.Now().In(cfg.ISTLocation).AddDate(0, -1, 0)
	}

	task, err := jobs.NewMonthlyRevenueTask(date)
	if err != nil {
		log.Fatalf("FATAL: Failed to create task: %v", err)
	}

	info, err := client.Enqueue(task, asynq.Queue("analytics"))
	if err != nil {
		log.Fatalf("FATAL: Failed to enqueue task: %v", err)
	}

	log.Printf("SUCCESS: Enqueued monthly revenue job for month %s", date.Format("2006-01"))
	log.Printf("Task ID: %s, Queue: %s", info.ID, info.Queue)
}

func triggerMonthlyDessertRevenue(client *asynq.Client, cfg *config.Config, args []string) {
	var date time.Time
	var err error

	if len(args) > 0 {
		date, err = time.Parse("2006-01", args[0])
		if err != nil {
			log.Fatalf("FATAL: Invalid month format: %v", err)
		}
	} else {
		date = time.Now().In(cfg.ISTLocation).AddDate(0, -1, 0)
	}

	task, err := jobs.NewMonthlyDessertRevenueTask(date)
	if err != nil {
		log.Fatalf("FATAL: Failed to create task: %v", err)
	}

	info, err := client.Enqueue(task, asynq.Queue("analytics"))
	if err != nil {
		log.Fatalf("FATAL: Failed to enqueue task: %v", err)
	}

	log.Printf("SUCCESS: Enqueued monthly dessert revenue job for month %s", date.Format("2006-01"))
	log.Printf("Task ID: %s, Queue: %s", info.ID, info.Queue)
}
