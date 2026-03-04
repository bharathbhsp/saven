# Telegram free-text: mini-LLM suggestions and cost breakdown

Use a small/cheap LLM to parse incoming Telegram messages into structured transaction data (amount, category, date, note) and optionally suggest a category from the user’s list. Fall back to the existing regex parser when the LLM is unavailable or extraction fails.

**Decision:** Use **GPT-4o mini** (OpenAI) for parsing and suggesting transaction data. Store the OpenAI API key in AWS SSM Parameter Store; Lambda calls the OpenAI API from the Telegram webhook path. See [REQUIREMENTS.md](REQUIREMENTS.md) (Integrations, NLP) and [api.md](api.md) (Telegram free-text).

---

## 1. Integration approach

- **When:** For free-text messages (not `/add` or other commands), optionally call the LLM **first**; if it returns valid JSON, use it to create the transaction; otherwise fall back to current regex `parseFreeText()`.
- **Prompt:** Send the user message + context (e.g. today’s date, optional list of category names for the chosen group). Ask for **structured JSON only**, e.g. `{ "amount": number, "categoryHint": string, "date": "YYYY-MM-DD", "note": string | null }`.
- **Category suggestion:** Either (A) pass the user’s categories in the prompt and ask the LLM to pick the best match (by name or description), or (B) get `categoryHint` from the LLM and continue using your existing `resolveCategoryId()` (fuzzy match). (B) is simpler and keeps one source of truth.
- **Validation:** Validate amount > 0, date format; if invalid, fall back to regex or ask the user to clarify.
- **Secrets:** Store the OpenAI API key in SSM Parameter Store (e.g. `/saven-{env}/telegram/openai-api-key`); Lambda reads it at runtime.

---

## 2. Model / provider options (cost-effective “mini” LLMs)

| Provider | Model | Typical use | Input (per 1M tokens) | Output (per 1M tokens) | Notes |
|----------|--------|-------------|------------------------|--------------------------|--------|
| **AWS Bedrock** | Claude 3 Haiku | InvokeModel API | ~$0.25 | ~$1.25 | AWS-native, no extra key; IAM only. |
| **AWS Bedrock** | Amazon Titan Text G1 – Express | InvokeModel API | ~$0.0008 | ~$0.0016 | Cheapest on Bedrock; quality lower than Haiku. |
| **OpenAI** | gpt-4o-mini | REST API | ~$0.15 | ~$0.60 | Very good for short, structured extraction. |
| **Anthropic** | Claude 3 Haiku | REST API | ~$0.25 | ~$1.25 | Strong instruction following. |
| **Google** | Gemini 1.5 Flash | REST API | ~$0.075 | ~$0.30 | Cheap, fast. |
| **Groq** | Llama 3 8B (e.g. llama-3-8b-8192) | REST API | Free tier then low cost | Free tier then low cost | Very fast; free tier limits. |
| **Together** | Small Llama/Mistral | REST API | Often &lt;$0.20 / 1M | Similar | Good for small payloads. |

*Prices are approximate and per region; check each provider’s pricing page.*

---

## 3. Cost breakdown (order-of-magnitude)

Assume **one free-text message** ≈ 1 request:

- **Input:** User message ~20 tokens + system prompt ~150 tokens + category list ~50 tokens ≈ **220 input tokens**.
- **Output:** JSON only ≈ **30–50 output tokens**.

**Per 1,000 free-text messages (LLM path):**

| Provider | Model | Input cost | Output cost | Total (approx) |
|----------|--------|------------|-------------|----------------|
| AWS Bedrock | Titan Text Express | ~$0.0002 | ~$0.0001 | **~$0.0003** |
| AWS Bedrock | Claude 3 Haiku | ~$0.055 | ~$0.06 | **~$0.12** |
| OpenAI | gpt-4o-mini | ~$0.033 | ~$0.03 | **~$0.06** |
| Google | Gemini 1.5 Flash | ~$0.017 | ~$0.015 | **~$0.03** |
| Groq | Llama 3 8B | Free tier | Free tier | **$0** within limits |

So for **10,000 messages/month** in the LLM path: Bedrock Haiku ~**$1.20**, gpt-4o-mini ~**$0.60**, Gemini Flash ~**$0.30**, Titan ~**$0.003**. Lambda + API Gateway costs for the same traffic are usually on the order of a few dollars; the LLM can be the main variable cost if you use Haiku, or negligible if you use Titan or Gemini Flash.

---

## 4. Chosen approach: GPT-4o mini

**Use GPT-4o mini** for the Telegram free-text NLP path:

- **Quality:** Strong at short, structured extraction and JSON output; fits "amount + category + date + note" well.
- **Cost:** ~$0.06 per 1,000 free-text messages (see table above); ~$0.60 per 10,000 messages/month.
- **Integration:** Lambda calls OpenAI API; store the API key in SSM (e.g. `/saven-{env}/telegram/openai-api-key`). Use **JSON mode** or a strict response format so the model returns only parseable JSON.
- **Fallback:** Keep the current regex parser: try GPT-4o mini first; on failure, timeout, or missing key, use `parseFreeText()` so the bot works without the LLM.

Implementation sketch:

- Add a small module (e.g. `telegramNlp.js`) that:
  - Takes `(userMessage, options: { todayDate, categoryNames? })`.
  - Builds a short system + user prompt asking for **JSON only** (leverage GPT-4o mini JSON mode if available).
  - Calls **OpenAI API** (`gpt-4o-mini`), parses JSON, validates amount/date.
  - Returns `{ amount, categoryHint, date, note }` or `null` on failure.
- In the Telegram free-text branch: if `telegramNlp.extract()` returns a result, use it; else use `parseFreeText(text)` and existing flow.
- Store the OpenAI API key in SSM (e.g. `/saven-{env}/telegram/openai-api-key`); ensure Lambda has read permission.

---

## 5. Optional: category suggestion only

If you want to **only** use the LLM to suggest a category (and keep amount/date from regex):

- Run regex first to get amount and date.
- Send “category hint” (e.g. “coffee”) + list of category names to the LLM; ask for the single best-matching category name or id.
- Use that to set `categoryId` (or fall back to `resolveCategoryId` with the hint).

This cuts LLM tokens (no need to extract amount/date) and cost further.
