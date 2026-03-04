/**
 * Phase 6 — Telegram bot webhook handler.
 * Commands: /start, /link <code>, /add, /today, /month, /range; free-text for quick add.
 */
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { doc, TABLES, now, uuid } = require("./db");

const SSM = new SSMClient({ region: process.env.AWS_REGION || "ap-south-2" });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getToken() {
  const name = process.env.TELEGRAM_BOT_TOKEN_SSM;
  if (!name) return null;
  try {
    const out = await SSM.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    const token = out.Parameter?.Value;
    if (!token || token === "placeholder") return null;
    return token;
  } catch (e) {
    console.error("SSM get telegram token:", e.message);
    return null;
  }
}

function getChatAndUser(update) {
  const msg = update.message || update.edited_message;
  if (msg) return { chatId: msg.chat?.id, telegramUserId: String(msg.from?.id ?? ""), text: (msg.text || "").trim() };
  return null;
}

async function getLinkedUserId(telegramUserId) {
  if (!telegramUserId || !TABLES.telegram_links) return null;
  const r = await doc.get({
    TableName: TABLES.telegram_links,
    Key: { telegramUserId },
  }).promise();
  return r.Item?.userId ?? null;
}

async function sendMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) console.error("Telegram sendMessage:", await res.text());
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Parse /add 50 Food [YYYY-MM-DD] or /add 50 categoryName */
function parseAddArgs(text) {
  const rest = text.replace(/^\s*\/add\s*/i, "").trim();
  const parts = rest.split(/\s+/);
  if (parts.length < 2) return { err: "Use: /add &lt;amount&gt; &lt;category&gt; [date]\nExample: /add 50 Food" };
  const amount = parseFloat(parts[0]);
  if (Number.isNaN(amount) || amount <= 0) return { err: "Amount must be a positive number." };
  const categoryPart = parts[1];
  const datePart = parts[2];
  const date = datePart && DATE_RE.test(datePart) ? datePart : todayStr();
  return { amount, categoryHint: categoryPart, date };
}

/** Simple free-text: "50 coffee", "20 groceries yesterday", "spent 100 on food" */
function parseFreeText(text) {
  const t = text.trim();
  const spent = t.match(/spent?\s+(\d+(?:\.\d+)?)\s+(?:on\s+)?(.+)/i);
  if (spent) {
    const amount = parseFloat(spent[1]);
    const rest = spent[2].trim();
    let date = todayStr();
    const yesterday = rest.match(/(yesterday|yday)/i);
    if (yesterday) date = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const catPart = rest.replace(/(yesterday|yday)\s*/gi, "").trim() || "Other";
    return { amount, categoryHint: catPart, date };
  }
  const simple = t.match(/^(\d+(?:\.\d+)?)\s+(?:on\s+)?(.+?)(?:\s+(yesterday|today))?$/i);
  if (simple) {
    const amount = parseFloat(simple[1]);
    let date = todayStr();
    if (simple[3] && simple[3].toLowerCase() === "yesterday") date = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    return { amount, categoryHint: simple[2].trim(), date };
  }
  const justAmount = t.match(/^(\d+(?:\.\d+)?)\s*$/);
  if (justAmount) return { amount: parseFloat(justAmount[1]), categoryHint: "Other", date: todayStr() };
  return null;
}

async function resolveCategoryId(groupId, categoryHint, userId) {
  const groups = require("./handlers/groups");
  const categories = require("./handlers/categories");
  const listRes = await categories.list({ groupId }, {}, userId);
  if (listRes.statusCode !== 200) return null;
  let list;
  try {
    list = JSON.parse(listRes.body);
  } catch {
    return null;
  }
  const cats = list.categories || [];
  const hint = categoryHint.toLowerCase();
  const byName = cats.find((c) => c.name && c.name.toLowerCase() === hint);
  if (byName) return byName.categoryId;
  const byId = cats.find((c) => c.categoryId === categoryHint);
  if (byId) return byId.categoryId;
  const fuzzy = cats.find((c) => c.name && c.name.toLowerCase().includes(hint));
  if (fuzzy) return fuzzy.categoryId;
  return "default-other";
}

