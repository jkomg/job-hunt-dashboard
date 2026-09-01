#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
REPO_NAME="${REPO_NAME:-jobhunt-repo}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"
AUTH_MODE="${AUTH_MODE:-session}"
ADMIN_EMAILS="${ADMIN_EMAILS:-kennjason@gmail.com}"
MAX_INSTANCES="${MAX_INSTANCES:-2}"
ENABLE_SHEETS_SYNC="${ENABLE_SHEETS_SYNC:-false}"
ENABLE_GMAIL_IMPORT="${ENABLE_GMAIL_IMPORT:-false}"
ENABLE_BACKUP_EXPORT="${ENABLE_BACKUP_EXPORT:-false}"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_VERSION="${DEPLOY_VERSION:-$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo manual)}"

require_secret() {
  local secret_name="$1"
  if ! gcloud secrets describe "$secret_name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    echo "Missing required Secret Manager secret for enabled feature: ${secret_name}"
    exit 1
  fi
}

gcloud config set project "$PROJECT_ID" >/dev/null

gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com --project "$PROJECT_ID" >/dev/null

if ! gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --project "$PROJECT_ID"
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet >/dev/null

docker build --platform linux/amd64 -t "$IMAGE" "$ROOT_DIR"
docker push "$IMAGE"

SECRET_ARGS=(
  --update-secrets SESSION_SECRET=jobhunt-session-secret:latest
)
REMOVE_ENV_VARS=()
REMOVE_SECRETS=()

if [[ "$ENABLE_SHEETS_SYNC" == "true" ]]; then
  require_secret jobhunt-google-sheets-id
  require_secret jobhunt-google-sheets-tabs
  require_secret jobhunt-google-sheets-creds
  require_secret jobhunt-sheets-sync-cron-token
  SECRET_ARGS+=(
    --update-secrets GOOGLE_SHEETS_ID=jobhunt-google-sheets-id:latest
    --update-secrets GOOGLE_SHEETS_SYNC_TABS=jobhunt-google-sheets-tabs:latest
    --update-secrets GOOGLE_SHEETS_CREDENTIALS_JSON=jobhunt-google-sheets-creds:latest
  )
  if gcloud secrets describe jobhunt-google-sheets-contacts-tabs --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets GOOGLE_SHEETS_CONTACTS_SYNC_TABS=jobhunt-google-sheets-contacts-tabs:latest)
  fi
  if gcloud secrets describe jobhunt-google-sheets-interviews-tabs --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS=jobhunt-google-sheets-interviews-tabs:latest)
  fi
  if gcloud secrets describe jobhunt-google-sheets-events-tabs --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets GOOGLE_SHEETS_EVENTS_SYNC_TABS=jobhunt-google-sheets-events-tabs:latest)
  fi
else
  REMOVE_ENV_VARS+=(GOOGLE_SHEETS_ID GOOGLE_SHEETS_SYNC_TABS GOOGLE_SHEETS_CREDENTIALS_JSON SHEETS_SYNC_CRON_TOKEN)
  REMOVE_SECRETS+=(GOOGLE_SHEETS_ID GOOGLE_SHEETS_SYNC_TABS GOOGLE_SHEETS_CREDENTIALS_JSON GOOGLE_SHEETS_CONTACTS_SYNC_TABS GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS GOOGLE_SHEETS_EVENTS_SYNC_TABS SHEETS_SYNC_CRON_TOKEN)
fi

