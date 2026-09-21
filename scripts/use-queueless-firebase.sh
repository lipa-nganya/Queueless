#!/usr/bin/env bash
# Point local Firebase / gcloud CLIs at the Queueless Kenya Firebase project.
#
# Usage (bash or zsh):
#   source ./scripts/use-queueless-firebase.sh
#
# Or run directly:
#   ./scripts/use-queueless-firebase.sh

# Avoid nounset: this file is often `source`d from zsh where BASH_SOURCE is unset.
set -eo pipefail

_QUEULESS_SRC="${BASH_SOURCE[0]:-}"
if [[ -z "$_QUEULESS_SRC" || "$_QUEULESS_SRC" == "$0" ]]; then
  _QUEULESS_SRC="$0"
fi
# When sourced from zsh, $0 is the shell name — resolve via this file path hint.
if [[ ! -f "$_QUEULESS_SRC" ]]; then
  _QUEULESS_SRC="./scripts/use-queueless-firebase.sh"
fi
ROOT="$(cd "$(dirname "$_QUEULESS_SRC")/.." && pwd)"
unset _QUEULESS_SRC

PROJECT_ID="${FIREBASE_PROJECT_ID:-queueless-kenya}"
SA_KEY="${FIREBASE_SERVICE_ACCOUNT_PATH:-$ROOT/backend/secrets/firebase-adminsdk.json}"
RUNTIME="$ROOT/.runtime"

export PATH="${PATH}:$(npm prefix -g 2>/dev/null)/bin:${HOME}/.nvm/versions/node/v22.20.0/bin"
export FIREBASE_PROJECT_ID="$PROJECT_ID"
export GCLOUD_PROJECT="$PROJECT_ID"
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
export CLOUDSDK_CONFIG="${CLOUDSDK_CONFIG:-$RUNTIME/gcloud}"
export FIREBASE_CLI_LOG_FILE="${FIREBASE_CLI_LOG_FILE:-$RUNTIME/firebase-debug.log}"

mkdir -p "$CLOUDSDK_CONFIG" "$RUNTIME"
touch "$FIREBASE_CLI_LOG_FILE" 2>/dev/null || true
touch "$ROOT/firebase-debug.log" 2>/dev/null || true

if [[ -f "$SA_KEY" ]]; then
  export GOOGLE_APPLICATION_CREDENTIALS="$SA_KEY"
  export FIREBASE_SERVICE_ACCOUNT_PATH="$SA_KEY"
else
  echo "Missing service account key: $SA_KEY" >&2
  echo "Run ./scripts/setup-firebase-push.sh first." >&2
fi

if command -v firebase >/dev/null 2>&1; then
  (
    cd "$ROOT"
    firebase use "$PROJECT_ID" >/dev/null 2>&1 || true
  )
  echo "firebase → project $PROJECT_ID ($(firebase --version 2>/dev/null | head -1))"
  firebase login:list 2>/dev/null | head -5 || true
else
  echo "firebase CLI not installed. npm i -g firebase-tools" >&2
fi

if command -v gcloud >/dev/null 2>&1; then
  gcloud config set project "$PROJECT_ID" >/dev/null 2>&1 || true
  if [[ -f "$SA_KEY" ]]; then
    SA_EMAIL="$(python3 -c "import json;print(json.load(open(r'''$SA_KEY'''))['client_email'])")"
    gcloud auth activate-service-account --key-file="$SA_KEY" >/dev/null 2>&1 || true
    gcloud config set account "$SA_EMAIL" >/dev/null 2>&1 || true
    echo "gcloud → $SA_EMAIL / project $PROJECT_ID"
  fi
fi

echo "Exported:"
echo "  FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID"
echo "  CLOUDSDK_CONFIG=$CLOUDSDK_CONFIG"
echo "  GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-}"
echo "  FIREBASE_CLI_LOG_FILE=$FIREBASE_CLI_LOG_FILE"
