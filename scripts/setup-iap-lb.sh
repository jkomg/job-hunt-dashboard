#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-job-hunt-dashboard-494012}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-job-hunt-dashboard}"
DOMAIN="${DOMAIN:-hunt.jkomg.us}"
IAP_USER_EMAIL="${IAP_USER_EMAIL:-kennjason@gmail.com}"

NEG_NAME="${NEG_NAME:-job-hunt-neg}"
BACKEND_NAME="${BACKEND_NAME:-job-hunt-backend}"
URLMAP_NAME="${URLMAP_NAME:-job-hunt-urlmap}"
CERT_NAME="${CERT_NAME:-job-hunt-cert}"
ADDRESS_NAME="${ADDRESS_NAME:-job-hunt-lb-ip}"
HTTPS_PROXY_NAME="${HTTPS_PROXY_NAME:-job-hunt-https-proxy}"
HTTPS_FWD_RULE_NAME="${HTTPS_FWD_RULE_NAME:-job-hunt-https-fr}"
RUN_COST_CONTROLS="${RUN_COST_CONTROLS:-true}"

echo "Using project: ${PROJECT_ID}"
gcloud config set project "$PROJECT_ID" >/dev/null

gcloud services enable \
  run.googleapis.com \
  compute.googleapis.com \
  iap.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project "$PROJECT_ID" >/dev/null

if ! gcloud compute network-endpoint-groups describe "$NEG_NAME" --region "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute network-endpoint-groups create "$NEG_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --network-endpoint-type=serverless \
    --cloud-run-service="$SERVICE_NAME"
fi

if ! gcloud compute backend-services describe "$BACKEND_NAME" --global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute backend-services create "$BACKEND_NAME" \
    --global \
    --project "$PROJECT_ID" \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --protocol=HTTP
fi

if ! gcloud compute backend-services describe "$BACKEND_NAME" --global --project "$PROJECT_ID" --format='value(backends.group)' | grep -q "$NEG_NAME"; then
  gcloud compute backend-services add-backend "$BACKEND_NAME" \
    --global \
    --project "$PROJECT_ID" \
    --network-endpoint-group="$NEG_NAME" \
    --network-endpoint-group-region="$REGION"
fi

if ! gcloud compute url-maps describe "$URLMAP_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute url-maps create "$URLMAP_NAME" \
    --project "$PROJECT_ID" \
    --default-service "$BACKEND_NAME"
fi

if ! gcloud compute addresses describe "$ADDRESS_NAME" --global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute addresses create "$ADDRESS_NAME" --global --project "$PROJECT_ID"
fi

if ! gcloud compute ssl-certificates describe "$CERT_NAME" --global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute ssl-certificates create "$CERT_NAME" \
    --global \
    --project "$PROJECT_ID" \
    --domains="$DOMAIN"
fi

if ! gcloud compute target-https-proxies describe "$HTTPS_PROXY_NAME" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute target-https-proxies create "$HTTPS_PROXY_NAME" \
    --project "$PROJECT_ID" \
    --url-map="$URLMAP_NAME" \
    --ssl-certificates="$CERT_NAME"
fi

if ! gcloud compute forwarding-rules describe "$HTTPS_FWD_RULE_NAME" --global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute forwarding-rules create "$HTTPS_FWD_RULE_NAME" \
    --global \
    --project "$PROJECT_ID" \
    --target-https-proxy="$HTTPS_PROXY_NAME" \
    --address="$ADDRESS_NAME" \
    --ports=443 \
    --load-balancing-scheme=EXTERNAL_MANAGED
fi

# Enable IAP with Google-managed OAuth client.
gcloud compute backend-services update "$BACKEND_NAME" \
  --global \
  --project "$PROJECT_ID" \
  --iap=enabled >/dev/null

gcloud iap web add-iam-policy-binding \
  --project "$PROJECT_ID" \
  --resource-type=backend-services \
  --service="$BACKEND_NAME" \
  --member="user:${IAP_USER_EMAIL}" \
  --role="roles/iap.httpsResourceAccessor" >/dev/null

# Prevent direct run.app bypass.
gcloud run services update "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --ingress internal-and-cloud-load-balancing \
  --quiet >/dev/null

LB_IP="$(gcloud compute addresses describe "$ADDRESS_NAME" --global --project "$PROJECT_ID" --format='value(address)')"
echo
echo "IAP setup complete."
if [[ "$RUN_COST_CONTROLS" == "true" && -x "$(dirname "$0")/setup-cloud-cost-controls.sh" ]]; then
  echo "Applying standard cost controls..."
  "$(dirname "$0")/setup-cloud-cost-controls.sh"
fi

echo "Set DNS for ${DOMAIN}:"
echo "  - remove any existing CNAME"
echo "  - add A record -> ${LB_IP}"
echo
echo "Check cert status:"
echo "  gcloud compute ssl-certificates describe ${CERT_NAME} --global --project ${PROJECT_ID} --format='value(managed.status,managed.domainStatus)'"