if gcloud secrets describe jobhunt-database-url --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--update-secrets DATABASE_URL=jobhunt-database-url:latest)
fi
if gcloud secrets describe jobhunt-turso-auth-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--update-secrets TURSO_AUTH_TOKEN=jobhunt-turso-auth-token:latest)
fi
if [[ "$ENABLE_SHEETS_SYNC" == "true" ]] && gcloud secrets describe jobhunt-sheets-sync-cron-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--update-secrets SHEETS_SYNC_CRON_TOKEN=jobhunt-sheets-sync-cron-token:latest)
fi
if [[ "$ENABLE_BACKUP_EXPORT" == "true" ]]; then
  require_secret jobhunt-backup-export-cron-token
  require_secret jobhunt-backup-gcs-bucket
  if gcloud secrets describe jobhunt-backup-export-cron-token --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets BACKUP_EXPORT_CRON_TOKEN=jobhunt-backup-export-cron-token:latest)
  fi
  if gcloud secrets describe jobhunt-backup-gcs-bucket --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets BACKUP_GCS_BUCKET=jobhunt-backup-gcs-bucket:latest)
  fi
  if gcloud secrets describe jobhunt-backup-gcs-prefix --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets BACKUP_GCS_PREFIX=jobhunt-backup-gcs-prefix:latest)
  fi
else
  REMOVE_ENV_VARS+=(BACKUP_EXPORT_CRON_TOKEN BACKUP_GCS_BUCKET BACKUP_GCS_PREFIX)
  REMOVE_SECRETS+=(BACKUP_EXPORT_CRON_TOKEN BACKUP_GCS_BUCKET BACKUP_GCS_PREFIX)
fi
if [[ "$ENABLE_GMAIL_IMPORT" == "true" ]]; then
  require_secret jobhunt-gmail-oauth-client-id
  require_secret jobhunt-gmail-oauth-client-secret
  require_secret jobhunt-gmail-oauth-redirect-uri
  if gcloud secrets describe jobhunt-gmail-oauth-client-id --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets GMAIL_OAUTH_CLIENT_ID=jobhunt-gmail-oauth-client-id:latest)
  fi
  if gcloud secrets describe jobhunt-gmail-oauth-client-secret --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets GMAIL_OAUTH_CLIENT_SECRET=jobhunt-gmail-oauth-client-secret:latest)
  fi
  if gcloud secrets describe jobhunt-gmail-oauth-redirect-uri --project "$PROJECT_ID" >/dev/null 2>&1; then
    SECRET_ARGS+=(--update-secrets GMAIL_OAUTH_REDIRECT_URI=jobhunt-gmail-oauth-redirect-uri:latest)
  fi
else
  REMOVE_ENV_VARS+=(GMAIL_OAUTH_CLIENT_ID GMAIL_OAUTH_CLIENT_SECRET GMAIL_OAUTH_REDIRECT_URI)
  REMOVE_SECRETS+=(GMAIL_OAUTH_CLIENT_ID GMAIL_OAUTH_CLIENT_SECRET GMAIL_OAUTH_REDIRECT_URI)
fi
if gcloud secrets describe jobhunt-agent-api-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--update-secrets AGENT_API_TOKEN=jobhunt-agent-api-token:latest)
fi
if gcloud secrets describe jobhunt-agent-user-id --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--update-secrets AGENT_USER_ID=jobhunt-agent-user-id:latest)
fi
if gcloud secrets describe jobhunt-agent-org-id --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--update-secrets AGENT_ORG_ID=jobhunt-agent-org-id:latest)
fi

if [[ "$AUTH_MODE" == "session" ]]; then
  if ! gcloud secrets describe jobhunt-default-password --project "$PROJECT_ID" >/dev/null 2>&1; then
    echo "Refusing session-mode Cloud Run deploy without jobhunt-default-password secret."
    echo "Set DEFAULT_PASSWORD in .env, run ./setup-secrets.sh, then deploy again."
    exit 1
  fi
  SECRET_ARGS+=(--update-secrets DEFAULT_PASSWORD=jobhunt-default-password:latest)
fi

