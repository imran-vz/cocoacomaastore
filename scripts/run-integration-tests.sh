#!/usr/bin/env bash

set -euo pipefail

cleanup_started=0

cleanup() {
	local prior_status=$?

	trap - EXIT INT TERM
	if (( cleanup_started )); then
		exit "$prior_status"
	fi
	cleanup_started=1

	set +e
	pnpm exec tsx scripts/integration-db-lifecycle.ts drop
	local cleanup_status=$?
	set -e

	if (( prior_status != 0 )); then
		exit "$prior_status"
	fi
	exit "$cleanup_status"
}

handle_int() {
	exit 130
}

handle_term() {
	exit 143
}

trap cleanup EXIT
trap handle_int INT
trap handle_term TERM

pnpm exec tsx scripts/integration-db-lifecycle.ts create
pnpm exec drizzle-kit push --config drizzle.integration.config.ts --force
DATABASE_URL="$TEST_DATABASE_URL" pnpm exec vitest run --config vitest.integration.config.ts
