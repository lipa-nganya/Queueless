#!/usr/bin/env bash
set -euo pipefail

# Deploys the develop tier: the Railway backend plus both Netlify frontends.
# All three build from the develop branch, so this pushes first and then
# triggers each provider explicitly rather than relying on the git webhooks.

ROOT="$(cd "$(dirname "$0")" && pwd)"
BRANCH="develop"

CUSTOMER_SITE_ID="6c7337a3-6a81-4d75-9de2-1dbb3c7ef40a"
CUSTOMER_URL="https://queueless.thewolfgang.tech"
ADMIN_SITE_ID="a63fe2df-41f1-4665-88c2-970c6911cfdb"
ADMIN_URL="https://admin.queueless.thewolfgang.tech"

RAILWAY_PROJECT="94fe5c8a-1aad-45eb-a004-61da6bfd93d6"
RAILWAY_ENV="staging"
RAILWAY_SERVICE="Queueless"
BACKEND_URL="https://queueless-staging.up.railway.app"

SKIP_PUSH=0
WAIT=1

usage() {
  cat <<'USAGE'
Usage: ./deploy-to-development.sh [options]

Deploys the develop tier:
  backend   Railway  (queueless-dev / staging / Queueless)
  customer  Netlify  (queueless-kenya-dev)
  admin     Netlify  (queueless-kenya-admin)

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
for cmd in git netlify railway curl python3; do
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

if ! railway whoami >/dev/null 2>&1; then
  fail "Railway CLI is not logged in — run: railway login"
  exit 1
fi
ok "railway authenticated as $(railway whoami 2>/dev/null | sed 's/Logged in as //; s/ .*//')"

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

step "Triggering Railway backend"
if railway redeploy --service "$RAILWAY_SERVICE" --environment "$RAILWAY_ENV" \
     --project "$RAILWAY_PROJECT" --from-source --yes >/dev/null 2>&1; then
  ok "backend deploy triggered"
else
  fail "could not trigger the Railway deploy"
  exit 1
fi

step "Triggering Netlify sites"
customer_deploy="$(trigger_netlify "$CUSTOMER_SITE_ID")"
[[ -n "$customer_deploy" ]] && ok "customer build queued" || warn "customer build not confirmed"
admin_deploy="$(trigger_netlify "$ADMIN_SITE_ID")"
[[ -n "$admin_deploy" ]] && ok "admin build queued" || warn "admin build not confirmed"

if [[ "$WAIT" -eq 0 ]]; then
  step "Deploys triggered (--no-wait)"
  echo "  backend:  $BACKEND_URL"
  echo "  customer: $CUSTOMER_URL"
  echo "  admin:    $ADMIN_URL"
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
  fail "backend did not become healthy — check: railway logs"
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
wait_for_netlify "customer" "$CUSTOMER_SITE_ID" "$customer_deploy" "$CUSTOMER_URL" || status=1
wait_for_netlify "admin" "$ADMIN_SITE_ID" "$admin_deploy" "$ADMIN_URL" || status=1

step "Summary"
if [[ "$status" -eq 0 ]]; then
  echo "  Deployed $deploy_sha to development."
else
  echo "  Deployment finished with errors."
fi
echo "  backend:  $BACKEND_URL"
echo "  customer: $CUSTOMER_URL"
echo "  admin:    $ADMIN_URL"
exit "$status"
