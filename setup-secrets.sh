#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

get_env() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -n1 | cut -d'=' -f2-
}

upsert_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "Skipping empty secret: $name"
    return
  fi

  if gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf "%s" "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT_ID" >/dev/null
  else
    gcloud secrets create "$name" --replication-policy="automatic" --project "$PROJECT_ID" >/dev/null
    printf "%s" "$value" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT_ID" >/dev/null
  fi
  echo "Synced secret: $name"
}

gcloud config set project "$PROJECT_ID" >/dev/null

gcloud services enable secretmanager.googleapis.com run.googleapis.com artifactregistry.googleapis.com --project "$PROJECT_ID" >/dev/null

upsert_secret "jobhunt-session-secret" "$(get_env SESSION_SECRET)"
upsert_secret "jobhunt-database-url" "$(get_env DATABASE_URL)"
upsert_secret "jobhunt-turso-auth-token" "$(get_env TURSO_AUTH_TOKEN)"
upsert_secret "jobhunt-google-sheets-id" "$(get_env GOOGLE_SHEETS_ID)"
upsert_secret "jobhunt-google-sheets-tabs" "$(get_env GOOGLE_SHEETS_SYNC_TABS)"
upsert_secret "jobhunt-google-sheets-contacts-tabs" "$(get_env GOOGLE_SHEETS_CONTACTS_SYNC_TABS)"
upsert_secret "jobhunt-google-sheets-interviews-tabs" "$(get_env GOOGLE_SHEETS_INTERVIEWS_SYNC_TABS)"
upsert_secret "jobhunt-google-sheets-events-tabs" "$(get_env GOOGLE_SHEETS_EVENTS_SYNC_TABS)"
upsert_secret "jobhunt-google-sheets-creds" "$(get_env GOOGLE_SHEETS_CREDENTIALS_JSON)"
upsert_secret "jobhunt-sheets-sync-cron-token" "$(get_env SHEETS_SYNC_CRON_TOKEN)"

SA_EMAIL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [[ -z "$SA_EMAIL" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
  SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

for s in \
  jobhunt-session-secret \
  jobhunt-google-sheets-id \
  jobhunt-google-sheets-tabs \
  jobhunt-google-sheets-contacts-tabs \
  jobhunt-google-sheets-interviews-tabs \
  jobhunt-google-sheets-events-tabs \
  jobhunt-google-sheets-creds \
  jobhunt-sheets-sync-cron-token; do
  if gcloud secrets describe "$s" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets add-iam-policy-binding "$s" \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="roles/secretmanager.secretAccessor" \
      --project "$PROJECT_ID" >/dev/null
  fi
 done

if gcloud secrets describe jobhunt-database-url --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud secrets add-iam-policy-binding "jobhunt-database-url" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" >/dev/null
fi

if gcloud secrets describe jobhunt-turso-auth-token --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud secrets add-iam-policy-binding "jobhunt-turso-auth-token" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" >/dev/null
fi

echo "Secrets synced and access granted to ${SA_EMAIL}"
