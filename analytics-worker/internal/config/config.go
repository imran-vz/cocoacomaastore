package config

import (
	"os"
	"time"
)

type Config struct {
	DatabaseURL string
	RedisAddr   string
	ISTLocation *time.Location
}

func Load() (*Config, error) {
	location, err := time.LoadLocation("Asia/Kolkata")
	if err != nil {
		return nil, err
	}

	return &Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisAddr:   os.Getenv("REDIS_URL"),
		ISTLocation: location,
	}, nil
}

// StartOfDayIST returns 00:00:00 IST for given date (use for querying orders by IST business day)
func (c *Config) StartOfDayIST(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, c.ISTLocation)
}

// EndOfDayIST returns 23:59:59 IST for given date (use for querying orders by IST business day)
func (c *Config) EndOfDayIST(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999999999, c.ISTLocation)
}

// StartOfDayUTC returns 00:00:00 UTC for the IST date (use for storing analytics day column)
func (c *Config) StartOfDayUTC(t time.Time) time.Time {
	// Convert to IST first to get the correct IST date, then return UTC midnight for that date
	istTime := t.In(c.ISTLocation)
	return time.Date(istTime.Year(), istTime.Month(), istTime.Day(), 0, 0, 0, 0, time.UTC)
}