DEPLOY_OPTIONAL_ARGS=()
if ((${#REMOVE_ENV_VARS[@]})); then
  DEPLOY_OPTIONAL_ARGS+=(--remove-env-vars "$(IFS=,; echo "${REMOVE_ENV_VARS[*]}")")
fi
if ((${#REMOVE_SECRETS[@]})); then
  DEPLOY_OPTIONAL_ARGS+=(--remove-secrets "$(IFS=,; echo "${REMOVE_SECRETS[*]}")")
fi

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "AUTH_MODE=${AUTH_MODE},ADMIN_EMAILS=${ADMIN_EMAILS},DEPLOY_VERSION=${DEPLOY_VERSION},MAX_INSTANCES=${MAX_INSTANCES},ENABLE_SHEETS_SYNC=${ENABLE_SHEETS_SYNC},ENABLE_GMAIL_IMPORT=${ENABLE_GMAIL_IMPORT},ENABLE_BACKUP_EXPORT=${ENABLE_BACKUP_EXPORT},GMAIL_IMPORT_QUERY=newer_than:60d (filename:ics OR subject:(interview OR recruiter OR hiring))" \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances "$MAX_INSTANCES" \
  --concurrency 80 \
  --timeout 120 \
  --cpu-throttling \
  "${DEPLOY_OPTIONAL_ARGS[@]}" \
  "${SECRET_ARGS[@]}"

gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)'

echo
echo "Post-deploy: run the user test checklist in docs/POST_DEPLOY_UAT_CHECKLIST.md"

# ─────────────────────────────────────────────────────────────────────────────
# Deploy-target verification.
#
# Three services in this estate spent weeks deploying into a project that no
# domain pointed at. Each deploy succeeded, so nothing ever failed — the only
# symptom was a public site that quietly stopped changing. amber-wiki did it for
# six days, athens-chronicles-web for a month, heirloom-kitchen shipped a build
# with a broken database that nobody saw because the domain served the old one.
#
# This asks the one question none of those deploys asked: does the domain that
# serves this service actually live in the project we just deployed to?
#
# Deliberately does not take the domain as input — the amber version did, and a
# script that names its own domain can still be wrong about it. This searches
# every project you can see for a mapping pointing at this service name.
# ─────────────────────────────────────────────────────────────────────────────
verify_deploy_target() {
  local project="$1" region="$2" service="$3"
  local token here="" elsewhere=""

  token=$(gcloud auth print-access-token 2>/dev/null) || {
    echo "  (skipped domain check: no gcloud access token)"; return 0; }

  echo ""
  echo "=== Verifying deploy target for $service ==="

  local p hits
  for p in $(gcloud projects list --format='value(projectId)' 2>/dev/null); do
    hits=$(curl -s -m 15 -H "Authorization: Bearer $token" \
      "https://${region}-run.googleapis.com/apis/domains.cloudrun.com/v1/namespaces/${p}/domainmappings" \
      2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit
if 'error' in d:
    raise SystemExit
for i in d.get('items', []):
    if i.get('spec', {}).get('routeName') == '$service':
        print(i['metadata']['name'])
" 2>/dev/null)
    [ -z "$hits" ] && continue
    if [ "$p" = "$project" ]; then
      here="$hits"
    else
      elsewhere="${elsewhere}${elsewhere:+ }${p}=$(echo "$hits" | tr '\n' ',')"
    fi
  done

  if [ -n "$elsewhere" ]; then
    echo "  ERROR: a domain for '$service' is mapped in a DIFFERENT project." >&2
    echo "    deployed to: $project" >&2
    echo "    mapped in:   $elsewhere" >&2
    [ -n "$here" ] && echo "    also mapped here: $(echo "$here" | tr '\n' ' ')" >&2
    echo "  Traffic goes to the mapped project, not this one. Either deploy" >&2
    echo "  there, or move the mapping. This deploy is probably invisible." >&2
    return 1
  fi

  if [ -n "$here" ]; then
    echo "  OK: $(echo "$here" | tr '\n' ' ') -> $service in $project"
  else
    echo "  Note: no custom domain maps to $service in any visible project."
    echo "  Fine for an internal service; wrong if this is meant to be public."
  fi
  return 0
}

verify_deploy_target "${PROJECT_ID}" "${REGION}" "${SERVICE_NAME}"
