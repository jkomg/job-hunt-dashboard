#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
JOB_NAME="${JOB_NAME:-job-hunt-daily-backup-export}"
SCHEDULE="${SCHEDULE:-15 6 * * *}"
TIME_ZONE="${TIME_ZONE:-America/New_York}"
CRON_TOKEN="${CRON_TOKEN:-}"
SCHEDULER_SA_NAME="${SCHEDULER_SA_NAME:-jobhunt-scheduler-invoker}"
DOMAIN="${DOMAIN:-}"
IAP_BACKEND_SERVICE="${IAP_BACKEND_SERVICE:-job-hunt-backend}"
IAP_CLIENT_ID="${IAP_CLIENT_ID:-}"

if [[ -z "${CRON_TOKEN}" ]]; then
  echo "Missing CRON_TOKEN. Provide it from BACKUP_EXPORT_CRON_TOKEN."
  exit 1
fi

gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable cloudscheduler.googleapis.com run.googleapis.com iam.googleapis.com --project "$PROJECT_ID" >/dev/null

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')"
if [[ -z "${SERVICE_URL}" ]]; then
  echo "Could not resolve Cloud Run service URL for $SERVICE_NAME"
  exit 1
fi

SCHEDULER_SA_EMAIL="${SCHEDULER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SCHEDULER_SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SCHEDULER_SA_NAME" \
    --display-name "Job Hunt Scheduler Invoker" \
    --project "$PROJECT_ID" >/dev/null
fi

gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
  --region "$REGION" \
  --member "serviceAccount:${SCHEDULER_SA_EMAIL}" \
  --role "roles/run.invoker" \
  --project "$PROJECT_ID" >/dev/null

TARGET_AUDIENCE="$SERVICE_URL"
URI="${SERVICE_URL}/api/internal/backup/export"
if [[ -n "$DOMAIN" ]]; then
  URI="https://${DOMAIN}/api/internal/backup/export"

  if [[ -z "$IAP_CLIENT_ID" ]]; then
    IAP_CLIENT_ID="$(gcloud compute backend-services describe "$IAP_BACKEND_SERVICE" --global --project "$PROJECT_ID" --format='value(iap.oauth2ClientId)')"
  fi
  if [[ -z "$IAP_CLIENT_ID" ]]; then
    echo "Missing IAP_CLIENT_ID. Set it explicitly when using DOMAIN."
    exit 1
  fi
  TARGET_AUDIENCE="$IAP_CLIENT_ID"

  gcloud iap web add-iam-policy-binding \
    --resource-type=backend-services \
    --service="$IAP_BACKEND_SERVICE" \
    --member="serviceAccount:${SCHEDULER_SA_EMAIL}" \
    --role="roles/iap.httpsResourceAccessor" \
    --project="$PROJECT_ID" >/dev/null
fi

HEADERS="x-backup-token=${CRON_TOKEN}"

if gcloud scheduler jobs describe "$JOB_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB_NAME" \
    --location "$REGION" \
    --schedule "$SCHEDULE" \
    --time-zone "$TIME_ZONE" \
    --uri "$URI" \
    --http-method POST \
    --update-headers "$HEADERS" \
    --oidc-service-account-email "$SCHEDULER_SA_EMAIL" \
    --oidc-token-audience "$TARGET_AUDIENCE" \
    --project "$PROJECT_ID" >/dev/null
  echo "Updated scheduler job: $JOB_NAME"
else
  gcloud scheduler jobs create http "$JOB_NAME" \
    --location "$REGION" \
    --schedule "$SCHEDULE" \
    --time-zone "$TIME_ZONE" \
    --uri "$URI" \
    --http-method POST \
    --headers "$HEADERS" \
    --oidc-service-account-email "$SCHEDULER_SA_EMAIL" \
    --oidc-token-audience "$TARGET_AUDIENCE" \
    --project "$PROJECT_ID" >/dev/null
  echo "Created scheduler job: $JOB_NAME"
fi

echo "Job schedule: ${SCHEDULE} (${TIME_ZONE})"
echo "Target: ${URI}"
echo "OIDC audience: ${TARGET_AUDIENCE}"
echo "Run now (optional): gcloud scheduler jobs run ${JOB_NAME} --location ${REGION} --project ${PROJECT_ID}"
