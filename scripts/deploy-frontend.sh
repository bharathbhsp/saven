#!/usr/bin/env bash
# Build frontend and sync to S3; optionally invalidate CloudFront.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT/frontend"
npm ci
npm run build
cd "$ROOT/infra"
BUCKET=$(terraform output -raw app_bucket_name)
aws s3 sync "$ROOT/frontend/dist/" "s3://$BUCKET/" --delete
echo "Synced to s3://$BUCKET"
CF_ID=$(terraform output -raw cloudfront_id 2>/dev/null || true)
if [ -n "$CF_ID" ]; then
  aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*"
  echo "CloudFront invalidation created."
fi
