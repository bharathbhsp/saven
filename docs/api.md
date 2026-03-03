# Saven — API Contract (Phases 2–5)

Base URL: API Gateway HTTP API URL (from Terraform output `api_gateway_url`). All routes except **GET /health** require a valid Cognito JWT in the `Authorization: Bearer <id_token>` header.

---

## Authentication (Phase 2)

- **GET /health** — No auth. Returns `{ "status": "ok", "phase": 2 }`.
- All other routes require **JWT** (Cognito ID token). Unauthenticated requests receive **401**. Lambda receives the caller identity as `requestContext.authorizer.jwt.claims.sub` (use as `userId`).

---

## Error format

All errors return JSON:

```json
{ "error": "Code", "message": "Human-readable message" }
```

| Status | Meaning |
|--------|--------|
| 400 | BadRequest — Invalid input (missing/invalid fields) |
| 401 | Unauthorized — Missing or invalid token |
| 403 | Forbidden — Not a member of the group |
| 404 | NotFound — Resource not found |
| 500 | InternalServerError |

---

## Groups

| Method | Path | Description |
|--------|------|-------------|
| GET | /groups | List groups the user is a member of |
| POST | /groups | Create group (body: `{ "name": "string" }`); caller becomes admin member |
| GET | /groups/:groupId | Get group (must be member) |
| PATCH | /groups/:groupId | Update group name (body: `{ "name": "string" }`) |

---

## Group members

| Method | Path | Description |
|--------|------|-------------|
| GET | /groups/:groupId/members | List members (must be member) |
| POST | /groups/:groupId/members | Add member (body: `{ "userId": "cognito-sub" }`) |
| DELETE | /groups/:groupId/members/:userId | Remove member |

---

## Categories

| Method | Path | Description |
|--------|------|-------------|
| GET | /groups/:groupId/categories | List categories (GLOBAL + group); excludes archived |
| POST | /groups/:groupId/categories | Create category (body: `{ "name": "string" }`) |
| GET | /groups/:groupId/categories/:categoryId | Get one category |
| PATCH | /groups/:groupId/categories/:categoryId | Update name or archive (body: `{ "name"?, "archived"? }`) |
| DELETE | /groups/:groupId/categories/:categoryId | Archive category (soft delete) |

---

## Transactions

| Method | Path | Description |
|--------|------|-------------|
| GET | /groups/:groupId/transactions | List. Query: **one of** `day=YYYY-MM-DD`, `month=YYYY-MM`, or `startDate` + `endDate` (YYYY-MM-DD) |
| POST | /groups/:groupId/transactions | Create. Body: `{ "amount": number, "date": "YYYY-MM-DD", "categoryId": "string", "note"?: "string" }` |
| GET | /groups/:groupId/transactions/:transactionId | Get one. Query: `date=YYYY-MM-DD` required |
| PATCH | /groups/:groupId/transactions/:transactionId | Update. Body: `{ "date": "YYYY-MM-DD" (required), "amount"?, "categoryId"?, "note"? }` |
| DELETE | /groups/:groupId/transactions/:transactionId | Delete. Query or body: `date=YYYY-MM-DD` required |

---

## Response shapes (success)

- **GET /health:** `{ "status": "ok", "phase": 2 }`
- **Groups:** `{ "group" }` or `{ "groups": [] }`
- **Members:** `{ "member" }` or `{ "members": [] }`
- **Categories:** `{ "category" }` or `{ "categories": [] }`
- **Transactions:** `{ "transaction" }` or `{ "transactions": [] }`

All create/update responses return the created or updated resource object.

---

## Exports (Phase 5)

| Method | Path | Description |
|--------|------|-------------|
| GET | /groups/:groupId/export/csv | Export transactions as CSV. Query: `startDate`, `endDate` (YYYY-MM-DD), optional `categoryId` |
| GET | /groups/:groupId/export/pdf | Export transactions as PDF report. Query: same as CSV |

Returns file download (`Content-Disposition: attachment`). CSV: `text/csv`; PDF: `application/pdf`. Requires group membership.
