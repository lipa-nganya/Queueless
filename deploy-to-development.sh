#!/usr/bin/env bash
set -euo pipefail

# Deploys the develop tier: the Cloud Run backend plus all Netlify frontends.
# Everything builds from the develop branch, so this pushes first, builds the
# API image from the pushed commit, and triggers each Netlify site explicitly.

ROOT="$(cd "$(dirname "$0")" && pwd)"
BRANCH="develop"

CUSTOMER_SITE_ID="6c7337a3-6a81-4d75-9de2-1dbb3c7ef40a"
CUSTOMER_URL="https://queueless.thewolfgang.tech"
CUSTOMER_APP_SITE_ID="78f0bec0-0f42-4192-adf6-3c2167733713"
CUSTOMER_APP_URL="https://customer.thewolfgang.tech/"
ADMIN_SITE_ID="a63fe2df-41f1-4665-88c2-970c6911cfdb"
ADMIN_URL="https://admin.queueless.thewolfgang.tech"
VENDOR_SITE_ID="aaf89a4e-ef96-4d45-bbbc-d6493bcc4ea5"
VENDOR_URL="https://vendor.queueless.thewolfgang.tech"

# Google Cloud: project queueless-develop (owned by the wolfgangtech6 account).
GCP_ACCOUNT="${GCP_ACCOUNT:-wolfgangtech6@gmail.com}"
GCP_PROJECT="queueless-develop"
GCP_REGION="africa-south1"
RUN_SERVICE="queueless-api"
IMAGE_REPO="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/queueless/api"
BACKEND_URL="https://queueless-api-958382779776.africa-south1.run.app"

SKIP_PUSH=0
WAIT=1

usage() {
  cat <<'USAGE'
Usage: ./deploy-to-development.sh [options]

Deploys the develop tier:
  backend      Cloud Run (queueless-develop / africa-south1 / queueless-api)
  landing      Netlify  (queueless-kenya-dev)
  customer app Netlify  (queueless-kenya-customer)
  admin        Netlify  (queueless-kenya-admin)
  vendor       Netlify  (queueless-kenya-vendor)

Options:
  --skip-push   Redeploy the current remote commit without pushing
  --no-wait     Trigger the deploys and exit without polling
  -h, --help    Show this message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-push) SKIP_PUSH=1 ;;
    --no-wait) WAIT=0 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
  shift
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32mok\033[0m   %s\n' "$1"; }
warn() { printf '  \033[33mwarn\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mfail\033[0m %s\n' "$1"; }

step "Checking prerequisites"
for cmd in git netlify gcloud curl python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "$cmd is not installed"
    exit 1
  fi
done
ok "required commands available"

if ! netlify status >/dev/null 2>&1; then
  fail "Netlify CLI is not logged in — run: netlify login"
  exit 1
fi
ok "netlify authenticated"

if ! gcloud auth print-access-token --account="$GCP_ACCOUNT" >/dev/null 2>&1; then
  fail "gcloud has no credentials for $GCP_ACCOUNT — run: gcloud auth login $GCP_ACCOUNT"
  exit 1
fi
ok "gcloud authenticated for project $GCP_PROJECT"

step "Checking repository state"
cd "$ROOT"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  fail "on branch '$current_branch', expected '$BRANCH'"
  exit 1
fi
ok "on branch $BRANCH"

if [[ -n "$(git status --porcelain)" ]]; then
  warn "uncommitted changes will NOT be deployed:"
  git status --short | sed 's/^/         /'
fi

if [[ "$SKIP_PUSH" -eq 0 ]]; then
  git fetch --quiet origin "$BRANCH"
  ahead="$(git rev-list --count "origin/$BRANCH..$BRANCH")"
  if [[ "$ahead" -gt 0 ]]; then
    echo "  pushing $ahead commit(s) to origin/$BRANCH..."
    git push origin "$BRANCH"
    ok "pushed"
  else
    ok "origin/$BRANCH already up to date"
  fi
else
  ok "skipping push (--skip-push)"
fi

deploy_sha="$(git rev-parse --short "origin/$BRANCH")"
echo "  deploying commit $deploy_sha"

# Ask Netlify to build a site and echo the resulting deploy id.
trigger_netlify() {
  local site_id="$1"
  netlify api createSiteBuild --data "{\"site_id\":\"$site_id\",\"body\":{}}" 2>/dev/null \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("deploy_id",""))' 2>/dev/null || true
}

# Netlify reports "ready" once a deploy is published; "error" once it has failed.
netlify_deploy_state() {
  local site_id="$1" deploy_id="$2"
  netlify api getDeploy --data "{\"deploy_id\":\"$deploy_id\"}" 2>/dev/null \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("state",""))' 2>/dev/null || true
}

