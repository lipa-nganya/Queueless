#!/usr/bin/env bash
# Wire Firebase Cloud Messaging for the Queueless vendor Android app + API.
#
# Prerequisites (run in your own terminal first):
#   firebase login
#   # Sign in as queuelesskenya@gmail.com when the browser opens
#
# Then:
#   ./scripts/setup-firebase-push.sh
#   # optional: FIREBASE_PROJECT_ID=my-id ./scripts/setup-firebase-push.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${PATH}:$(npm prefix -g 2>/dev/null)/bin:${HOME}/.nvm/versions/node/v22.20.0/bin"

if ! command -v firebase >/dev/null 2>&1; then
  echo "Installing firebase-tools…"
  npm install -g firebase-tools
fi

echo "Firebase CLI: $(command -v firebase)"
firebase login:list

if ! firebase projects:list >/tmp/queueless-firebase-projects.txt 2>/tmp/queueless-firebase-projects.err; then
  echo ""
  echo "Firebase auth is missing or expired. In this terminal run:"
  echo "  firebase login"
  echo "Sign in as queuelesskenya@gmail.com, then re-run this script."
  cat /tmp/queueless-firebase-projects.err >&2 || true
  exit 1
fi

PROJECT_ID="${FIREBASE_PROJECT_ID:-}"
if [[ -z "$PROJECT_ID" ]]; then
  # Prefer an existing project that looks like Queueless (JSON is more reliable than table parse).
  PROJECT_ID="$(
    firebase projects:list --json 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except Exception:
    sys.exit(0)
result = data.get("result") or data
projects = result if isinstance(result, list) else (result.get("projects") or [])
for p in projects:
    pid = p.get("projectId") or p.get("project_id") or ""
    name = (p.get("displayName") or p.get("display_name") or "").lower()
    if "queueless" in pid.lower() or "queueless" in name:
        print(pid)
        break
'
  )"
fi

if [[ -z "$PROJECT_ID" ]]; then
  # Fallback: table parse
  PROJECT_ID="$(
    awk -F'│' '
      /Project ID/ { next }
      /─/ { next }
      NF >= 2 {
        id=$2
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", id)
        if (id ~ /queueless/) { print id; exit }
      }
    ' /tmp/queueless-firebase-projects.txt
  )"
fi

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="queueless-kenya"
  echo "No Queueless Firebase project found — creating ${PROJECT_ID}…"
  firebase projects:create "$PROJECT_ID" --display-name "Queueless Kenya" || {
    echo "Could not create ${PROJECT_ID}. Set FIREBASE_PROJECT_ID to an existing project and retry."
    exit 1
  }
else
  echo "Using Firebase project: ${PROJECT_ID}"
fi

# firebase use requires a project directory — write these first.
cat > "$ROOT/.firebaserc" <<EOF
{
  "projects": {
    "default": "${PROJECT_ID}"
  }
}
EOF
[[ -f "$ROOT/firebase.json" ]] || printf '%s\n' '{}' > "$ROOT/firebase.json"

firebase use "$PROJECT_ID" >/dev/null
echo "Active project: ${PROJECT_ID}"

PACKAGES=(
  "tech.thewolfgang.queueless.vendor"
  "tech.thewolfgang.queueless.vendor.local"
  "tech.thewolfgang.queueless.vendor.dev"
)
DISPLAY_NAMES=(
  "Queueless Vendor"
  "Queueless Vendor (Local)"
  "Queueless Vendor (Dev)"
)

echo "Ensuring Android apps exist…"
EXISTING="$(firebase apps:list ANDROID --project "$PROJECT_ID" 2>/dev/null || true)"
for i in "${!PACKAGES[@]}"; do
  pkg="${PACKAGES[$i]}"
  name="${DISPLAY_NAMES[$i]}"
  if echo "$EXISTING" | grep -Fq "$pkg"; then
    echo "  ✓ $pkg"
  else
    echo "  + creating $pkg"
    firebase apps:create ANDROID "$name" \
      --package-name "$pkg" \
      --project "$PROJECT_ID"
  fi
done

echo "Ensuring Web app exists…"
WEB_EXISTING="$(firebase apps:list WEB --project "$PROJECT_ID" 2>/dev/null || true)"
WEB_APP_ID=""
if echo "$WEB_EXISTING" | grep -Fq "Queueless Vendor Web"; then
  echo "  ✓ Queueless Vendor Web"
else
  echo "  + creating Queueless Vendor Web"
  firebase apps:create WEB "Queueless Vendor Web" --project "$PROJECT_ID"
fi
WEB_APP_ID="$(
  firebase apps:list WEB --project "$PROJECT_ID" --json 2>/dev/null | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except Exception:
    sys.exit(0)
result = data.get("result") or data
apps = result if isinstance(result, list) else (result.get("apps") or [])
for app in apps:
    name = (app.get("displayName") or app.get("display_name") or "")
    app_id = app.get("appId") or app.get("app_id") or ""
    if "Vendor Web" in name and app_id:
        print(app_id)
        break
