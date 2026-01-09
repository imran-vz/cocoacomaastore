#!/bin/bash

# Sync remote PostgreSQL database to local
# Usage: ./scripts/sync-db.sh [REMOTE_DB_URL] [LOCAL_DB_URL]

set -e

REMOTE_URL="${1:-$REMOTE_DATABASE_URL}"
LOCAL_URL="${2:-$DATABASE_URL}"

if [ -z "$REMOTE_URL" ] || [ -z "$LOCAL_URL" ]; then
  echo "Error: Database URLs required"
  echo "Usage: REMOTE_DATABASE_URL=<url> ./scripts/sync-db.sh"
  echo "Or: ./scripts/sync-db.sh <remote-url> <local-url>"
  exit 1
fi

DUMP_FILE="/tmp/pg_dump_$(date +%s).sql"

echo "🔄 Syncing remote DB to local..."
echo "Remote: ${REMOTE_URL%%\?*}" # Hide query params
echo "Local: ${LOCAL_URL%%\?*}"
echo ""

read -p "⚠️  This will REPLACE local data. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted"
  exit 0
fi

echo "📦 Dumping remote database..."
pg_dump "$REMOTE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --schema=public \
  --exclude-schema=extensions \
  --exclude-schema=graphql \
  --exclude-schema=graphql_public \
  --exclude-schema=realtime \
  --exclude-schema=storage \
  --exclude-schema=supabase_functions \
  --exclude-schema=vault \
  --exclude-schema=auth \
  -f "$DUMP_FILE"

echo "📥 Restoring to local database..."
psql "$LOCAL_URL" -f "$DUMP_FILE" -v ON_ERROR_STOP=0 2>&1 | grep -v "does not exist" | grep -v "unrecognized configuration" | grep -v "wal_level" || true

echo "🧹 Cleaning up..."
rm "$DUMP_FILE"

echo "✅ Sync complete"
