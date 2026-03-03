# Saven — Development Phases

This document describes the development process for Saven, aligned with [REQUIREMENTS.md](REQUIREMENTS.md). Phases can be run in order; Phase 0 may run in parallel with Phase 1.

---

## Phase 0 — Infrastructure (Terraform)

**Goal:** Provision and configure all AWS resources so the rest of the app can be built and deployed.

**Prerequisites:** AWS account, Terraform installed, backend for state (e.g. S3 + DynamoDB) if working in a team.

**Deliverables:**
- Terraform code (modules suggested: `auth`, `api`, `data`, `frontend`)
- Applied infrastructure: API Gateway (HTTP API), Lambda execution roles and log groups, DynamoDB tables (or Aurora), Cognito user pool and app client, S3 buckets (app assets, exports), CloudFront distribution, IAM policies, Parameter Store (placeholder or empty), optional EventBridge rules
- State stored in S3 + DynamoDB backend (for locking and team use)
- Separate `tfvars` or workspaces for dev/staging/prod (optional)

**Key tasks:**
- Define Terraform backend (S3 bucket + DynamoDB table for state locking).
- Create DynamoDB tables and GSIs per data model (Users, Groups, GroupMembers, Categories, Transactions) or Aurora/RDS if chosen.
- Create Cognito user pool and app client(s).
- Create API Gateway (HTTP API), Lambda placeholder or minimal function, and integration.
- Create S3 buckets (app hosting, export artifacts) and CloudFront distribution with OAI.
- Create IAM roles for Lambda (DynamoDB, S3, Parameter Store, CloudWatch).
- Add Parameter Store parameters (SecureString) for Telegram bot token (values can be placeholders until Phase 6).
- Document outputs (API URL, Cognito User Pool ID/Client ID, bucket names, CloudFront URL).

**Done when:** `terraform apply` succeeds; API Gateway and Cognito endpoints are reachable; Lambda can read/write DynamoDB and S3.

---

## Phase 1 — Core Data Model

**Goal:** Define and implement the persistent data model and access patterns.

**Prerequisites:** Phase 0 (DynamoDB or Aurora provisioned).

**Deliverables:**
- Finalized schema: Users (or Cognito as source of truth), Groups, GroupMembers, Categories, Transactions (date, amount, categoryId, groupId, userId, createdBy, createdAt, updatedAt).
- DynamoDB GSIs (or SQL schema) supporting: list by user, by group, by date/day/month/range.
- Seed or migration approach for default categories if needed.

**Key tasks:**
- Lock in entity design and primary keys / sort keys for DynamoDB (or tables and indexes for Aurora).
- Implement GSIs for queries: e.g. by groupId+date, by userId+date, by groupId for members/categories.
- Add audit fields (createdAt, updatedAt, createdBy) to Transactions and any other mutable entities.
- Document access patterns and example queries for API implementation.
- Optionally seed default categories per group or globally.

**Done when:** Tables/GSIs exist and support all required list/filter patterns (by day, month, date range, group, user).

---

## Phase 2 — Auth (Cognito + API Protection)

**Goal:** Users can sign up, sign in, and call the API with a valid JWT.

**Prerequisites:** Phase 0 (Cognito and API Gateway exist).

**Deliverables:**
- Working sign-up and sign-in (Cognito Hosted UI or custom UI with Amplify/Cognito SDK).
- API protected by JWT validation (API Gateway authorizer or Lambda authorizer).
- Identity passed to Lambda (e.g. `userId`/`sub` from JWT in request context).

**Key tasks:**
- Configure Cognito Hosted UI or integrate Cognito in the front-end (sign-up, sign-in, token refresh).
- Create API Gateway authorizer (JWT, Cognito as issuer) or Lambda authorizer that validates Cognito JWT.
- Ensure Lambda receives identity (e.g. `requestContext.authorizer.claims.sub`) for authorization and audit.
- Test: unauthenticated requests rejected; authenticated requests include correct user identity.

**Done when:** A user can register, log in, obtain tokens, and call a protected API endpoint with the token; Lambda can read the caller's identity.

---

## Phase 3 — CRUD APIs

**Goal:** Full create/read/update/delete for transactions, categories, and groups (and group membership) via API.