'
)"
if [[ -n "$WEB_APP_ID" ]]; then
  echo "  Web App ID: $WEB_APP_ID"
  WEB_CFG_JSON="$(firebase apps:sdkconfig WEB "$WEB_APP_ID" --project "$PROJECT_ID" 2>/dev/null || true)"
  python3 - "$ROOT/backend/.env" "$WEB_CFG_JSON" "$ROOT/backend/secrets/firebase-adminsdk.json" <<'PY'
import json, sys
from pathlib import Path
env_path = Path(sys.argv[1])
raw = sys.argv[2] or ""
sa_path = Path(sys.argv[3]).resolve()
start = raw.find("{")
if start < 0:
    sys.exit(0)
cfg = json.loads(raw[start:])
updates = {
    "FIREBASE_WEB_API_KEY": cfg.get("apiKey"),
    "FIREBASE_WEB_AUTH_DOMAIN": cfg.get("authDomain") or f"{cfg.get('projectId')}.firebaseapp.com",
    "FIREBASE_WEB_PROJECT_ID": cfg.get("projectId"),
    "FIREBASE_WEB_STORAGE_BUCKET": cfg.get("storageBucket"),
    "FIREBASE_WEB_MESSAGING_SENDER_ID": str(cfg.get("messagingSenderId") or cfg.get("projectNumber") or ""),
    "FIREBASE_WEB_APP_ID": cfg.get("appId"),
    "FIREBASE_SERVICE_ACCOUNT_PATH": str(sa_path),
    "GOOGLE_APPLICATION_CREDENTIALS": str(sa_path),
}
text = env_path.read_text() if env_path.exists() else ""
lines = text.splitlines()
out, seen = [], set()
for line in lines:
    matched = None
    for key in updates:
        if line.startswith(f"{key}=") or line.startswith(f"# {key}="):
            matched = key
            break
    if matched:
        if matched not in seen and updates.get(matched):
            out.append(f"{matched}={updates[matched]}")
            seen.add(matched)
        continue
    out.append(line)
for key, value in updates.items():
    if key not in seen and value:
        out.append(f"{key}={value}")
if not any(l.startswith("FIREBASE_WEB_VAPID_KEY=") and l.split("=",1)[1].strip() for l in out):
    out = [l for l in out if "FIREBASE_WEB_VAPID_KEY" not in l]
    out.append("# FIREBASE_WEB_VAPID_KEY=  # Console → Project settings → Cloud Messaging → Web Push certificates")
env_path.write_text("\n".join(out) + "\n")
print(f"Updated {env_path} with Firebase web client config")
PY
fi

# Rebuild list after creates and merge google-services.json for all packages
export FIREBASE_PROJECT_ID="$PROJECT_ID"
APPS_JSON="$(firebase apps:list ANDROID --project "$PROJECT_ID" --json 2>/dev/null || echo '{}')"
python3 - "$APPS_JSON" "$ROOT/android-vendor/app/google-services.json" "$PROJECT_ID" <<'PY'
import json, sys, subprocess, os

apps_payload = json.loads(sys.argv[1] or "{}")
out_path = sys.argv[2]
project_id = sys.argv[3]
result = apps_payload.get("result") or apps_payload
apps = result if isinstance(result, list) else (result.get("apps") or [])

wanted = {
    "tech.thewolfgang.queueless.vendor",
    "tech.thewolfgang.queueless.vendor.local",
    "tech.thewolfgang.queueless.vendor.dev",
}

matched = []
for app in apps:
    pkg = app.get("packageName") or app.get("package_name") or ""
    app_id = app.get("appId") or app.get("app_id") or ""
    if pkg in wanted and app_id:
        matched.append((pkg, app_id))

if not matched:
    print("Could not resolve Android app IDs from firebase apps:list --json.", file=sys.stderr)
    print("Download google-services.json from Firebase Console → Project settings → Your apps,", file=sys.stderr)
    print(f"and save it to {out_path}", file=sys.stderr)
    sys.exit(2)

merged = None
for pkg, app_id in matched:
    raw = subprocess.check_output(
        [
            "firebase",
            "apps:sdkconfig",
            "ANDROID",
            app_id,
            "--project",
            project_id,
        ],
        text=True,
    )
    start = raw.find("{")
    if start < 0:
        raise SystemExit(f"No JSON in sdkconfig for {pkg}")
    cfg = json.loads(raw[start:])
    if merged is None:
        merged = cfg
    else:
        clients = merged.setdefault("client", [])
        existing = {
            (c.get("client_info") or {}).get("android_client_info", {}).get("package_name")
            for c in clients
        }
        for client in cfg.get("client") or []:
            pkg_name = (
                (client.get("client_info") or {})
                .get("android_client_info", {})
                .get("package_name")
            )
            if pkg_name not in existing:
                clients.append(client)

