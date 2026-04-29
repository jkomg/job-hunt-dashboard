#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
REPO_NAME="${REPO_NAME:-jobhunt-repo}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"
AUTH_MODE="${AUTH_MODE:-session}"
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
  --set-secrets GOOGLE_SHEETS_ID=jobhunt-google-sheets-id:latest
  --set-secrets GOOGLE_SHEETS_SYNC_TABS=jobhunt-google-sheets-tabs:latest
  --set-secrets GOOGLE_SHEETS_CREDENTIALS_JSON=jobhunt-google-sheets-creds:latest
)

if gcloud secrets describe jobhunt-google-sheets-contacts-tabs --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets GOOGLE_SHEETS_CONTACTS_SYNC_TABS=jobhunt-google-sheets-contacts-tabs:latest)
fi
if gcloud secrets describe jobhunt-google-sheets-interviews-tabs --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS=jobhunt-google-sheets-interviews-tabs:latest)
fi
if gcloud secrets describe jobhunt-google-sheets-events-tabs --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets GOOGLE_SHEETS_EVENTS_SYNC_TABS=jobhunt-google-sheets-events-tabs:latest)
fi

if gcloud secrets describe jobhunt-database-url --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets DATABASE_URL=jobhunt-database-url:latest)
fi
if gcloud secrets describe jobhunt-turso-auth-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets TURSO_AUTH_TOKEN=jobhunt-turso-auth-token:latest)
fi
if gcloud secrets describe jobhunt-sheets-sync-cron-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets SHEETS_SYNC_CRON_TOKEN=jobhunt-sheets-sync-cron-token:latest)
fi
if gcloud secrets describe jobhunt-backup-export-cron-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets BACKUP_EXPORT_CRON_TOKEN=jobhunt-backup-export-cron-token:latest)
fi
if gcloud secrets describe jobhunt-backup-gcs-bucket --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets BACKUP_GCS_BUCKET=jobhunt-backup-gcs-bucket:latest)
fi
if gcloud secrets describe jobhunt-backup-gcs-prefix --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets BACKUP_GCS_PREFIX=jobhunt-backup-gcs-prefix:latest)
fi
if gcloud secrets describe jobhunt-gmail-oauth-client-id --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets GMAIL_OAUTH_CLIENT_ID=jobhunt-gmail-oauth-client-id:latest)
fi
if gcloud secrets describe jobhunt-gmail-oauth-client-secret --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets GMAIL_OAUTH_CLIENT_SECRET=jobhunt-gmail-oauth-client-secret:latest)
fi
if gcloud secrets describe jobhunt-gmail-oauth-redirect-uri --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets GMAIL_OAUTH_REDIRECT_URI=jobhunt-gmail-oauth-redirect-uri:latest)
fi

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "AUTH_MODE=${AUTH_MODE},ADMIN_EMAILS=${ADMIN_EMAILS},GMAIL_IMPORT_QUERY=newer_than:60d (filename:ics OR subject:(interview OR recruiter OR hiring))" \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --timeout 120 \
  --cpu-throttling \
  "${SECRET_ARGS[@]}"

gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)'
