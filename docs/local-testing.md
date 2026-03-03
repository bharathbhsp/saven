# Saven — Local Testing Strategy

Ways to test the app locally. The backend is a **Node.js Lambda** behind API Gateway; the **UI** is in `frontend/` (Phase 4). Use one or more of the approaches below depending on what you’re testing.

---

## 1. Test against deployed AWS (recommended for real E2E)

**Use when:** You want to verify the full stack (API Gateway → Lambda → DynamoDB, Cognito auth).

### Setup

1. **Provision infra**
   ```bash
   cd infra
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

2. **Get outputs**
   ```bash
   terraform output api_gateway_url
   terraform output cognito_user_pool_id
   terraform output cognito_app_client_id
   terraform output cognito_domain
   ```

3. **Create a test user** (if needed)  
   AWS Console → Cognito → your User Pool → Users → Create user, or use Hosted UI sign-up.

4. **Get a JWT**
   - **Option A:** Sign in via Cognito Hosted UI:  
     `https://<cognito_domain>.auth.<region>.amazoncognito.com/login?client_id=<client_id>&response_type=token&scope=openid&redirect_uri=https://example.com`  
     After login, copy the `id_token` from the redirect URL fragment.
   - **Option B:** Use AWS CLI (initiate auth) and parse the ID token from the response.

### Test the API

- **Health (no auth):**
  ```bash
  curl -s "$(terraform -chdir=infra output -raw api_gateway_url)/health"
  ```

- **Protected route (with JWT):**
  ```bash
  export API_URL="$(terraform -chdir=infra output -raw api_gateway_url)"
  export ID_TOKEN="<paste_id_token_here>"
  curl -s -H "Authorization: Bearer $ID_TOKEN" "$API_URL/groups"
  ```

Use Postman/Insomnia with the same base URL and `Authorization: Bearer <id_token>` for all non-health routes.

### Run the frontend locally (Phase 4)

1. From repo root, create `frontend/.env` with the same outputs (see `frontend/.env.example`).
2. Run `cd frontend && npm install && npm run dev`.
3. Open http://localhost:5173 — Sign in uses Cognito Hosted UI; callback is already allowed for `http://localhost:5173/`.

---

## 2. Invoke Lambda locally (same code, real AWS DynamoDB)

**Use when:** You’re changing Lambda code and want fast feedback without redeploying API Gateway.

Lambda runs on your machine; it still talks to **real DynamoDB** (and needs real table names). Auth is simulated via the test event.

### Setup

1. **Apply Terraform** so DynamoDB tables and Lambda exist. Get table names:
   ```bash
   cd infra && terraform output
   # Note the table names from the data module (e.g. saven-dev-groups, ...)
   ```

2. **Use the sample test events** in `infra/modules/api/test-events/`:
   - `health.json` — GET /health (no auth)
   - `groups-list.json` — GET /groups; replace `REPLACE_WITH_COGNITO_SUB` with a real Cognito user `sub` (or a test user ID if you’ve added that user as a member in DynamoDB)

3. **Invoke the handler with the same env as deployed**  
   Table names must match your deployed tables. Either:
   - **Option A — Update Lambda in AWS and invoke it locally:**  
     After code changes, run `terraform apply` (or a small script that only updates the Lambda zip), then:
     ```bash
     aws lambda invoke \
       --function-name saven-dev-api \
       --payload fileb://infra/modules/api/test-events/health.json \
       --cli-binary-format raw-inline-base64 \
       out.json && cat out.json
     ```
   - **Option B — Run the handler in Node with env vars:**  
     From repo root, with AWS credentials and region set:
     ```bash
     cd infra/modules/api/src
     export GROUPS_TABLE=saven-dev-groups
     export GROUP_MEMBERS_TABLE=saven-dev-group_members
     export CATEGORIES_TABLE=saven-dev-categories
     export TRANSACTIONS_TABLE=saven-dev-transactions
     node -e "
     const handler = require('./index').handler;
     const event = require('../test-events/health.json');
     handler(event).then(r => console.log(JSON.stringify(r, null, 2)));
     "
     ```
     Replace table names with your Terraform outputs. The Lambda code uses `aws-sdk` and will use your default AWS credentials and region.

### Getting a real `sub` for local invoke

Use the same Cognito Hosted UI or CLI flow as in strategy 1 to get an ID token, decode the JWT payload (e.g. [jwt.io](https://jwt.io)), and put that `sub` into `requestContext.authorizer.jwt.claims.sub` in your test event so membership checks work against real DynamoDB data.

---

## 3. Local HTTP server (future-friendly for UI dev)

**Use when:** You plan to add a React/Next.js app and want a local API that behaves like the real one, with optional mocked auth.

Idea: run a small Express (or similar) server that:

- Imports the same **router** and **handlers** from `infra/modules/api/src`.
- Forwards `req.method`, `req.path`, `req.query`, and `req.body` into a synthetic API Gateway event, then calls `handler(event)`.
- Sets `process.env.GROUPS_TABLE`, etc., to either:
  - **Real tables** (same as strategy 2), or  
  - **DynamoDB Local** table names (run DynamoDB Local and create tables with the same schema).

For auth you can:

- **Option A:** Require a real JWT and pass `requestContext.authorizer.jwt.claims` from the decoded token.
- **Option B:** In dev, accept a header like `X-Test-User-Id: <sub>` and inject that as `claims.sub` so you don’t need Cognito for every run.

This is not in the repo yet; it’s a good next step once you start Phase 4 (UI).

---

## 4. DynamoDB Local (fully offline backend)

**Use when:** You want to test without hitting AWS (no credentials, no cost).

1. Run DynamoDB Local (Docker or standalone).
2. Create tables with the **same names and key schema** as in [docs/data-model.md](data-model.md) (and as created by Terraform in `infra/modules/data`).
3. Point the Lambda code at DynamoDB Local by setting `AWS_DYNAMODB_ENDPOINT=http://localhost:8000` and configuring the DynamoDB client in `db.js` to use that endpoint.
4. Run the handler via strategy 2 (Node one-liner or a small script) or strategy 3 (local HTTP server), with table names matching your local tables.

Auth can be mocked (e.g. fixed `sub` in the test event or `X-Test-User-Id` in the local server).

---

## Summary

| Goal | Approach |
|------|----------|
| End-to-end with real auth and data | **1. Deployed AWS** — Terraform apply, Cognito user, curl/Postman with JWT |
| Fast Lambda iteration against real DB | **2. Invoke Lambda locally** — Same env vars + test event; real tables |
| Prepare for UI and local dev | **3. Local HTTP server** — Express wrapping the same handler; real or local DB |
| Fully offline | **4. DynamoDB Local** — Same schema + endpoint override; optional mock auth |

Recommended default: use **1** to validate the full flow and **2** (Node + env vars) for day-to-day API changes without redeploying the whole stack.
