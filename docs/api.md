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
| POST | /groups/:groupId/members | Add member (body: `{ "email": "user@example.com" }`; resolves to Cognito user) |
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

---

## Telegram (Phase 6)

### Webhook (no auth)

Telegram servers POST updates to the webhook URL. No JWT.

| Method | Path | Description |
|--------|------|-------------|
| POST | /webhook/telegram | Telegram Bot API webhook. Receives update payload; bot replies via Telegram. |

After deployment, register the webhook with Telegram:  
`https://api.telegram.org/bot<TOKEN>/setWebhook?url=<API_URL>/webhook/telegram`

### Link and default group (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | /telegram/link-code | Create a one-time 6-digit code. Body: none. Returns `{ "code": "123456", "expiresIn": 600 }`. User sends `/link <code>` to the bot to link Telegram to their account. |
| GET | /telegram/link | Get link status. Returns `{ "linked": true, "defaultGroupId": "..." }` or `{ "linked": false }`. |
| PATCH | /telegram/link | Set or clear default group for Telegram (Option B). Body: `{ "defaultGroupId": "groupId" \| null }`. |
| POST | /telegram/chat-link-code | Create a one-time code for linking a Telegram group to a Saven group (Option C). Body: `{ "groupId": "..." }`. Returns `{ "code", "expiresIn" }`. In the Telegram group, send `/linkgroup <code>`. |
| GET | /telegram/chat-links | List Telegram groups linked to the user’s Saven groups. Returns `{ "links": [ { "groupId", "groupName", "telegramChatId" } ] }`. |

---

## Telegram bot commands and flow

- **Link account:** In the Saven app go to Settings → Connect Telegram, generate a code, then in Telegram send `/link <code>` to the bot.
- **Default group (Option B):** In Settings → “Default group for Telegram”, choose a group so the bot records to it when you don’t specify one.
- **Link Telegram group (Option C):** In Settings → “Link Telegram group”, select a Saven group and generate a code. Add the bot to the Telegram group, then in that group send `/linkgroup <code>`. Messages in that Telegram group will record to that Saven group (only linked members can post).
- **Commands (after linking):**
  - `/start` — Help and command list.
  - `/add <amount> <category> [date] [group]` — Record spend (Option A: optional group name or id at end). Example: `/add 50 Food`, `/add 50 Food Household`, `/add 50 Food 2025-03-01`.
  - `/today` — Today’s summary (all groups).
  - `/month [YYYY-MM]` — Monthly summary (default: current month).
  - `/range <start> <end>` — Summary for date range (YYYY-MM-DD).
  - `/linkgroup <code>` — Link this Telegram group to a Saven group (use code from app; only in group/supergroup chats).
- **Free text:** The bot parses e.g. `50 coffee`, `50 coffee Household`, `spent 20 on groceries yesterday`. Category is matched by name (or “Other” if none match). Optional group name at end (Option A).
- **Group resolution order:** Explicit group in message (Option A) → Telegram chat–linked Saven group (Option C) → Default group from link (Option B) → first group.