os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w") as f:
    json.dump(merged, f, indent=2)
    f.write("\n")
print(f"Wrote {out_path} ({len(matched)} Android client(s))")
PY

# Service account for backend FCM (Admin SDK) — use Firebase CLI OAuth
# (gcloud may be logged into a different Google account).
SECRETS_DIR="$ROOT/backend/secrets"
mkdir -p "$SECRETS_DIR"
SA_KEY="$SECRETS_DIR/firebase-adminsdk.json"

if [[ -f "$SA_KEY" ]]; then
  echo "Service account key already present: $SA_KEY"
else
  echo "Creating Admin SDK key via Firebase login…"
  python3 - "$PROJECT_ID" "$SA_KEY" <<'PY'
import base64, json, sys, urllib.error, urllib.request
from pathlib import Path

project, out_path = sys.argv[1], Path(sys.argv[2])
cfg = json.loads((Path.home() / ".config/configstore/firebase-tools.json").read_text())
access = (cfg.get("tokens") or {}).get("access_token")
if not access:
    raise SystemExit("No Firebase access token — run: firebase login")

def api(method, url, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {access}")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url} -> {e.code}: {e.read().decode()[:500]}")

listed = api("GET", f"https://iam.googleapis.com/v1/projects/{project}/serviceAccounts")
accounts = listed.get("accounts") or []
sa = next((a for a in accounts if "firebase-adminsdk" in a.get("email", "")), None)
if sa is None:
    sa = api(
        "POST",
        f"https://iam.googleapis.com/v1/projects/{project}/serviceAccounts",
        {
            "accountId": "queueless-fcm",
            "serviceAccount": {"displayName": "Queueless FCM"},
        },
    )
sa_email = sa["email"]
print(f"Using service account: {sa_email}")
key = api(
    "POST",
    f"https://iam.googleapis.com/v1/projects/{project}/serviceAccounts/{sa_email}/keys",
    {
        "privateKeyType": "TYPE_GOOGLE_CREDENTIALS_FILE",
        "keyAlgorithm": "KEY_ALG_RSA_2048",
    },
)
out_path.write_bytes(base64.b64decode(key["privateKeyData"]))
print(f"Wrote {out_path}")
PY
fi

ENV_FILE="$ROOT/backend/.env"
if [[ -f "$SA_KEY" ]]; then
  # Upsert FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env
  python3 - "$ENV_FILE" "$SA_KEY" <<'PY'
import pathlib, sys
env_path = pathlib.Path(sys.argv[1])
sa_path = pathlib.Path(sys.argv[2]).resolve()
text = env_path.read_text() if env_path.exists() else ""
lines = text.splitlines()
key = "FIREBASE_SERVICE_ACCOUNT_PATH"
out = []
seen = False
for line in lines:
    if line.startswith(f"{key}=") or line.startswith(f"# {key}="):
        if not seen:
            out.append(f"{key}={sa_path}")
            seen = True
        continue
    out.append(line)
if not seen:
    if out and out[-1] != "":
        out.append("")
    out.append("# Firebase Cloud Messaging (vendor push)")
    out.append(f"{key}={sa_path}")
    out.append("VENDOR_PUSH_SMS_FALLBACK=0")
env_path.write_text("\n".join(out) + "\n")
print(f"Updated {env_path} → {key}")
PY
fi

# Record active project for the repo
cat > "$ROOT/.firebaserc" <<EOF
{
  "projects": {
    "default": "${PROJECT_ID}"
  }
}
EOF

echo ""
echo "Done."
echo "  Project:            ${PROJECT_ID}"
echo "  google-services.json: android-vendor/app/google-services.json"
echo "  Admin SDK key:      ${SA_KEY} (gitignored)"
echo ""
echo "Web push (vendor browser):"
echo "  1. Firebase Console → Project settings → Add app → Web"
echo "  2. Cloud Messaging → Web Push certificates → Generate key pair (VAPID)"
echo "  3. Set on the API (backend/.env) and optionally vendor server:"
echo "       FIREBASE_WEB_API_KEY=..."
echo "       FIREBASE_WEB_AUTH_DOMAIN=${PROJECT_ID}.firebaseapp.com"
echo "       FIREBASE_WEB_PROJECT_ID=${PROJECT_ID}"
echo "       FIREBASE_WEB_MESSAGING_SENDER_ID=..."
echo "       FIREBASE_WEB_APP_ID=..."
echo "       FIREBASE_WEB_VAPID_KEY=..."
echo "     Or one JSON blob: FIREBASE_WEB_CONFIG_JSON={...}"
echo ""
echo "Next:"
echo "  1. Restart API: ./stop-servers.sh && ./start-servers.sh"
echo "  2. Rebuild Android localDebug (Google Services plugin will apply)."
echo "  3. Open the vendor app → set PIN / sign in (registers FCM token)."
echo "  4. Open vendor web → allow notifications after sign-in."
