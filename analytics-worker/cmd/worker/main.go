package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/hibiken/asynq"
	"github.com/joho/godotenv"

	"cocoacomaa/analytics-worker/internal/api"
	"cocoacomaa/analytics-worker/internal/config"
	"cocoacomaa/analytics-worker/internal/db"
	"cocoacomaa/analytics-worker/internal/jobs"
	"cocoacomaa/analytics-worker/internal/scheduler"
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

	log.Println("INFO: Starting analytics worker...")

	// Connect to database
	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("FATAL: Failed to connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("INFO: Database connection established")

	// Create Asynq client for backfill check
	client := asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.RedisAddr})
	defer client.Close()

	// Check if backfill needed (analytics tables empty)
	var count int
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM analytics_daily_revenue").Scan(&count)
	if err != nil {
		log.Fatalf("FATAL: Failed to check analytics tables: %v", err)
	}

	if count == 0 {
		log.Println("INFO: Analytics tables empty, enqueueing backfill tasks...")
		if err := jobs.EnqueueBackfillTasks(ctx, pool, client, cfg); err != nil {
			log.Printf("WARNING: Backfill failed: %v", err)
		} else {
			log.Println("INFO: Backfill tasks enqueued successfully")
		}
	} else {
		log.Printf("INFO: Analytics tables already populated (%d records found), skipping backfill", count)
	}

	// Start Asynq scheduler
	sched, err := scheduler.SetupScheduler(cfg, cfg.RedisAddr)
	if err != nil {
		log.Fatalf("FATAL: Failed to setup scheduler: %v", err)
	}

	if err := sched.Start(); err != nil {
		log.Fatalf("FATAL: Failed to start scheduler: %v", err)
	}
	defer sched.Shutdown()
	log.Println("INFO: Scheduler started")

	// Start Asynq worker
	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: cfg.RedisAddr},
		asynq.Config{
			Concurrency: 5,
			Queues: map[string]int{
				"analytics": 5,
			},
		},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(jobs.TypeDailyRevenue, jobs.HandleDailyRevenue(pool, cfg))
	mux.HandleFunc(jobs.TypeDailyDessertRevenue, jobs.HandleDailyDessertRevenue(pool, cfg))
	mux.HandleFunc(jobs.TypeDailyItemSales, jobs.HandleDailyItemSales(pool, cfg))
	mux.HandleFunc(jobs.TypeDailyEodStock, jobs.HandleDailyEodStock(pool, cfg))
	mux.HandleFunc(jobs.TypeWeeklyRevenue, jobs.HandleWeeklyRevenue(pool, cfg))
	mux.HandleFunc(jobs.TypeMonthlyRevenue, jobs.HandleMonthlyRevenue(pool, cfg))
	mux.HandleFunc(jobs.TypeMonthlyDessertRevenue, jobs.HandleMonthlyDessertRevenue(pool, cfg))

	go func() {
		log.Println("INFO: Worker started, processing tasks...")
		if err := srv.Start(mux); err != nil {
			log.Fatalf("FATAL: Failed to start worker: %v", err)
		}
	}()

	// Start HTTP server for REST API
	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/api/recompute-day", api.RecomputeDayHandler(client))

	httpServer := &http.Server{
		Addr:    ":8081",
		Handler: httpMux,
	}

	go func() {
		log.Println("INFO: HTTP server started on :8081")
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("ERROR: HTTP server failed: %v", err)
		}
	}()

	// Graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	log.Println("INFO: Shutting down services...")

	// Shutdown HTTP server
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("ERROR: HTTP server shutdown failed: %v", err)
	}

	// Shutdown worker
	srv.Shutdown()
	log.Println("INFO: Shutdown complete")
}
