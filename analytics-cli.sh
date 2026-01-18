#!/bin/bash

# Analytics Worker CLI - Helper script for manual operations
# Usage: ./analytics-cli.sh [command] [args...]

set -e

COMPOSE_FILE="docker-compose.analytics.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    exit 1
}

info() {
    echo -e "${GREEN}INFO: $1${NC}"
}

warn() {
    echo -e "${YELLOW}WARN: $1${NC}"
}

usage() {
    cat <<EOF
Analytics Worker CLI

Usage: ./analytics-cli.sh [command] [args...]

Commands:
  start              Start analytics services (redis, worker, asynqmon)
  stop               Stop all analytics services
  restart            Restart analytics services
  logs               View worker logs (use -f to follow)
  status             Show status of all services

  backfill           Run full backfill (all historical data)
  backfill --force   Force re-backfill even if data exists

  trigger <type> [date]
                     Manually trigger a specific job
                     Types: daily, daily-dessert, weekly, monthly

  monitor            Open Asynqmon dashboard in browser

Examples:
  ./analytics-cli.sh start
  ./analytics-cli.sh backfill
  ./analytics-cli.sh trigger daily 2024-01-15
  ./analytics-cli.sh trigger weekly 2024-01-08
  ./analytics-cli.sh trigger monthly 2024-01
  ./analytics-cli.sh logs -f

EOF
}

load_env() {
    # Load DATABASE_URL from .env if it exists and not already set
    if [ -f .env ] && [ -z "$DATABASE_URL" ]; then
        export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
    fi
}

check_docker() {
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "docker-compose not found. Please install Docker Compose."
    fi
}

# Transform DATABASE_URL for Docker container use (localhost -> host.docker.internal)
transform_database_url() {
    if [ -n "$DATABASE_URL" ]; then
        # Replace localhost with host.docker.internal for Docker containers
        export DATABASE_URL="${DATABASE_URL//localhost/host.docker.internal}"
        export DATABASE_URL="${DATABASE_URL//127.0.0.1/host.docker.internal}"
    fi
}

# Use docker compose or docker-compose depending on what's available
docker_compose() {
    # Transform DATABASE_URL for container use
    transform_database_url

    if docker compose version &> /dev/null 2>&1; then
        docker compose -f "$COMPOSE_FILE" "$@"
    else
        docker-compose -f "$COMPOSE_FILE" "$@"
    fi
}

cmd_start() {
    info "Starting analytics services..."
    docker_compose up -d
    info "Services started successfully"
    info "Asynqmon dashboard: http://localhost:8080"
}

cmd_stop() {
    info "Stopping analytics services..."
    docker_compose down
    info "Services stopped"
}

cmd_restart() {
    info "Restarting analytics services..."
    docker_compose restart
    info "Services restarted"
}

cmd_logs() {
    docker_compose logs "$@" analytics-worker
}

cmd_status() {
    docker_compose ps
}

cmd_backfill() {
    info "Building backfill tool..."
    docker_compose build backfill

    info "Running backfill..."
    if [ "$1" = "--force" ]; then
        docker_compose run --rm backfill ./backfill --force
    else
        docker_compose run --rm backfill ./backfill
    fi

    info "Backfill complete. Monitor progress at http://localhost:8080"
}

cmd_trigger() {
    if [ -z "$1" ]; then
        error "Missing job type. Use: daily, daily-dessert, weekly, or monthly"
    fi

    info "Building trigger tool..."
    docker_compose build trigger

    info "Triggering $* job..."
    docker_compose run --rm trigger "$@"

    info "Job enqueued. Monitor progress at http://localhost:8080"
}

cmd_monitor() {
    info "Opening Asynqmon dashboard..."
    if command -v open &> /dev/null; then
        open http://localhost:8080
    elif command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:8080
    else
        info "Please open http://localhost:8080 in your browser"
    fi
}

# Main
load_env
check_docker

if [ $# -eq 0 ]; then
    usage
    exit 0
fi

case "$1" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        shift
        cmd_logs "$@"
        ;;
    status)
        cmd_status
        ;;
    backfill)
        shift
        cmd_backfill "$@"
        ;;
    trigger)
        shift
        cmd_trigger "$@"
        ;;
    monitor)
        cmd_monitor
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        error "Unknown command: $1\nRun './analytics-cli.sh help' for usage"
        ;;
esac
