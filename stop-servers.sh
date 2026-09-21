#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$ROOT/.runtime"
PID_FILE="$RUNTIME_DIR/servers.pid"

stop_pid() {
  local pid="${1:-}"
  if [[ -z "$pid" ]]; then
    return 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 0.2
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "Stopped PID $pid"
  fi
}

echo "Stopping Node servers (landing :8080, customer :3000, vendor :3500, API :4000)..."
if [[ -f "$PID_FILE" ]]; then
  while read -r pid; do
    stop_pid "$pid"
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

# Fallback: free the app ports even if PID file is missing/stale
for port in 8080 3000 3500 4000; do
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids:-}" ]]; then
      echo "$pids" | while read -r pid; do
        stop_pid "$pid"
      done
      echo "Freed port $port"
    fi
  fi
done

if pgrep -f "[n]grok http" >/dev/null 2>&1; then
  echo "Stopping ngrok..."
  pkill -f "[n]grok http" 2>/dev/null || true
fi

echo "Stopping Postgres + pgAdmin..."
(
  cd "$ROOT"
  docker compose stop
)

echo "Servers stopped."
