#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
REPO_NAME="${REPO_NAME:-jobhunt-repo}"
OUTPUT_FILE="${OUTPUT_FILE:-}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"
PUSH_URL="${PUSH_URL:-}"
PUSH_TOKEN="${PUSH_TOKEN:-}"
SNAPSHOT_SOURCE="${SNAPSHOT_SOURCE:-scheduler}"
BILLING_EXPORT_PROJECT="${BILLING_EXPORT_PROJECT:-$PROJECT_ID}"
BILLING_EXPORT_DATASET="${BILLING_EXPORT_DATASET:-billing_export}"
BILLING_EXPORT_ACCOUNT_ID="${BILLING_EXPORT_ACCOUNT_ID:-016E03_D01F73_457507}"
BILLING_EXPORT_TABLE="${BILLING_EXPORT_TABLE:-${BILLING_EXPORT_PROJECT}.${BILLING_EXPORT_DATASET}.gcp_billing_export_v1_${BILLING_EXPORT_ACCOUNT_ID}}"

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT

echo "# Job Hunt Cost Snapshot" >"$tmp_file"
echo >>"$tmp_file"
echo "- generated_at_utc: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >>"$tmp_file"
echo "- project_id: $PROJECT_ID" >>"$tmp_file"
echo "- region: $REGION" >>"$tmp_file"
echo "- service: $SERVICE_NAME" >>"$tmp_file"
echo >>"$tmp_file"

echo "## Cloud Run Service" >>"$tmp_file"
if gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" >/dev/null 2>&1; then
  min_instances="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.metadata.annotations."autoscaling.knative.dev/minScale")' || true)"
  max_instances="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.metadata.annotations."autoscaling.knative.dev/maxScale")' || true)"
  timeout_seconds="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.timeoutSeconds)' || true)"
  cpu="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.containers[0].resources.limits.cpu)' || true)"
  memory="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.containers[0].resources.limits.memory)' || true)"
  echo "- min_instances: ${min_instances:-0}" >>"$tmp_file"
  echo "- max_instances: ${max_instances:-default}" >>"$tmp_file"
  echo "- timeout_seconds: ${timeout_seconds:-unknown}" >>"$tmp_file"
  echo "- cpu_limit: ${cpu:-unknown}" >>"$tmp_file"
  echo "- memory_limit: ${memory:-unknown}" >>"$tmp_file"
else
  echo "- status: service not found or access denied" >>"$tmp_file"
fi
echo >>"$tmp_file"

echo "## Cloud Scheduler Jobs" >>"$tmp_file"
if gcloud scheduler jobs list --project "$PROJECT_ID" --location "$REGION" >/dev/null 2>&1; then
  job_count="$(gcloud scheduler jobs list --project "$PROJECT_ID" --location "$REGION" --format='value(name)' | sed '/^\s*$/d' | wc -l | tr -d ' ')"
  echo "- job_count: ${job_count}" >>"$tmp_file"
  echo "- jobs:" >>"$tmp_file"
  gcloud scheduler jobs list \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --format='table(name.basename(),schedule,state)' | sed 's/^/  /' >>"$tmp_file" || true
else
  echo "- status: scheduler unavailable or access denied" >>"$tmp_file"
fi
echo >>"$tmp_file"

echo "## Artifact Registry (images)" >>"$tmp_file"
if gcloud artifacts docker images list "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}" --project "$PROJECT_ID" >/dev/null 2>&1; then
  image_count="$(gcloud artifacts docker images list "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}" --project "$PROJECT_ID" --format='value(PACKAGE)' | sed '/^\s*$/d' | wc -l | tr -d ' ')"
  echo "- image_packages: ${image_count}" >>"$tmp_file"
else
  echo "- status: repository unavailable or access denied" >>"$tmp_file"
fi
echo >>"$tmp_file"

echo "## Logging Exclusions (_Default sink)" >>"$tmp_file"
if gcloud logging sinks describe _Default --project "$PROJECT_ID" >/dev/null 2>&1; then
  exclusions="$(gcloud logging sinks describe _Default --project "$PROJECT_ID" --format='value(exclusions[].name)' || true)"
  if [[ -n "${exclusions}" ]]; then
    echo "- exclusions:" >>"$tmp_file"
    while IFS= read -r name; do
      [[ -n "$name" ]] && echo "  - $name" >>"$tmp_file"
    done <<<"$exclusions"
  else
    echo "- exclusions: none" >>"$tmp_file"
  fi
else
  echo "- status: logging sink unavailable or access denied" >>"$tmp_file"
fi
echo >>"$tmp_file"

