# Saven — Phase 0 Infrastructure (Terraform)

Provisions AWS resources per [../docs/dev-phases.md](../docs/dev-phases.md) Phase 0.

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.0
- AWS CLI configured (e.g. `aws configure`) or env vars `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- AWS account

## What gets created

- **Auth:** Cognito user pool (invite-only: no self sign-up), app client, hosted UI domain; optional **Google (Gmail) login** when OAuth credentials are set
- **Data (Phase 1):** DynamoDB tables (groups, group_members, categories, transactions) with GSIs; schema and access patterns in [../docs/data-model.md](../docs/data-model.md)
- **Frontend (Phase 4):** Build with `cd ../frontend && npm ci && npm run build`; sync `frontend/dist/` to the app bucket. See [../frontend/README.md](../frontend/README.md) and [../scripts/deploy-frontend.sh](../scripts/deploy-frontend.sh).
- **PDF export (Phase 5):** For Lambda PDF export, run `npm install` in `modules/api/src/` before `terraform apply` so the zip includes `pdfkit`. CSV export works without it.
- **API (Phase 2 & 3):** API Gateway HTTP API with JWT authorizer (Cognito), Lambda CRUD API (groups, members, categories, transactions), IAM, CloudWatch log group. See [../docs/api.md](../docs/api.md).
- **Frontend:** S3 buckets (app, exports), CloudFront distribution with OAI; exports bucket lifecycle (7-day expiration)
- **Secrets:** SSM Parameter Store (Google credentials, Telegram bot token)
- **Phase 6 — Telegram bot:** DynamoDB tables `telegram_links`, `telegram_link_codes`; Lambda handles `POST /webhook/telegram`; bot token in Parameter Store. See [Telegram bot](#telegram-bot-phase-6) below.

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

Copy `terraform.tfvars.example` to `terraform.tfvars` and set values. For secrets use `TF_VAR_*` (e.g. `TF_VAR_google_client_secret`, `TF_VAR_telegram_bot_token`) to avoid storing them in files.

### Gmail / Google login

1. In [Google Cloud Console](https://console.cloud.google.com/) create an **OAuth 2.0 Client ID** (Web application).
2. Under **Authorized redirect URIs** add:  
   `https://<cognito-domain>.auth.<aws-region>.amazoncognito.com/oauth2/idpresponse`  
   Example: `https://saven-auth-dev.auth.ap-south-2.amazoncognito.com/oauth2/idpresponse`
3. Set `google_client_id` and `google_client_secret` in `terraform.tfvars` or via `TF_VAR_*` env vars.
4. Apply. The Hosted UI will show a “Sign in with Google” option.

### Invite-only (hide “Sign up” on Hosted UI)

The user pool is set to **Only allow administrators to create users** (`allow_admin_create_user_only = true`), so the Hosted UI should not show “Need an account? Sign up”. If you still see it:

1. Run `terraform apply` from `infra/` so the user pool policy is updated.
2. In AWS Console → Cognito → your User pool → **Sign-in experience** (or **Policies**), confirm **Only allow administrators to create users** is selected.
3. Try the Hosted UI in an incognito/private window in case of caching.

To **send invites** (create users and optionally email a temporary password), see [../docs/invites.md](../docs/invites.md). You can follow those steps from any browser, including incognito.

### Telegram bot (Phase 6)

1. Create a bot with [@BotFather](https://t.me/botfather) and copy the token.
2. Set `telegram_bot_token` in `terraform.tfvars` or run with `TF_VAR_telegram_bot_token=<token> terraform apply`.
3. After deploy, register the webhook with Telegram (replace `<API_URL>` and `<TOKEN>`):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<API_URL>/webhook/telegram"
   ```
   Example: if `terraform output api_gateway_url` is `https://abc123.execute-api.ap-south-2.amazonaws.com`, use  
   `https://abc123.execute-api.ap-south-2.amazonaws.com/webhook/telegram`.
4. Users link their account in the app: **Settings → Connect Telegram** (generate code), then in Telegram send `/link <code>` to your bot.
5. Bot commands: `/start`, `/add <amount> <category> [date]`, `/today`, `/month`, `/range <start> <end>`, and free text (e.g. `50 coffee`). See [../docs/api.md](../docs/api.md).