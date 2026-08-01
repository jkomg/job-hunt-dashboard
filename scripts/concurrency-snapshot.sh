#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
LOOKBACK_MINUTES="${LOOKBACK_MINUTES:-60}"
OUTPUT_FILE="${OUTPUT_FILE:-}"

if ! [[ "$LOOKBACK_MINUTES" =~ ^[0-9]+$ ]] || (( LOOKBACK_MINUTES < 1 )); then
  echo "LOOKBACK_MINUTES must be a positive integer" >&2
  exit 1
fi

end_time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_time="$(date -u -v-${LOOKBACK_MINUTES}M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "-${LOOKBACK_MINUTES} minutes" +%Y-%m-%dT%H:%M:%SZ)"
token="$(gcloud auth print-access-token)"

query_metric() {
  local metric_type="$1"
  curl --fail-with-body -sS -G \
    -H "Authorization: Bearer ${token}" \
    "https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries" \
    --data-urlencode "filter=metric.type=\"${metric_type}\" AND resource.labels.service_name=\"${SERVICE_NAME}\"" \
    --data-urlencode "interval.startTime=${start_time}" \
    --data-urlencode "interval.endTime=${end_time}" \
    --data-urlencode "view=FULL"
}

concurrency_json="$(query_metric run.googleapis.com/container/max_request_concurrencies 2>/dev/null || printf '%s' '{}')"
instance_json="$(query_metric run.googleapis.com/container/instance_count 2>/dev/null || printf '%s' '{}')"

summary="$(python3 - "$concurrency_json" "$instance_json" "$start_time" "$end_time" <<'PY'
import json
import sys

concurrency = json.loads(sys.argv[1])
instances = json.loads(sys.argv[2])

def points(payload):
    return [point for series in payload.get('timeSeries', []) for point in series.get('points', [])]

concurrency_points = points(concurrency)
instance_points = points(instances)

counts = 0
weighted_sum = 0.0
max_bucket = 0.0
for point in concurrency_points:
    dist = point.get('value', {}).get('distributionValue', {})
    count = int(dist.get('count', 0) or 0)
    counts += count
    weighted_sum += float(dist.get('mean', 0) or 0) * count
    bounds = dist.get('bucketOptions', {}).get('explicitBuckets', {}).get('bounds', [])
    bucket_counts = dist.get('bucketCounts', [])
    for index, bucket_count in enumerate(bucket_counts):
        if int(bucket_count or 0) > 0:
            if index < len(bounds):
                max_bucket = max(max_bucket, float(bounds[index]))
            else:
                max_bucket = float('inf')

instance_values = []
for point in instance_points:
    value = point.get('value', {}).get('doubleValue', point.get('value', {}).get('int64Value'))
    if value is not None:
        instance_values.append(float(value))

print(f"- window_start_utc: {sys.argv[3]}")
print(f"- window_end_utc: {sys.argv[4]}")
print(f"- concurrency_samples: {counts}")
print(f"- observed_mean_concurrency: {weighted_sum / counts if counts else 0:.2f}")
print(f"- observed_max_concurrency_bucket: {max_bucket if counts else 0}")
print(f"- instance_samples: {len(instance_values)}")
print(f"- observed_max_instances: {max(instance_values) if instance_values else 0:.0f}")
PY
)"

result="# Job Hunt Concurrency Snapshot

- project_id: ${PROJECT_ID}
- region: ${REGION}
- service: ${SERVICE_NAME}
- configured_max_instances: $(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.metadata.annotations."autoscaling.knative.dev/maxScale")' 2>/dev/null || printf 'unknown')
- configured_concurrency_per_instance: $(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.containerConcurrency)' 2>/dev/null || printf 'unknown')

## Cloud Monitoring

${summary}
"

if [[ -n "$OUTPUT_FILE" ]]; then
  printf '%s\n' "$result" > "$OUTPUT_FILE"
  echo "Wrote concurrency snapshot to $OUTPUT_FILE"
else
  printf '%s\n' "$result"
fi
