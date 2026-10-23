#!/usr/bin/env bash
# Start a throwaway local copy with an empty database, run the end-to-end checks, then stop it.
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT="${PORT:-8791}"
STATE="$(mktemp -d)"
npx wrangler@4 pages dev public --d1 DB=hirebridge-e2e --port "$PORT" --persist-to "$STATE" \
  --compatibility-date 2026-09-01 \
  --binding DEV_USER_EMAIL=hr@vbridgeit.com --binding ALLOWED_EMAILS=hr@vbridgeit.com --binding ALLOW_SAMPLE_DATA=1 \
  > "$STATE/wrangler.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; rm -rf "$STATE"' EXIT
for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://localhost:$PORT/employees" && break
  sleep 1
done
BASE_URL="http://localhost:$PORT" python3 tests/e2e/test_app.py
