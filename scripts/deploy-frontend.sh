#!/usr/bin/env bash
# Build frontend and sync to S3; optionally invalidate CloudFront.
# Usage: ./deploy-frontend.sh [dev|prod]  (default: infra root for legacy)
# For dev|prod, build uses that stage's Terraform outputs (API URL, Cognito) so login goes to the correct Cognito.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STAGE="${1:-}"
if [ "$STAGE" = "dev" ] || [ "$STAGE" = "prod" ]; then
  INFRA_DIR="$ROOT/infra/$STAGE"
else
  INFRA_DIR="$ROOT/infra"
fi

cd "$ROOT/frontend"
npm ci

# For dev|prod, inject this stage's API + Cognito into the build (Vite bakes VITE_* at build time)
if [ "$STAGE" = "dev" ] || [ "$STAGE" = "prod" ]; then
  cd "$INFRA_DIR"
  export VITE_API_URL=$(terraform output -raw api_gateway_url 2>/dev/null | sed 's/\/$//')
  export VITE_COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null)
  export VITE_COGNITO_CLIENT_ID=$(terraform output -raw cognito_app_client_id 2>/dev/null)
  export VITE_COGNITO_DOMAIN=$(terraform output -raw cognito_domain 2>/dev/null)
  export VITE_AWS_REGION="${VITE_AWS_REGION:-ap-south-2}"
  cd "$ROOT/frontend"
fi

npm run build
cd "$INFRA_DIR"
BUCKET=$(terraform output -raw app_bucket_name)
aws s3 sync "$ROOT/frontend/dist/" "s3://$BUCKET/" --delete
echo "Synced to s3://$BUCKET"
CF_ID=$(terraform output -raw cloudfront_id 2>/dev/null || true)
if [ -n "$CF_ID" ]; then
  aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*"
  echo "CloudFront invalidation created."
fi
