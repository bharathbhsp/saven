# Saven Frontend (Phase 4)

React app (Vite) for Saven: login via Cognito Hosted UI, dashboard, add transaction, list/filter transactions, export CSV/PDF.

## Setup

### How to populate `.env`

The app needs your **API URL** and **Cognito** settings. These come from Terraform after you’ve applied the infra.

**Option A — Generate `.env` from Terraform (from repo root)**

```bash
cd infra
terraform output -json | jq -r '
  "VITE_API_URL=\(.api_gateway_url.value)",
  "VITE_COGNITO_USER_POOL_ID=\(.cognito_user_pool_id.value)",
  "VITE_COGNITO_CLIENT_ID=\(.cognito_app_client_id.value)",
  "VITE_COGNITO_DOMAIN=\(.cognito_domain.value)",
  "VITE_AWS_REGION=ap-south-2"
' | sed 's/\/$//' > ../frontend/.env
```

(If you don’t have `jq`, use Option B.)

**Option B — Fill by hand**

1. From repo root, get the values:
   ```bash
   cd infra
   terraform output
   ```
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Set each variable:

   | Variable | Where it comes from | Example |
   |----------|--------------------|--------|
   | `VITE_API_URL` | `api_gateway_url` (no trailing slash) | `https://y0oiyy9ai9.execute-api.ap-south-2.amazonaws.com` |
   | `VITE_COGNITO_USER_POOL_ID` | `cognito_user_pool_id` | `ap-south-2_dCA6vBGvh` |
   | `VITE_COGNITO_CLIENT_ID` | `cognito_app_client_id` | `4d40bui9c04g4cales2cmqneeu` |
   | `VITE_COGNITO_DOMAIN` | `cognito_domain` (domain prefix only) | `saven-auth-prod` |
   | `VITE_AWS_REGION` | Same region as Terraform `aws_region` | `ap-south-2` |

**Cognito callback:** For local dev, `http://localhost:5173/` is already allowed. For production, add your CloudFront URL to Cognito callback URLs.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — Sign in uses Cognito Hosted UI; after login you can use Dashboard, Add transaction, and Transactions (with filters and Export CSV/PDF).

## Build & deploy to S3 + CloudFront

1. Set `.env` as above (use production API and Cognito values).
2. Build:

   ```bash
   npm run build
   ```

3. Upload to the app bucket (use Terraform output `app_bucket_name` and optional `cloudfront_distribution_id` for invalidation):

   ```bash
   aws s3 sync dist/ s3://$(terraform -chdir=../infra output -raw app_bucket_name)/ --delete
   aws cloudfront create-invalidation --distribution-id $(terraform -chdir=../infra output -raw cloudfront_id) --paths "/*"
   ```

Or use the script (from repo root):

```bash
./scripts/deploy-frontend.sh
```