step "Building and deploying the Cloud Run backend"
# Build from the pushed commit, not the working tree, so the API matches the frontends.
build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT
git archive "origin/$BRANCH" backend | tar -x -C "$build_dir"
image="$IMAGE_REPO:$deploy_sha"
if gcloud builds submit "$build_dir/backend" --tag "$image" --region "$GCP_REGION" \
     --project "$GCP_PROJECT" --account "$GCP_ACCOUNT" --quiet >/dev/null 2>&1; then
  ok "image built: $image"
else
  fail "Cloud Build failed — check: gcloud builds list --project $GCP_PROJECT"
  exit 1
fi
# Env vars, secrets, Cloud SQL and the uploads bucket stay as configured on the service.
if gcloud run deploy "$RUN_SERVICE" --image "$image" --region "$GCP_REGION" \
     --project "$GCP_PROJECT" --account "$GCP_ACCOUNT" --quiet >/dev/null 2>&1; then
  ok "backend deployed to Cloud Run"
else
  fail "could not deploy to Cloud Run"
  exit 1
fi

step "Triggering Netlify sites"
landing_deploy="$(trigger_netlify "$CUSTOMER_SITE_ID")"
[[ -n "$landing_deploy" ]] && ok "landing build queued" || warn "landing build not confirmed"
customer_deploy="$(trigger_netlify "$CUSTOMER_APP_SITE_ID")"
[[ -n "$customer_deploy" ]] && ok "customer app build queued" || warn "customer app build not confirmed"
admin_deploy="$(trigger_netlify "$ADMIN_SITE_ID")"
[[ -n "$admin_deploy" ]] && ok "admin build queued" || warn "admin build not confirmed"
vendor_deploy="$(trigger_netlify "$VENDOR_SITE_ID")"
[[ -n "$vendor_deploy" ]] && ok "vendor build queued" || warn "vendor build not confirmed"

if [[ "$WAIT" -eq 0 ]]; then
  step "Deploys triggered (--no-wait)"
  echo "  backend:  $BACKEND_URL"
  echo "  landing:  $CUSTOMER_URL"
  echo "  customer: $CUSTOMER_APP_URL"
  echo "  admin:    $ADMIN_URL"
  echo "  vendor:   $VENDOR_URL"
  exit 0
fi

status=0

step "Waiting for the backend"
backend_ready=0
for _ in $(seq 1 40); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BACKEND_URL/health" || true)"
  if [[ "$code" == "200" ]]; then
    backend_ready=1
    break
  fi
  sleep 10
done
if [[ "$backend_ready" -eq 1 ]]; then
  ok "backend healthy at $BACKEND_URL"
else
  fail "backend did not become healthy — check: gcloud run services logs read $RUN_SERVICE --region $GCP_REGION --project $GCP_PROJECT"
  status=1
fi

wait_for_netlify() {
  local label="$1" site_id="$2" deploy_id="$3" url="$4"
  if [[ -z "$deploy_id" ]]; then
    warn "$label: no deploy id, checking the URL only"
  else
    for _ in $(seq 1 40); do
      local state
      state="$(netlify_deploy_state "$site_id" "$deploy_id")"
      case "$state" in
        ready) ok "$label deploy published"; break ;;
        error) fail "$label deploy failed"; return 1 ;;
      esac
      sleep 10
    done
  fi

  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)"
  if [[ "$code" == "200" ]]; then
    ok "$label live at $url"
  else
    fail "$label returned HTTP $code"
    return 1
  fi
}

step "Waiting for the frontends"
wait_for_netlify "landing" "$CUSTOMER_SITE_ID" "$landing_deploy" "$CUSTOMER_URL" || status=1
wait_for_netlify "customer" "$CUSTOMER_APP_SITE_ID" "$customer_deploy" "$CUSTOMER_APP_URL" || status=1
wait_for_netlify "admin" "$ADMIN_SITE_ID" "$admin_deploy" "$ADMIN_URL" || status=1
wait_for_netlify "vendor" "$VENDOR_SITE_ID" "$vendor_deploy" "$VENDOR_URL" || status=1

step "Summary"
if [[ "$status" -eq 0 ]]; then
  echo "  Deployed $deploy_sha to development."
else
  echo "  Deployment finished with errors."
fi
echo "  backend:  $BACKEND_URL"
echo "  landing:  $CUSTOMER_URL"
echo "  customer: $CUSTOMER_APP_URL"
echo "  admin:    $ADMIN_URL"
echo "  vendor:   $VENDOR_URL"
exit "$status"
