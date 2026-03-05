# Changelog

All notable phase deliverables and changes are documented here. Phases follow [docs/dev-phases.md](docs/dev-phases.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

- Phase 6 — Google Sheets integration
- Phase 7 — Telegram bot (+ optional NLP)
- Phase 8 — Multi-user polish (permissions, audit)

---

## [0.3.0] — Phase 4 & Phase 5

### Phase 4 — UI (Login, Dashboard, Record, List/Filter)

- **Frontend:** React (Vite) app in `frontend/`; build output `dist/` for S3 + CloudFront
- **Auth:** Cognito Hosted UI; token from redirect hash stored in sessionStorage; API client sends `Authorization: Bearer <id_token>`
- **Pages:** Login (redirect to Hosted UI), Dashboard (group selector, month total, recent transactions), Add transaction (form: group, amount, date, category, note), Transactions (filter by day/month/range, group selector)
- **Env:** `VITE_API_URL`, `VITE_COGNITO_*`, `VITE_AWS_REGION`; see `frontend/.env.example`
- **Deploy:** `npm run build` then sync `dist/` to S3; optional CloudFront invalidation; script `scripts/deploy-frontend.sh`

### Phase 5 — Exports (CSV, PDF)

- **API:** GET `/groups/:groupId/export/csv` and `/groups/:groupId/export/pdf` with query `startDate`, `endDate`, optional `categoryId`; same auth and group membership as transactions
- **CSV:** In-memory generation; `Content-Disposition: attachment`; columns Date, Amount, Category ID, Note
- **PDF:** PDFKit in Lambda; table report (date, amount, category, note); optional dependency (`npm install` in `backend/` for PDF; CSV works without it)
- **UI:** Transactions page has "Export CSV" and "Export PDF" using current filter (day/month/range)

### Done when (Phase 4 & 5)

- User can log in, add a transaction, see transactions filtered by day/month/range and by group; user can export CSV and PDF for chosen period/group.

---

## [0.2.0] — Phase 2 & Phase 3

### Phase 2 — Auth (Cognito + API Protection)

- API Gateway JWT authorizer (Cognito as issuer); `Authorization: Bearer <id_token>` required for all routes except health
- Public **GET /health** route (no auth) for health checks
- Identity passed to Lambda as `requestContext.authorizer.jwt.claims.sub` (userId for authorization and audit)
- Unauthenticated requests to protected routes return 401 from API Gateway

### Phase 3 — CRUD APIs

- Single Lambda router (`backend/`) with handlers for groups, members, categories, transactions
- **Groups:** GET list (for user), POST create, GET by id, PATCH update
- **Group members:** GET list, POST add, DELETE remove
- **Categories:** GET list (GLOBAL + group), POST create, GET by id, PATCH update/archive, DELETE (archive)
- **Transactions:** GET list (query: day, month, or startDate/endDate), POST create, GET by id (?date=), PATCH update, DELETE
- Group membership enforced: only members can read/write group data (403 otherwise)
- Request validation (required fields, date YYYY-MM-DD, amount number); consistent error JSON `{ error, message }`
- API contract documented in [docs/api.md](docs/api.md)

### Done when (Phase 2 & 3)

- User can call protected endpoints with Cognito JWT; Lambda receives caller identity.
- All CRUD operations work for transactions, categories, groups, and members; list by day/month/range works; only authorized users can modify data.

---

## [0.1.0] — Phase 0 & Phase 1

### Phase 0 — Infrastructure (Terraform)

- Terraform modules: `auth`, `api`, `data`, `frontend`
- Cognito user pool, app client, hosted UI domain; optional Google (Gmail) login
- DynamoDB tables: groups, group_members, categories, transactions (with GSIs)
- API Gateway HTTP API, Lambda placeholder, IAM and CloudWatch log group
- S3 buckets (app, exports), CloudFront distribution with OAI
- SSM Parameter Store placeholders for Google credentials and Telegram bot token
- Backend: local state by default; S3 + DynamoDB optional for team use

### Phase 1 — Core Data Model

- **Schema finalized:** Users = Cognito; Groups, GroupMembers, Categories, Transactions defined
- **DynamoDB keys and GSIs:**
  - **Groups:** PK `id`
  - **GroupMembers:** PK `groupId`, SK `userId`; GSI `by-user` (userId, groupId)
  - **Categories:** PK `groupId`, SK `categoryId` (groupId = "GLOBAL" for shared)
  - **Transactions:** PK `groupId`, SK `sk` (date#transactionId); GSI `by-user-date` (userId, sk)
- **Audit fields:** createdAt, updatedAt, createdBy documented for Transactions and mutable entities
- **Access patterns:** List by user, by group, by date/day/month/range documented with example DynamoDB queries
- **Docs:** [docs/data-model.md](docs/data-model.md) — entity design, keys, GSIs, audit fields, default categories seed approach

### Done when (Phase 1)

- Tables and GSIs exist and support all required list/filter patterns (by day, month, date range, group, user).

---

[Unreleased]: https://github.com/your-org/saven/compare/v0.3.0...HEAD  
[0.3.0]: https://github.com/your-org/saven/compare/v0.2.0...v0.3.0  
[0.2.0]: https://github.com/your-org/saven/compare/v0.1.0...v0.2.0  
[0.1.0]: https://github.com/your-org/saven/releases/tag/v0.1.0
