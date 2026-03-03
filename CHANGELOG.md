# Changelog

All notable phase deliverables and changes are documented here. Phases follow [docs/dev-phases.md](docs/dev-phases.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

- Phase 2 — Auth (Cognito + API protection)
- Phase 3 — CRUD APIs
- Phase 4 — UI (login, dashboard, record, list/filter)
- Phase 5 — Exports (CSV, PDF)
- Phase 6 — Google Sheets integration
- Phase 7 — Telegram bot (+ optional NLP)
- Phase 8 — Multi-user polish (permissions, audit)

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

[Unreleased]: https://github.com/your-org/saven/compare/v0.1.0...HEAD  
[0.1.0]: https://github.com/your-org/saven/releases/tag/v0.1.0
