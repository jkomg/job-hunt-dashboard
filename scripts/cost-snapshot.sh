#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
REPO_NAME="${REPO_NAME:-jobhunt-repo}"
OUTPUT_FILE="${OUTPUT_FILE:-}"

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
if gcloud beta billing budgets list --format='table(displayName,amount.specifiedAmount.currencyCode,amount.specifiedAmount.units)' >/dev/null 2>&1; then
  gcloud beta billing budgets list --format='table(displayName,amount.specifiedAmount.currencyCode,amount.specifiedAmount.units)' | sed 's/^/  /' >>"$tmp_file" || true
else
  echo "- status: budget list unavailable (missing billing permissions is common)" >>"$tmp_file"
fi
echo >>"$tmp_file"

if [[ -n "$OUTPUT_FILE" ]]; then
  cp "$tmp_file" "$OUTPUT_FILE"
  echo "Wrote snapshot to $OUTPUT_FILE"
else
  cat "$tmp_file"
fi
