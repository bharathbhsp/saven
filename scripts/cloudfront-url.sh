#!/usr/bin/env bash
# Print CloudFront app URL(s) for dev and/or prod from Terraform outputs.
# Usage: ./cloudfront-url.sh [dev|prod|all]
#   dev  - show only dev CloudFront URL (default if no arg)
#   prod - show only prod
#   all  - show both dev and prod
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODE="${1:-all}"

show_url() {
  local stage="$1"
  local infra_dir="$ROOT/infra/$stage"
  if [ ! -d "$infra_dir" ]; then
    echo "$stage: (infra dir not found)" >&2
    return 1
  fi
  local url
  if url="$(cd "$infra_dir" && terraform output -raw cloudfront_url 2>/dev/null)"; then
    echo "$stage: $url"
  else
    echo "$stage: (run terraform apply in infra/$stage first)" >&2
    return 1
  fi
}

case "$MODE" in
  dev)
    show_url dev
    ;;
  prod)
    show_url prod
    ;;
  all)
    show_url dev
    show_url prod
    ;;
  *)
    echo "Usage: $0 [dev|prod|all]"
    echo "  dev  - CloudFront URL for dev"
    echo "  prod - CloudFront URL for prod"
    echo "  all  - both (default)"
    exit 1
    ;;
esac
