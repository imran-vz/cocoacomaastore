package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/hibiken/asynq"

	"cocoacomaa/analytics-worker/internal/jobs"
)

type RecomputeDayRequest struct {
	Date string `json:"date"` // YYYY-MM-DD
}

type RecomputeDayResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func RecomputeDayHandler(client *asynq.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req RecomputeDayRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			log.Printf("ERROR: Failed to decode recompute request: %v", err)
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		date, err := time.Parse("2006-01-02", req.Date)
		if err != nil {
			log.Printf("ERROR: Invalid date format: %s", req.Date)
			http.Error(w, "Invalid date format (expected YYYY-MM-DD)", http.StatusBadRequest)
			return
		}

		log.Printf("INFO: Recompute day request received for date: %s", req.Date)

		// Enqueue all daily jobs for this date
		tasks := []struct {
			task *asynq.Task
			name string
		}{
			{task: mustCreateTask(jobs.NewDailyRevenueTask(date)), name: "daily_revenue"},
			{task: mustCreateTask(jobs.NewDailyDessertRevenueTask(date)), name: "daily_dessert_revenue"},
			{task: mustCreateTask(jobs.NewDailyItemSalesTask(date)), name: "daily_item_sales"},
		}

		for _, t := range tasks {
			if _, err := client.Enqueue(t.task, asynq.Queue("analytics")); err != nil {
				log.Printf("ERROR: Failed to enqueue %s task: %v", t.name, err)
				http.Error(w, "Failed to enqueue analytics tasks", http.StatusInternalServerError)
				return
			}
			log.Printf("INFO: Enqueued %s task for date: %s", t.name, req.Date)
		}

		resp := RecomputeDayResponse{
			Success: true,
			Message: "Analytics recomputation tasks enqueued successfully",
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(resp)
	}
}

func mustCreateTask(task *asynq.Task, err error) *asynq.Task {
	if err != nil {
		panic(err)
	}
	return task
}
