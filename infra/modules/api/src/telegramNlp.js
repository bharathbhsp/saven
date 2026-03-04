/**
 * Telegram free-text NLP: extract transaction fields using GPT-4o mini.
 * Returns { amount, categoryHint, date, note, groupHint? } or null.
 * See docs/telegram-mini-llm-suggestions.md.
 */
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const SSM = new SSMClient({ region: process.env.AWS_REGION || "ap-south-2" });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

let cachedApiKey = null;

async function getOpenAiKey() {
  const name = process.env.TELEGRAM_OPENAI_API_KEY_SSM;
  if (!name) return null;
  if (cachedApiKey !== null) return cachedApiKey;
  try {
    const out = await SSM.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    const key = out.Parameter?.Value;
    if (!key || key === "placeholder") {
      cachedApiKey = "";
      return "";
    }
    cachedApiKey = key;
    return key;
  } catch (e) {
    console.error("SSM get OpenAI key:", e.message);
    cachedApiKey = "";
    return "";
  }
}

const SYSTEM_PROMPT = `You extract spending/expense data from short user messages. Reply with JSON only, no other text.
Output shape: { "amount": number, "categoryHint": string, "date": "YYYY-MM-DD", "note": string or null, "groupHint": string or null }
- amount: positive number (currency units). Required.
- categoryHint: MUST be one of the provided Categories if the expense clearly fits; otherwise a short label (e.g. "coffee", "groceries"). Use "Other" only if nothing fits.
- date: ISO date YYYY-MM-DD. Use today if not stated; "yesterday" = yesterday's date.
- note: a short human-readable description of the expense (e.g. "Coffee at Blue Tokai", "Groceries at supermarket"). Generate from the message; do not use "via Telegram" or generic placeholders. Use null only if the message has no describable detail.
- groupHint: optional group name if the user mentioned one (e.g. "Household"); null otherwise.
If the message is not about recording a spend/expense, return { "amount": null } to indicate no transaction.`;

/**
 * Call GPT-4o mini to extract transaction fields from user message.
 * @param {string} userMessage - Raw message from Telegram
 * @param {{ todayDate: string, categoryNames?: string[] }} options - todayDate in YYYY-MM-DD; optional category list for context
 * @returns {Promise<{ amount: number, categoryHint: string, date: string, note?: string|null, groupHint?: string|null, fromNlp: true } | null>}
 */
async function extract(userMessage, options = {}) {
  const { todayDate, categoryNames } = options;
  const key = await getOpenAiKey();
  if (!key) {
    console.log("[Telegram NLP] GPT-4o mini skipped: no API key");
    return null;
  }

  console.log("[Telegram NLP] Calling GPT-4o mini for free-text extraction", { categoryCount: categoryNames?.length ?? 0 });

  const userContent = [
    `Today's date: ${todayDate}.`,
    categoryNames?.length
      ? `Categories (pick categoryHint from this exact list when the expense fits): ${categoryNames.join(", ")}.`
      : "",
    `User message: "${userMessage}"`,
  ].filter(Boolean).join("\n");

  let body;
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("[Telegram NLP] OpenAI API error:", res.status, t);
      return null;
    }
    body = await res.json();
  } catch (e) {
    console.error("[Telegram NLP] OpenAI request failed:", e.message);
    return null;
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    console.log("[Telegram NLP] GPT-4o mini returned no content");
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.log("[Telegram NLP] GPT-4o mini response was not valid JSON");
    return null;
  }

  if (parsed.amount == null || parsed.amount === null) {
    console.log("[Telegram NLP] GPT-4o mini indicated no transaction");
    return null;
  }

  const amount = typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount);
  if (Number.isNaN(amount) || amount <= 0) return null;

  const date = typeof parsed.date === "string" && DATE_RE.test(parsed.date)
    ? parsed.date
    : todayDate;

  const result = {
    amount,
    categoryHint: typeof parsed.categoryHint === "string" && parsed.categoryHint.trim() ? parsed.categoryHint.trim() : "Other",
    date,
    note: typeof parsed.note === "string" ? parsed.note.trim() || null : null,
    groupHint: typeof parsed.groupHint === "string" && parsed.groupHint.trim() ? parsed.groupHint.trim() : undefined,
    fromNlp: true,
  };
  console.log("[Telegram NLP] GPT-4o mini extracted", { amount: result.amount, categoryHint: result.categoryHint, date: result.date, hasNote: !!result.note });
  return result;
}

module.exports = { extract, getOpenAiKey };
