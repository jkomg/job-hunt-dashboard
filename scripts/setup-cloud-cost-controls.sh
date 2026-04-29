#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
REPO_NAME="${REPO_NAME:-jobhunt-repo}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-015F46-3AAD50-3DEF17}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-15USD}"
BUDGET_NAME="${BUDGET_NAME:-Job Hunt Dashboard Budget}"
POLICY_FILE="${POLICY_FILE:-config/artifact-cleanup-policy.json}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Using project: ${PROJECT_ID}"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "Applying Artifact Registry cleanup policy to ${REPO_NAME}..."
gcloud artifacts repositories set-cleanup-policies "$REPO_NAME" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  --policy="${ROOT_DIR}/${POLICY_FILE}" \
  --quiet >/dev/null

echo "Adding conservative Cloud Logging exclusion for successful static asset reads..."
gcloud logging sinks update _Default \
  --project="$PROJECT_ID" \
  --add-exclusion=name=jobhunt-static-2xx,description="Drop successful static asset request logs for Job Hunt Dashboard",filter='resource.type="cloud_run_revision" AND resource.labels.service_name="job-hunt-dashboard" AND httpRequest.status>=200 AND httpRequest.status<300 AND (httpRequest.requestUrl=~"/assets/" OR httpRequest.requestUrl=~"\\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)($|[?])")' \
  >/dev/null || \
gcloud logging sinks update _Default \
  --project="$PROJECT_ID" \
  --update-exclusion=name=jobhunt-static-2xx,description="Drop successful static asset request logs for Job Hunt Dashboard",filter='resource.type="cloud_run_revision" AND resource.labels.service_name="job-hunt-dashboard" AND httpRequest.status>=200 AND httpRequest.status<300 AND (httpRequest.requestUrl=~"/assets/" OR httpRequest.requestUrl=~"\\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)($|[?])")' \
  >/dev/null

echo "Creating/updating billing budget if this account has billing permissions..."
if gcloud services enable billingbudgets.googleapis.com --project "$PROJECT_ID" >/dev/null 2>&1; then
  if ! gcloud beta billing budgets list \
    --billing-account="$BILLING_ACCOUNT" \
    --format='value(displayName)' 2>/dev/null | grep -Fxq "$BUDGET_NAME"; then
    gcloud beta billing budgets create \
      --billing-account="$BILLING_ACCOUNT" \
      --display-name="$BUDGET_NAME" \
      --budget-amount="$BUDGET_AMOUNT" \
      --filter-projects="projects/${PROJECT_ID}" \
      --calendar-period=month \
      --threshold-rule=percent=0.5 \
      --threshold-rule=percent=0.8 \
      --threshold-rule=percent=1.0 \
      --threshold-rule=percent=1.0,basis=forecasted-spend \
      >/dev/null || echo "Budget creation skipped: this Google account needs Billing Account budget permissions."
  else
    echo "Budget already exists: ${BUDGET_NAME}"
  fi
else
  echo "Budget API enable skipped: this Google account needs permission to enable billingbudgets.googleapis.com."
fi

echo "Cost controls complete."
