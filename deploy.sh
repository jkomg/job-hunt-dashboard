#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
REPO_NAME="${REPO_NAME:-jobhunt-repo}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"
AUTH_MODE="${AUTH_MODE:-iap}"
ADMIN_EMAILS="${ADMIN_EMAILS:-kennjason@gmail.com}"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
  --set-secrets SESSION_SECRET=jobhunt-session-secret:latest
  --set-secrets NOTION_TOKEN=jobhunt-notion-token:latest
  --set-secrets NOTION_PIPELINE_DB=jobhunt-notion-pipeline-db:latest
  --set-secrets NOTION_CONTACTS_DB=jobhunt-notion-contacts-db:latest
  --set-secrets NOTION_DAILY_LOG_DB=jobhunt-notion-daily-db:latest
  --set-secrets NOTION_INTERVIEWS_DB=jobhunt-notion-interviews-db:latest
  --set-secrets NOTION_EVENTS_DB=jobhunt-notion-events-db:latest
  --set-secrets NOTION_TEMPLATES_DB=jobhunt-notion-templates-db:latest
  --set-secrets NOTION_WATCHLIST_DB=jobhunt-notion-watchlist-db:latest
  --set-secrets GOOGLE_SHEETS_ID=jobhunt-google-sheets-id:latest
  --set-secrets GOOGLE_SHEETS_SYNC_TABS=jobhunt-google-sheets-tabs:latest
  --set-secrets GOOGLE_SHEETS_CREDENTIALS_JSON=jobhunt-google-sheets-creds:latest
)

if gcloud secrets describe jobhunt-database-url --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets DATABASE_URL=jobhunt-database-url:latest)
fi
if gcloud secrets describe jobhunt-turso-auth-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets TURSO_AUTH_TOKEN=jobhunt-turso-auth-token:latest)
fi

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "AUTH_MODE=${AUTH_MODE},ADMIN_EMAILS=${ADMIN_EMAILS}" \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --timeout 120 \
  --cpu-throttling \
  "${SECRET_ARGS[@]}"

gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)'