async function handleMessage(telegramUserId, chatId, text, token, userId) {
  const groups = require("./handlers/groups");
  const transactions = require("./handlers/transactions");
  const categories = require("./handlers/categories");

  if (!text) return;

  if (text === "/start" || text.startsWith("/start ")) {
    await sendMessage(token, chatId,
      "👋 <b>Saven</b> — track spend from Telegram.\n\n" +
      "Commands:\n" +
      "• /add &lt;amount&gt; &lt;category&gt; [date] — record spend\n" +
      "• /today — today's summary\n" +
      "• /month [YYYY-MM] — monthly summary\n" +
      "• /range &lt;start&gt; &lt;end&gt; — summary for date range\n" +
      "• Or send free text: <i>50 coffee</i>, <i>spent 20 on groceries yesterday</i>\n\n" +
      "You're linked. Use /add or type an amount and category.");
    return;
  }

  if (text.startsWith("/link ")) {
    await sendMessage(token, chatId, "You are already linked. To link another device, use the Saven app to generate a new code.");
    return;
  }

  if (text.startsWith("/add ")) {
    const parsed = parseAddArgs(text);
    if (parsed.err) {
      await sendMessage(token, chatId, parsed.err);
      return;
    }
    const listRes = await groups.list({}, {}, userId);
    if (listRes.statusCode !== 200) {
      await sendMessage(token, chatId, "Could not load your groups.");
      return;
    }
    let groupList;
    try {
      groupList = JSON.parse(listRes.body);
    } catch {
      await sendMessage(token, chatId, "Error loading groups.");
      return;
    }
    const userGroups = groupList.groups || [];
    if (userGroups.length === 0) {
      await sendMessage(token, chatId, "Create a group first in the Saven app.");
      return;
    }
    const groupId = userGroups[0].id;
    const categoryId = await resolveCategoryId(groupId, parsed.categoryHint, userId);
    const createRes = await transactions.create(
      { groupId },
      { amount: parsed.amount, date: parsed.date, categoryId, note: "via Telegram" },
      userId
    );
    if (createRes.statusCode === 201) {
      let body;
      try {
        body = JSON.parse(createRes.body);
      } catch {
        body = {};
      }
      const tx = body.transaction;
      await sendMessage(token, chatId, `✅ Recorded ${tx.amount} on ${tx.date} (${tx.categoryId}).`);
    } else {
      let msg = "Failed to add transaction.";
      try {
        const err = JSON.parse(createRes.body);
        if (err.message) msg = err.message;
      } catch (_) {}
      await sendMessage(token, chatId, msg);
    }
    return;
  }

  if (text === "/today") {
    const listRes = await groups.list({}, {}, userId);
    if (listRes.statusCode !== 200) {
      await sendMessage(token, chatId, "Could not load groups.");
      return;
    }
    let groupList;
    try {
      groupList = JSON.parse(listRes.body);
    } catch {
      await sendMessage(token, chatId, "Error loading groups.");
      return;
    }
    const userGroups = groupList.groups || [];
    if (userGroups.length === 0) {
      await sendMessage(token, chatId, "No groups. Create one in the Saven app.");
      return;
    }
    const day = todayStr();
    let total = 0;
    const lines = [];
    for (const g of userGroups) {
      const listRes2 = await transactions.list({ groupId: g.id }, {}, userId, { day });
      if (listRes2.statusCode !== 200) continue;
      let data;
      try {
        data = JSON.parse(listRes2.body);
      } catch {
        continue;
      }
      const txList = data.transactions || [];
      const groupTotal = txList.reduce((s, t) => s + (t.amount || 0), 0);
      total += groupTotal;
      if (txList.length > 0) lines.push(`<b>${g.name}</b>: ${groupTotal.toFixed(2)} (${txList.length} tx)`);
    }
    lines.unshift(`📅 <b>Today</b> (${day})`);
    lines.push(`<b>Total:</b> ${total.toFixed(2)}`);
    await sendMessage(token, chatId, lines.join("\n") || `No transactions today (${day}).`);
    return;
  }

  if (text.startsWith("/month")) {
    const rest = text.replace(/^\s*\/month\s*/i, "").trim();
    const month = rest || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      await sendMessage(token, chatId, "Use: /month [YYYY-MM]");
      return;
    }
    const listRes = await groups.list({}, {}, userId);
    if (listRes.statusCode !== 200) {
      await sendMessage(token, chatId, "Could not load groups.");
      return;
    }
    let groupList;
    try {
      groupList = JSON.parse(listRes.body);
    } catch {
      await sendMessage(token, chatId, "Error loading groups.");
      return;
    }
    const userGroups = groupList.groups || [];
    if (userGroups.length === 0) {
      await sendMessage(token, chatId, "No groups.");
      return;
    }
    let total = 0;
    const lines = [];
    for (const g of userGroups) {
      const listRes2 = await transactions.list({ groupId: g.id }, {}, userId, { month });
      if (listRes2.statusCode !== 200) continue;
      let data;
      try {
        data = JSON.parse(listRes2.body);
      } catch {
        continue;
      }
      const txList = data.transactions || [];
      const groupTotal = txList.reduce((s, t) => s + (t.amount || 0), 0);
      total += groupTotal;
      if (txList.length > 0) lines.push(`<b>${g.name}</b>: ${groupTotal.toFixed(2)} (${txList.length} tx)`);
    }
    lines.unshift(`📅 <b>Month</b> ${month}`);
    lines.push(`<b>Total:</b> ${total.toFixed(2)}`);
    await sendMessage(token, chatId, lines.join("\n") || `No transactions for ${month}.`);
    return;
  }

  if (text.startsWith("/range ")) {
    const parts = text.replace(/^\s*\/range\s*/i, "").trim().split(/\s+/);
    if (parts.length !== 2 || !DATE_RE.test(parts[0]) || !DATE_RE.test(parts[1])) {
      await sendMessage(token, chatId, "Use: /range YYYY-MM-DD YYYY-MM-DD");
      return;
    }
    const [startDate, endDate] = parts;
    if (startDate > endDate) {
      await sendMessage(token, chatId, "Start date must be before end date.");
      return;
    }
    const listRes = await groups.list({}, {}, userId);
    if (listRes.statusCode !== 200) {
      await sendMessage(token, chatId, "Could not load groups.");
      return;
    }
    let groupList;
    try {
      groupList = JSON.parse(listRes.body);
    } catch {
      await sendMessage(token, chatId, "Error loading groups.");
      return;
    }
    const userGroups = groupList.groups || [];
    if (userGroups.length === 0) {
      await sendMessage(token, chatId, "No groups.");
      return;
    }
    let total = 0;
    const lines = [];
    for (const g of userGroups) {
      const listRes2 = await transactions.list({ groupId: g.id }, {}, userId, { startDate, endDate });
      if (listRes2.statusCode !== 200) continue;
      let data;
      try {
        data = JSON.parse(listRes2.body);
      } catch {
        continue;
      }
      const txList = data.transactions || [];
      const groupTotal = txList.reduce((s, t) => s + (t.amount || 0), 0);
      total += groupTotal;
      if (txList.length > 0) lines.push(`<b>${g.name}</b>: ${groupTotal.toFixed(2)} (${txList.length} tx)`);
    }
    lines.unshift(`📅 <b>Range</b> ${startDate} → ${endDate}`);
    lines.push(`<b>Total:</b> ${total.toFixed(2)}`);
    await sendMessage(token, chatId, lines.join("\n") || `No transactions in this range.`);
    return;
  }

  const free = parseFreeText(text);
  if (free) {
    const listRes = await groups.list({}, {}, userId);
    if (listRes.statusCode !== 200) {
      await sendMessage(token, chatId, "Could not load your groups.");
      return;
    }
    let groupList;
    try {
      groupList = JSON.parse(listRes.body);
    } catch {
      await sendMessage(token, chatId, "Error loading groups.");
      return;
    }
    const userGroups = groupList.groups || [];
    if (userGroups.length === 0) {
      await sendMessage(token, chatId, "Create a group first in the Saven app.");
      return;
    }
    const groupId = userGroups[0].id;
    const categoryId = await resolveCategoryId(groupId, free.categoryHint, userId);
    const createRes = await transactions.create(
      { groupId },
      { amount: free.amount, date: free.date, categoryId, note: "via Telegram (free text)" },
      userId
    );
    if (createRes.statusCode === 201) {
      let body;
      try {
        body = JSON.parse(createRes.body);
      } catch {
        body = {};
      }
      const tx = body.transaction;
      await sendMessage(token, chatId, `✅ Recorded ${tx.amount} on ${tx.date}.`);
    } else {
      await sendMessage(token, chatId, "Could not add transaction. Try /add amount category");
    }
    return;
  }

  await sendMessage(token, chatId,
    "Unknown command. Try /start for help, or send something like:\n<i>50 coffee</i> or <i>/add 50 Food</i>");
}

