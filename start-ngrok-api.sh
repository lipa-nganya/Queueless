#!/usr/bin/env bash
# Expose the local Queueless API (:4000) on the project's reserved ngrok domain
# so the Android **local** flavor can reach the host from a physical device.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${QUEUELESS_NGROK_DOMAIN:-homiest-psychopharmacologic-anaya.ngrok-free.dev}"
PORT="${QUEUELESS_API_PORT:-4000}"
LOG_DIR="$ROOT/.runtime/logs"
mkdir -p "$LOG_DIR"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed (brew install ngrok)." >&2
  exit 1
fi

if ! curl -sf "http://localhost:${PORT}/health" >/dev/null; then
  echo "Local API is not up on :${PORT}. Run ./start-servers.sh first." >&2
  exit 1
fi

# Stop any existing agent using the inspect port so we can reclaim the domain.
if lsof -iTCP:4040 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Stopping existing ngrok agent on :4040…"
  pkill -f "[n]grok http" 2>/dev/null || true
  sleep 1
fi

echo "Starting ngrok → http://localhost:${PORT} as https://${DOMAIN}"
nohup ngrok http --domain="$DOMAIN" "$PORT" >"$LOG_DIR/ngrok.log" 2>&1 &
sleep 2

if curl -sf "https://${DOMAIN}/health" -H "ngrok-skip-browser-warning: true" >/dev/null; then
  echo "OK  https://${DOMAIN}/api  (Android local: queueless.api.local)"
else
  echo "ngrok started but health check failed — see $LOG_DIR/ngrok.log" >&2
  exit 1
fi
