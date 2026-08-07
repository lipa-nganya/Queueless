#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/servers.pid"
LOG_DIR="$RUNTIME_DIR/logs"

ADMIN_URL="http://localhost:4000/"
CUSTOMER_URL="http://localhost:3000/"

# Open URL in Google Chrome, or reload the existing tab if already open.
open_or_refresh_chrome() {
  local url="$1"
  # Prefix match so trailing slash / query / hash variants still count as the same tab
  local prefix="${url%/}"

  if ! osascript \
    -e "tell application \"Google Chrome\"" \
    -e "  activate" \
    -e "  set targetPrefix to \"$prefix\"" \
    -e "  set targetURL to \"$url\"" \
    -e "  set foundTab to false" \
    -e "  repeat with w in every window" \
    -e "    set i to 0" \
    -e "    repeat with t in tabs of w" \
    -e "      set i to i + 1" \
    -e "      set tabURL to URL of t" \
    -e "      if tabURL starts with targetPrefix then" \
    -e "        set active tab index of w to i" \
    -e "        set index of w to 1" \
    -e "        reload t" \
    -e "        set foundTab to true" \
    -e "        exit repeat" \
    -e "      end if" \
    -e "    end repeat" \
    -e "    if foundTab then exit repeat" \
    -e "  end repeat" \
    -e "  if not foundTab then" \
    -e "    if (count of windows) = 0 then" \
    -e "      make new window" \
    -e "      set URL of active tab of front window to targetURL" \
    -e "    else" \
    -e "      tell front window to make new tab with properties {URL:targetURL}" \
    -e "    end if" \
    -e "  end if" \
    -e "end tell" >/dev/null 2>&1; then
    open -a "Google Chrome" "$url" 2>/dev/null || open "$url"
  fi
}

open_frontends() {
  echo "Opening frontends in Google Chrome..."
  open_or_refresh_chrome "$ADMIN_URL"
  open_or_refresh_chrome "$CUSTOMER_URL"
}

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  # Clean stale PID file if processes are already gone
  alive=0
  while read -r pid; do
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      alive=1
      break
    fi
  done < "$PID_FILE"
  if [[ "$alive" -eq 1 ]]; then
    echo "Servers already appear to be running."
    echo "  Admin:    $ADMIN_URL"
    echo "  Customer: $CUSTOMER_URL"
    open_frontends
    exit 0
  fi
  rm -f "$PID_FILE"
fi

echo "Starting Postgres + pgAdmin..."
(
  cd "$ROOT"
  docker compose up -d
)

echo "Waiting for database..."
for _ in $(seq 1 30); do
  if docker exec queueless-db pg_isready -U queueless -d queueless >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [[ ! -d "$ROOT/backend/node_modules" ]]; then
  echo "Installing backend dependencies..."
  (cd "$ROOT/backend" && npm install)
fi

if [[ ! -d "$ROOT/customer/node_modules" ]]; then
  echo "Installing customer dependencies..."
  (cd "$ROOT/customer" && npm install)
fi

: > "$PID_FILE"

echo "Starting admin + API on :4000..."
(
  cd "$ROOT/backend"
  nohup node src/index.js >"$LOG_DIR/backend.log" 2>&1 &
  echo $! >> "$PID_FILE"
)

echo "Starting customer app on :3000..."
(
  cd "$ROOT/customer"
  nohup node server.js >"$LOG_DIR/customer.log" 2>&1 &
  echo $! >> "$PID_FILE"
)

# Wait briefly for HTTP readiness
for _ in $(seq 1 20); do
  if curl -sf "http://localhost:4000/health" >/dev/null \
    && curl -sf "http://localhost:3000/" >/dev/null; then
    break
  fi
  sleep 0.5
done

echo
echo "Servers started."
echo "  Admin:    $ADMIN_URL"
echo "  Customer: $CUSTOMER_URL"
echo "  pgAdmin:  http://localhost:5050/"
echo "Logs: $LOG_DIR/"
open_frontends
