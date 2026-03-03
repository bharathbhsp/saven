# Saven — Phase 0 Infrastructure (Terraform)

Provisions AWS resources per [../docs/dev-phases.md](../docs/dev-phases.md) Phase 0.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.0
- AWS CLI configured (e.g. `aws configure`) or env vars `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- AWS account

## What gets created

- **Auth:** Cognito user pool, app client, hosted UI domain; optional **Google (Gmail) login** when OAuth credentials are set
- **Data (Phase 1):** DynamoDB tables (groups, group_members, categories, transactions) with GSIs; schema and access patterns in [../docs/data-model.md](../docs/data-model.md)
- **API:** API Gateway HTTP API, Lambda placeholder, IAM roles (least-privilege log group), CloudWatch log group
- **Frontend:** S3 buckets (app, exports), CloudFront distribution with OAI; exports bucket lifecycle (7-day expiration)
- **Secrets:** SSM Parameter Store placeholders (Google credentials, Telegram bot token)

## Commands

```bash
cd infra
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

## Outputs

After apply, run `terraform output` for:

- `api_gateway_url` — API base URL
- `cognito_user_pool_id`, `cognito_app_client_id`, `cognito_domain`, `cognito_issuer_url`
- `app_bucket_name`, `exports_bucket_name`
- `cloudfront_url`, `cloudfront_distribution_id`
- `dynamodb_tables`

## Backend (state)

Default is **local** state (`terraform.tfstate` in `infra/`). For team use, create an S3 bucket and DynamoDB table for locking, then in `versions.tf` switch to the commented `backend "s3"` block and run `terraform init -migrate-state`.

## Variables

- `aws_region` (default: `ap-south-2`)
- `project_name` (default: `saven`)
- `environment` (default: `dev`)
- `cognito_domain` (default: `saven-auth`) — must be globally unique; override if needed
- `google_client_id` (optional, sensitive) — Google OAuth 2.0 client ID for **Gmail login**
- `google_client_secret` (optional, sensitive) — Google OAuth 2.0 client secret

Copy `terraform.tfvars.example` to `terraform.tfvars` and set values. For Gmail login, set the Google variables (use environment variables `TF_VAR_google_client_id` and `TF_VAR_google_client_secret` to avoid putting secrets in a file).

### Gmail / Google login

1. In [Google Cloud Console](https://console.cloud.google.com/) create an **OAuth 2.0 Client ID** (Web application).
2. Under **Authorized redirect URIs** add:  
   `https://<cognito-domain>.auth.<aws-region>.amazoncognito.com/oauth2/idpresponse`  
   Example: `https://saven-auth-dev.auth.ap-south-2.amazoncognito.com/oauth2/idpresponse`
3. Set `google_client_id` and `google_client_secret` in `terraform.tfvars` or via `TF_VAR_*` env vars.
4. Apply. The Hosted UI will show a “Sign in with Google” option.