**Prerequisites:** Phases 0, 1, 2.

**Deliverables:**
- REST or HTTP API endpoints for:
  - **Transactions:** create, get by id, list by day, list by month, list by date range (filter by group/user as needed).
  - **Categories:** create, list, update, archive (or delete).
  - **Groups:** create, get, list (for user), update; **Group members:** add, remove, list.
- Authorization: only members of a group can read/write that group's data (or follow defined permission model).
- Validation and error responses (4xx) for invalid input.

**Key tasks:**
- Implement Lambda handlers (or single Lambda with router) for each resource and action.
- Map API routes to DynamoDB (or Aurora) access using patterns from Phase 1.
- Enforce group membership and permissions before allowing create/update/delete.
- Return consistent JSON shapes and error format.
- Add basic request validation (e.g. required fields, date format).

**Done when:** All CRUD operations work for transactions, categories, and groups; list by day/month/range works; only authorized users can modify data.

---

## Phase 4 — UI (Login, Dashboard, Record, List/Filter)

**Goal:** Users can log in, see a dashboard, record transactions, and view/filter transactions by date and group.

**Prerequisites:** Phases 0, 2, 3 (auth and API working).

**Deliverables:**
- Web app (React or Next.js) hosted on S3 + CloudFront or Amplify Hosting.
- Login/sign-up flow (Cognito); token stored and sent with API requests.
- Dashboard (e.g. summary by period, recent transactions).
- Record transaction form (amount, date, category, group, optional note).
- List/filter: by day, month, or date range; by group; optional search or category filter.
- Basic error handling and loading states.

**Key tasks:**
- Bootstrap React or Next.js app; configure Cognito (Amplify Auth or direct Cognito API).
- Implement API client that attaches Cognito JWT to requests (API Gateway URL from Terraform outputs).
- Build login, dashboard, "add transaction," and list/filter views.
- Deploy to S3 + CloudFront (or Amplify Hosting) via Terraform or CI.
- Configure CORS on API Gateway if needed.

**Done when:** A user can log in, add a transaction, and see transactions filtered by day, month, or date range and by group.

---

## Phase 5 — Exports (CSV, PDF)

**Goal:** Users can export transaction/report data as CSV and PDF.

**Prerequisites:** Phases 0, 1, 3 (data and API available).

**Deliverables:**
- API endpoints or actions: export as CSV (e.g. by date range, group, category); export as PDF (report/summary for same filters).
- CSV: generated in Lambda (or streamed); returned as download or via pre-signed S3 URL.
- PDF: generated in Lambda (library); for large reports, write to S3 and return download link.
- UI: "Export CSV" and "Export PDF" (or "Download report") with same filters as list view.

**Key tasks:**
- Add Lambda function(s) or routes for export (query DynamoDB/Aurora with existing access patterns; respect group/user permissions).
- Implement CSV generation (in-memory or stream); return `Content-Disposition` or upload to S3 and return URL.
- Implement PDF generation (e.g. jsPDF, PDFKit, or similar in Node/Python); use S3 for larger outputs to stay within Lambda limits.
- Expose export actions from API and call them from UI with current filters.

**Done when:** User can request CSV and PDF export for a chosen period/group; files download or open from link.

---

## Phase 6 — Telegram Bot

**Goal:** Users can record spend and view summaries via a Telegram bot after linking their Telegram identity to an app user; optional free-text entry via NLP (mini-LLM) to extract transaction data.

**Prerequisites:** Phases 0, 2, 3 (infra, auth, CRUD APIs). Bot needs API to create/read transactions and a way to associate Telegram user with app user.

**Deliverables:**
- Telegram bot token stored in Parameter Store (SecureString).
- Lambda function handling Telegram Bot API webhook (invoked by API Gateway or a public HTTPS endpoint). Webhook URL registered with Telegram.
- User linking: flow to associate a Telegram user with an existing app user (e.g. /start with magic link, or code in app that sends link token to bot).
- Bot commands: e.g. add transaction (amount, category, optional date/group), view daily/monthly/date-range summary, optionally list recent transactions or categories.
- **NLP (mini-LLM) integration:** When the user sends a free-text message (e.g. "50 on coffee yesterday", "spent 20 at groceries"), Lambda calls a chosen mini-LLM to extract structured data (amount, category, date); Lambda then creates the transaction via the existing API. Fallback to structured /command or prompts if extraction fails.
- Same authorization rules as API (only data for groups the user belongs to).

