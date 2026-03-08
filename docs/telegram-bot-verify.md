# Telegram bot — how to verify it’s linked to the app

This doc describes how to check that the Saven Telegram bot is correctly connected: (1) Telegram sends updates to your API (webhook), and (2) a user’s Telegram account is linked to their Saven account.

---

## 1. Webhook (Telegram → your API)

Telegram must send updates to your API Gateway URL. If the webhook is missing or points to the wrong URL, the bot will not receive any messages.

### Check current webhook

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

- **Expected:** The response includes `"url": "https://<your-api-id>.execute-api.<region>.amazonaws.com/webhook/telegram"` (your actual API base URL + `/webhook/telegram`).
- **If `url` is empty or wrong:** Telegram is not posting to your app; set the webhook (see below).

### Set or fix the webhook

Use the **API URL** and **bot token** for the **stage** you’re testing (dev vs prod have different APIs and optionally different bots).

**Dev:**

```bash
API_URL=$(terraform -chdir=infra/dev output -raw api_gateway_url)
# Use your dev bot token (from infra/dev tfvars or SSM /saven-dev/telegram/bot-token)
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=${API_URL}/webhook/telegram"
```

**Prod:**

```bash
API_URL=$(terraform -chdir=infra/prod output -raw api_gateway_url)
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=${API_URL}/webhook/telegram"
```

Replace `<TOKEN>` with the same bot token stored in Terraform/SSM for that stage. After setting, call `getWebhookInfo` again to confirm `url` is correct.

---

## 2. User account link (Telegram user ↔ Saven user)

Each user must link their Telegram account to their Saven account once. Until then, the bot cannot attribute messages to a Saven user or record transactions.

### Check in the app

1. Sign in to the Saven app (web or frontend).
2. Go to **Settings** → **Connect Telegram**.
3. If the account is linked, it shows **“Linked”** and optionally your Telegram username.
4. If not linked, generate a code in the app, then in Telegram send **`/link <code>`** to your bot.

### Check via API

With a valid JWT (from signing in to the app), call:

```http
GET /telegram/link
Authorization: Bearer <id_token>
```

- **Linked:** `{ "linked": true, "defaultGroupId": "..." }`
- **Not linked:** `{ "linked": false }`

---

## 3. End-to-end check

1. In Telegram, open a chat with your bot and send **`/start`** or **`/today`**.
2. If the webhook and user link are correct, the bot should reply (e.g. welcome message or today’s summary).
3. If there is **no reply**:
   - Confirm the webhook URL with `getWebhookInfo` (step 1).
   - Check **API Gateway** and **Lambda** logs for requests to `POST /webhook/telegram`.
   - Ensure the **bot token in SSM** for that stage (e.g. `/saven-dev/telegram/bot-token` or `/saven-prod/telegram/bot-token`) is the same bot you’re messaging in Telegram.

---

## Common issues

| Issue | What to check |
|-------|----------------|
| Bot never replies | Webhook URL set? Same token in SSM as in `setWebhook`? Lambda logs for errors? |
| “Not linked” in app | Generate code in app and send `/link <code>` in Telegram. |
| Wrong stage | Dev frontend must use dev API/Cognito; dev bot must use dev webhook and dev SSM token. Same for prod. |
| Webhook points to wrong env | Call `setWebhook` with the API URL from the stage you’re testing (`infra/dev` or `infra/prod`). |

---

## See also

- [api.md](api.md) — Telegram endpoints and bot commands.
- [infra/README.md](../infra/README.md) — Telegram bot setup (token, webhook registration, linking).
- [telegram-bot-suggestions.md](telegram-bot-suggestions.md) — Group selection, multi-user, and link behaviour.