echo "## Billing Budgets (if permissions allow)" >>"$tmp_file"
resolved_billing_account="$BILLING_ACCOUNT"
if [[ -z "$resolved_billing_account" ]]; then
  resolved_billing_account="$(gcloud beta billing projects describe "$PROJECT_ID" --format='value(billingAccountName)' 2>/dev/null | sed 's#.*/##' || true)"
fi
if [[ -n "$resolved_billing_account" ]] && gcloud beta billing budgets list --billing-account "$resolved_billing_account" --format='table(displayName,amount.specifiedAmount.currencyCode,amount.specifiedAmount.units)' >/dev/null 2>&1; then
  echo "- billing_account: $resolved_billing_account" >>"$tmp_file"
  gcloud beta billing budgets list --billing-account "$resolved_billing_account" --format='table(displayName,amount.specifiedAmount.currencyCode,amount.specifiedAmount.units)' | sed 's/^/  /' >>"$tmp_file" || true
else
  if [[ -n "$resolved_billing_account" ]]; then
    echo "- billing_account: $resolved_billing_account" >>"$tmp_file"
    echo "- status: budget list unavailable (missing billing permissions is common)" >>"$tmp_file"
  else
    echo "- status: no billing account provided or discovered; set BILLING_ACCOUNT to enable budget snapshot" >>"$tmp_file"
  fi
fi
echo >>"$tmp_file"

echo "## Actual Billing (month to date)" >>"$tmp_file"
if [[ ! "$BILLING_EXPORT_TABLE" =~ ^[A-Za-z0-9_.-]+$ ]]; then
    echo "- status: invalid BILLING_EXPORT_TABLE identifier" >>"$tmp_file"
elif ! command -v bq >/dev/null 2>&1; then
    echo "- status: bq CLI unavailable" >>"$tmp_file"
else
    billing_query="
      SELECT
        ROUND(SUM(cost) + COALESCE(SUM((SELECT SUM(c.amount) FROM UNNEST(credits) c)), 0), 2) AS month_to_date_cost,
        COUNT(DISTINCT service.description) AS service_count,
        MAX(usage_start_time) AS latest_usage
      FROM \`${BILLING_EXPORT_TABLE}\`
      WHERE usage_start_time >= TIMESTAMP(DATE_TRUNC(CURRENT_DATE(), MONTH))
        AND usage_start_time < TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
        AND project.id = '${PROJECT_ID}'
    "
    billing_json="$(bq query --project_id="$BILLING_EXPORT_PROJECT" --use_legacy_sql=false --format=json --quiet "$billing_query" 2>/dev/null || true)"
    if [[ -z "$billing_json" ]]; then
      echo "- status: billing export query failed or is not accessible" >>"$tmp_file"
    else
      billing_summary="$(python3 -c 'import json, sys
try:
  rows = json.load(sys.stdin)
except (json.JSONDecodeError, TypeError):
  raise SystemExit(1)
row = rows[0] if rows else {}
print("- month_to_date_cost_usd: {}".format(row.get("month_to_date_cost") if row.get("month_to_date_cost") is not None else "0"))
print("- services_seen: {}".format(row.get("service_count") if row.get("service_count") is not None else "0"))
print("- latest_usage_start: {}".format(row.get("latest_usage") or "unknown"))' <<<"$billing_json")" || true
      if [[ -z "$billing_summary" ]]; then
        echo "- status: billing export query failed or is not accessible" >>"$tmp_file"
      else
        while IFS= read -r line; do
          [[ -n "$line" ]] && echo "$line" >>"$tmp_file"
        done <<<"$billing_summary"
      fi
    fi
fi
echo >>"$tmp_file"

if [[ -n "$OUTPUT_FILE" ]]; then
  cp "$tmp_file" "$OUTPUT_FILE"
  echo "Wrote snapshot to $OUTPUT_FILE"
else
  cat "$tmp_file"
fi

if [[ -n "$PUSH_URL" && -n "$PUSH_TOKEN" ]]; then
  escaped_summary="$(python3 - <<'PY' "$tmp_file"
import json, pathlib, sys
p = pathlib.Path(sys.argv[1])
print(json.dumps(p.read_text()))
PY
)"
  payload="{\"source\":\"${SNAPSHOT_SOURCE}\",\"summaryText\":${escaped_summary}}"
  curl --fail-with-body -sS -X POST "${PUSH_URL}" \
    -H "content-type: application/json" \
    -H "x-cost-token: ${PUSH_TOKEN}" \
    --data "$payload" >/dev/null
  echo "Pushed snapshot to ${PUSH_URL}"
fi
