#!/usr/bin/env bash

# Clone the Supabase public schema into the local Postgres instance.
#
# Required:
#   SUPABASE_DATABASE_URL or REMOTE_DATABASE_URL
#
# Optional:
#   LOCAL_DATABASE_URL or DATABASE_URL
#   local URL defaults to postgresql://postgres:password@localhost:5432/postgres
#
# Usage:
#   pnpm db:clone:supabase
#   SUPABASE_DATABASE_URL='postgresql://...' pnpm db:clone:supabase
#   ./scripts/clone-supabase-db.sh '<supabase-url>' '<local-url>'

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_LOCAL_URL="postgresql://postgres:password@localhost:5432/postgres"

env_file_value() {
	local name="$1"
	local file="$ROOT_DIR/.env"
	local value

	[[ -f "$file" ]] || return 0

	value="$(grep -E "^${name}=" "$file" | tail -n 1 | cut -d= -f2-)"
	value="${value%\"}"
	value="${value#\"}"
	value="${value%\'}"
	value="${value#\'}"
	printf "%s" "$value"
}

REMOTE_URL="${1:-${SUPABASE_DATABASE_URL:-${REMOTE_DATABASE_URL:-$(env_file_value SUPABASE_DATABASE_URL)}}}"
if [[ -z "$REMOTE_URL" ]]; then
	REMOTE_URL="$(env_file_value REMOTE_DATABASE_URL)"
fi

LOCAL_URL="${2:-${LOCAL_DATABASE_URL:-${DATABASE_URL:-$(env_file_value LOCAL_DATABASE_URL)}}}"
if [[ -z "$LOCAL_URL" ]]; then
	LOCAL_URL="$(env_file_value DATABASE_URL)"
fi
LOCAL_URL="${LOCAL_URL:-$DEFAULT_LOCAL_URL}"
DUMP_FILE="$(mktemp "${TMPDIR:-/tmp}/cocoacomaa-supabase.XXXXXX.dump")"

cleanup() {
	rm -f "$DUMP_FILE"
}
trap cleanup EXIT

die() {
	echo "Error: $*" >&2
	exit 1
}

mask_url() {
	local url="$1"
	printf "%s\n" "$url" | sed -E 's#(postgres(ql)?://[^:/@]+):[^@]+@#\1:***@#'
}

require_command() {
	command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found in PATH"
}

is_local_postgres_url() {
	[[ "$1" =~ ://([^/@]+@)?(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?/ ]]
}

require_command pg_dump
require_command pg_restore
require_command psql

[[ -n "$REMOTE_URL" ]] || die "Set SUPABASE_DATABASE_URL or pass the Supabase database URL as the first argument"
[[ -n "$LOCAL_URL" ]] || die "Set LOCAL_DATABASE_URL or pass the local database URL as the second argument"

if [[ "$REMOTE_URL" == "$LOCAL_URL" ]]; then
	die "Remote and local database URLs are identical"
fi

if ! is_local_postgres_url "$LOCAL_URL"; then
	die "Refusing to overwrite a non-local database: $(mask_url "$LOCAL_URL")"
fi

echo "Remote: $(mask_url "$REMOTE_URL")"
echo "Local:  $(mask_url "$LOCAL_URL")"
echo
echo "This will drop and recreate the local public schema."
read -r -p "Continue? Type 'clone' to proceed: " CONFIRM
[[ "$CONFIRM" == "clone" ]] || die "Aborted"

echo "Dumping Supabase public schema..."
pg_dump "$REMOTE_URL" \
	--format=custom \
	--verbose \
	--no-owner \
	--no-privileges \
	--schema=public \
	--file="$DUMP_FILE"

echo "Resetting local public schema..."
psql "$LOCAL_URL" \
	--set=ON_ERROR_STOP=1 \
	--command='DROP SCHEMA IF EXISTS public CASCADE;' \
	--command='CREATE SCHEMA public;' \
	--command='GRANT ALL ON SCHEMA public TO public;'

echo "Restoring into local Postgres..."
pg_restore \
	--dbname="$LOCAL_URL" \
	--no-owner \
	--no-privileges \
	--schema=public \
	--exit-on-error \
	--verbose \
	"$DUMP_FILE"

echo "Local database clone complete."
    