**Key tasks:**
- Create bot with [BotFather](https://t.me/botfather); store token in Parameter Store. Add Parameter to Terraform.
- Implement Lambda: receive Telegram update (POST body); verify or ignore non-Telegram traffic; parse message/callback; resolve Telegram user to app userId (via link table or token); call existing API or DynamoDB for create/list/summary; send reply via Telegram Bot API.
- Expose webhook URL (API Gateway route or dedicated endpoint); set as Telegram webhook (setWebhook). Prefer API Gateway with or without auth (e.g. validate secret in request header).
- Implement /start (and optional /link) for user linking; implement /add, /today, /month, /range (or similar) for recording and summaries.
- **Mini-LLM for NLP:** Choose and integrate a small/cost-effective LLM (e.g. AWS Bedrock small model, small open-weight model via API, or third-party "mini" LLM). Lambda sends user message to the LLM with a prompt to return structured JSON (amount, category, date, optional note); parse response and create transaction. Handle extraction failures (e.g. ask user to clarify or use /add with explicit params). Store API key or endpoint in Parameter Store if required.
- Document supported commands, link flow, and free-text format (with NLP) for users.

**Done when:** A user can link Telegram to their account, add a transaction via the bot (structured command or free-text with NLP extraction), and receive daily/monthly (or range) summary on command; data respects group membership and permissions.

---

## Phase 7 — Multi-User Polish (Permissions, Audit)

**Goal:** Clear group membership, permissions, and audit trail so multiple people can safely edit and record.

**Prerequisites:** Phases 1–4 (data model, auth, CRUD, UI).

**Deliverables:**
- Defined permission model: who can create/edit/delete in a group (e.g. only members; optional roles like admin/editor).
- Audit fields on all mutable entities (createdAt, updatedAt, createdBy); optionally lastModifiedBy.
- UI and API behavior consistent with permissions (e.g. hide/disable actions for non-members).
- Optional: "Activity" or history view showing who added/edited what (from audit fields).

**Key tasks:**
- Enforce group membership (and roles if any) in every API that mutates data; return 403 when unauthorized.
- Ensure all create/update operations set createdBy, updatedAt, createdBy (or lastModifiedBy).
- Update UI to only show "edit/delete" (or "invite") when the user has permission.
- Optionally add a simple activity feed or export that uses audit fields.

**Done when:** Only group members (or users with the right role) can modify a group's data; all changes are attributable and timestamps are recorded.

---

## Summary

| Phase | Name                     | Depends on   | Main outcome                                      |
|-------|--------------------------|--------------|---------------------------------------------------|
| 0     | Infrastructure           | —            | Terraform-managed AWS stack ready for app         |
| 1     | Core data model          | 0            | Schema and access patterns for all entities       |
| 2     | Auth                     | 0            | Sign-up/sign-in and JWT-protected API             |
| 3     | CRUD APIs                | 0, 1, 2      | Full APIs for transactions, categories, groups    |
| 4     | UI                       | 0, 2, 3      | Login, dashboard, record, list/filter             |
| 5     | Exports (CSV, PDF)       | 0, 1, 3      | Export by period/group/category                   |
| 6     | Telegram bot (+ optional NLP) | 0, 2, 3 | Record spend and view summaries; mini-LLM NLP for free-text extraction |
| 7     | Multi-user polish        | 1–4          | Permissions and audit fields enforced and visible |

---

## Process Notes

- **Testing:** Add unit tests for Lambda handlers and integration tests for API endpoints as each phase is implemented; run tests in CI (e.g. CodeBuild or GitHub Actions).
- **Environments:** Use Terraform workspaces or separate `tfvars` for dev/staging/prod; keep production Parameter Store and credentials separate.
- **Open decisions:** Resolve [Open Decisions in REQUIREMENTS.md](REQUIREMENTS.md#open-decisions-affect-scope--cost) (transaction source, currency, recurring, budgets) before or during the phases they affect (e.g. Phase 1 for schema).
- **Documentation:** Keep API contract (paths, request/response shapes) and deployment steps updated as you complete each phase.
