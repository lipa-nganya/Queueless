#!/usr/bin/env bash
# Build the production release bundle and upload it to Google Play.
#
# Usage:
#   ./scripts/publish-android.sh <customer|vendor|all> [track] [extra Gradle args…]
#
# Examples:
#   ./scripts/publish-android.sh customer                 # internal testing track
#   ./scripts/publish-android.sh all production
#   ./scripts/publish-android.sh vendor beta --release-status draft
#
# Tracks: internal (default), alpha (closed), beta (open), production.
# Needs keystore.properties in each app folder with the upload key and playServiceAccountJson
# (see android-customer/README.md, "Release to Google Play").
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

APP="${1:-}"
TRACK="${2:-internal}"
shift $(( $# >= 2 ? 2 : $# ))

case "$APP" in
  customer) APPS=(android-customer) ;;
  vendor) APPS=(android-vendor) ;;
  all) APPS=(android-customer android-vendor) ;;
  *)
    sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

case "$TRACK" in
  internal | alpha | beta | production) ;;
  *) echo "Unknown track '$TRACK'. Use internal, alpha, beta or production." >&2; exit 1 ;;
esac

if [[ -z "${JAVA_HOME:-}" && -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi

prop() { grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- || true; }

# Check every app before uploading any, so "all" never stops halfway on a config problem.
for dir in "${APPS[@]}"; do
  props="$ROOT/$dir/keystore.properties"
  if [[ ! -f "$props" ]]; then
    echo "Missing $dir/keystore.properties (copy keystore.properties.example)." >&2; exit 1
  fi
  store="$(prop "$props" storeFile)"
  creds="$(prop "$props" playServiceAccountJson)"
  [[ "$store" = /* ]] || store="$ROOT/$dir/$store"
  [[ "$creds" = /* ]] || creds="$ROOT/$dir/$creds"
  if [[ -z "$(prop "$props" storeFile)" || ! -f "$store" ]]; then
    echo "$dir: upload keystore not found ($store)." >&2; exit 1
  fi
  if [[ -z "$(prop "$props" playServiceAccountJson)" || ! -f "$creds" ]]; then
    echo "$dir: Play service account JSON not found. Set playServiceAccountJson in keystore.properties." >&2
    exit 1
  fi
done

if [[ "$TRACK" == "production" ]]; then
  read -r -p "Publish ${APPS[*]} to PRODUCTION? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 1; }
fi

for dir in "${APPS[@]}"; do
  echo "==> $dir: building and uploading to the $TRACK track"
  (cd "$ROOT/$dir" && ./gradlew :app:publishProductionReleaseBundle --track "$TRACK" "$@")
done

echo "Done. Check the release in Play Console: https://play.google.com/console"
