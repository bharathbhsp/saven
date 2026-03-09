#!/usr/bin/env bash
# Deploy backend and frontend for an environment: apply Terraform (Lambda + infra), then build and sync frontend.
# Usage: ./deploy.sh <dev|prod> [terraform apply options...]
# Example: ./deploy.sh dev
#          ./deploy.sh prod -var-file=prod.tfvars
# Prereqs: AWS CLI configured, Terraform >= 1.0. For first run, copy dev.tfvars.example -> dev.tfvars (or prod) and set values.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STAGE="${1:-}"

if [ "$STAGE" != "dev" ] && [ "$STAGE" != "prod" ]; then
  echo "Usage: $0 <dev|prod> [terraform apply options...]"
  echo "  dev  - deploy to dev (infra/dev)"
  echo "  prod - deploy to prod (infra/prod)"
  exit 1
fi

shift || true
INFRA_DIR="$ROOT/infra/$STAGE"
VAR_FILE="$INFRA_DIR/$STAGE.tfvars"

echo "==> Deploying to environment: $STAGE"
echo "    Infra dir: $INFRA_DIR"
cd "$INFRA_DIR"

echo "==> Terraform init"
terraform init -reconfigure

APPLY_OPTS=(-auto-approve)
if [ -f "$VAR_FILE" ]; then
  APPLY_OPTS+=(-var-file="$VAR_FILE")
  echo "    Using var file: $VAR_FILE"
fi
if [ $# -gt 0 ]; then
  APPLY_OPTS+=("$@")
fi

echo "==> Terraform apply (backend Lambda + infra)"
terraform apply "${APPLY_OPTS[@]}"

echo "==> Deploy frontend (build + S3 sync)"
"$SCRIPT_DIR/deploy-frontend.sh" "$STAGE"

echo "==> Deploy complete for $STAGE"
