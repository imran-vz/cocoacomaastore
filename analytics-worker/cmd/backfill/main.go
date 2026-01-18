package main

import (
	"context"
	"log"
	"os"

	"github.com/hibiken/asynq"
	"github.com/joho/godotenv"

	"cocoacomaa/analytics-worker/internal/config"
	"cocoacomaa/analytics-worker/internal/db"
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

	log.Println("INFO: Starting backfill process...")

	// Connect to database
	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("FATAL: Failed to connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("INFO: Database connection established")

	// Create Asynq client
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.RedisAddr})
	defer client.Close()

	// Check if forced backfill
	force := len(os.Args) > 1 && os.Args[1] == "--force"

	if !force {
		// Check if analytics tables already have data
		var count int
		err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM analytics_daily_revenue").Scan(&count)
		if err != nil {
			log.Fatalf("FATAL: Failed to check analytics tables: %v", err)
		}

		if count > 0 {
			log.Printf("INFO: Analytics tables already populated (%d records found)", count)
			log.Println("INFO: Use --force flag to re-backfill anyway")
			return
		}
	}

	// Run backfill
	if err := jobs.EnqueueBackfillTasks(ctx, pool, client, cfg); err != nil {
		log.Fatalf("FATAL: Backfill failed: %v", err)
	}

	log.Println("INFO: Backfill tasks enqueued successfully")
	log.Println("INFO: Monitor progress at http://localhost:8080 (Asynqmon)")
}