async function handleLink(telegramUserId, chatId, code, token) {
  if (!TABLES.telegram_link_codes || !code) {
    await sendMessage(token, chatId, "Use: /link &lt;code&gt;\nGet the code from Saven app → Settings → Connect Telegram.");
    return;
  }
  const r = await doc.get({
    TableName: TABLES.telegram_link_codes,
    Key: { code: code.trim() },
  }).promise();
  if (!r.Item) {
    await sendMessage(token, chatId, "Invalid or expired code. Get a new code from the Saven app.");
    return;
  }
  const userId = r.Item.userId;
  if (!userId) {
    await sendMessage(token, chatId, "Invalid code.");
    return;
  }
  await doc.put({
    TableName: TABLES.telegram_links,
    Item: {
      telegramUserId,
      userId,
      linkedAt: now(),
    },
  }).promise();
  await doc.delete({
    TableName: TABLES.telegram_link_codes,
    Key: { code: code.trim() },
  }).promise();
  await sendMessage(token, chatId, "✅ Account linked! You can now use /add, /today, /month and free text to log spend.");
}

exports.handle = async (event) => {
  const token = await getToken();
  if (!token) return { statusCode: 200, body: "" };

  let update;
  try {
    const body = typeof event.body === "string" ? event.body : (event.body && JSON.stringify(event.body));
    update = body ? JSON.parse(body) : null;
  } catch {
    return { statusCode: 200, body: "" };
  }
  if (!update) return { statusCode: 200, body: "" };

  const ctx = getChatAndUser(update);
  if (!ctx || ctx.chatId == null) return { statusCode: 200, body: "" };

  const { chatId, telegramUserId, text } = ctx;
  let userId = await getLinkedUserId(telegramUserId);

  if (text.startsWith("/link ")) {
    const code = text.replace(/^\s*\/link\s*/i, "").trim();
    await handleLink(telegramUserId, chatId, code, token);
    return { statusCode: 200, body: "" };
  }

  if (text === "/start" || text.startsWith("/start ")) {
    if (!userId) {
      await sendMessage(token, chatId,
        "👋 <b>Saven</b> — track spend from Telegram.\n\n" +
        "Link your account first:\n" +
        "1. Open the Saven app in your browser\n" +
        "2. Go to Settings → Connect Telegram\n" +
        "3. Get your 6-digit code\n" +
        "4. Send: <code>/link YOUR_CODE</code>");
      return { statusCode: 200, body: "" };
    }
  } else if (!userId) {
    await sendMessage(token, chatId, "Please link your account first. Send /start for instructions.");
    return { statusCode: 200, body: "" };
  }

  if (text) await handleMessage(telegramUserId, chatId, text, token, userId);
  return { statusCode: 200, body: "" };
};
