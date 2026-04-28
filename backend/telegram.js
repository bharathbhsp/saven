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
  if (msg) {
    const chat = msg.chat || {};
    const from = msg.from || {};
    const nameParts = [from.first_name, from.last_name].filter(Boolean);
    const fromName =
      (nameParts.length ? nameParts.join(" ") : null) || (from.username ? `@${from.username}` : "") || "";
    return {
      chatId: chat.id,
      chatType: chat.type || "private",
      telegramUserId: String(msg.from?.id ?? ""),
      text: (msg.text || "").trim(),
      fromName,
    };
  }
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

/** Option B: full link record including defaultGroupId */
async function getLinkRecord(telegramUserId) {
  if (!telegramUserId || !TABLES.telegram_links) return null;
  const r = await doc.get({
    TableName: TABLES.telegram_links,
    Key: { telegramUserId },
  }).promise();
  return r.Item || null;
}

/** Option C: Telegram chat (group/supergroup) -> Saven groupId */
async function getChatLinkedGroupId(telegramChatId) {
  if (!telegramChatId || !TABLES.telegram_chat_links) return null;
  const r = await doc.get({
    TableName: TABLES.telegram_chat_links,
    Key: { telegramChatId: String(telegramChatId) },
  }).promise();
  return r.Item?.savenGroupId ?? null;
}

/** Resolve group: explicit hint > chat-linked group > default from link > first group */
function findGroupByHint(userGroups, hint) {
  if (!hint || !userGroups.length) return null;
  const h = hint.replace(/^@/, "").trim().toLowerCase();
  if (!h) return null;
  const byId = userGroups.find((g) => g.id === hint || g.id === h);
  if (byId) return byId.id;
  const byName = userGroups.find((g) => g.name && g.name.toLowerCase() === h);
  if (byName) return byName.id;
  const fuzzy = userGroups.find((g) => g.name && g.name.toLowerCase().includes(h));
  if (fuzzy) return fuzzy.id;
  return null;
}

function resolveGroupId(userGroups, opts) {
  const { groupHint, defaultGroupId, chatLinkedGroupId } = opts || {};
  if (groupHint && userGroups.length) {
    const gid = findGroupByHint(userGroups, groupHint);
    if (gid) return gid;
  }
  if (chatLinkedGroupId && userGroups.some((g) => g.id === chatLinkedGroupId)) return chatLinkedGroupId;
  if (defaultGroupId && userGroups.some((g) => g.id === defaultGroupId)) return defaultGroupId;
  return userGroups[0] ? userGroups[0].id : null;
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

function inferTransactionType(text, fallback = "debit") {
  const t = String(text || "").toLowerCase();
  if (
    /\b(received|receive|salary|income|credited|credit|refund|cashback|reimbursement|bonus|interest)\b/.test(t)
  ) {
    return "credit";
  }
  if (/\b(spent|spend|paid|pay|expense|bought|debit|purchase)\b/.test(t)) {
    return "debit";
  }
  return fallback;
}

/** Parse /add 50 Food [date] [group] — Option A: optional group name/id at end */
function parseAddArgs(text) {
  const rest = text.replace(/^\s*\/add\s*/i, "").trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { err: "Use: /add &lt;amount&gt; &lt;category&gt; [date] [group]\nExample: /add 50 Food or /add 50 Food Household" };
  let transactionType = "debit";
  let amountIdx = 0;
  const first = parts[0].toLowerCase();
  if (first === "credit" || first === "debit") {
    transactionType = first;
    amountIdx = 1;
  }
  const amount = parseFloat(parts[amountIdx]);
  if (Number.isNaN(amount) || amount <= 0) return { err: "Amount must be a positive number." };
  const categoryPart = parts[amountIdx + 1];
  if (!categoryPart) return { err: "Category is required." };
  let date = todayStr();
  let groupHint = null;
  for (let i = amountIdx + 2; i < parts.length; i++) {
    const p = parts[i];
    if (DATE_RE.test(p)) {
      date = p;
    } else if (!groupHint && /^@/.test(p)) {
      const cleaned = p.replace(/^@/, "").trim();
      if (cleaned) groupHint = cleaned;
    }
  }
  return { amount, categoryHint: categoryPart, date, groupHint, transactionType };
}

/** Simple free-text: "50 coffee", "20 groceries yesterday", "50 coffee Household" — Option A: optional group at end */
function parseFreeText(text) {
  const t = text.trim();
  const spent = t.match(/spent?\s+(\d+(?:\.\d+)?)\s+(?:on\s+)?(.+)/i);
  if (spent) {
    const amount = parseFloat(spent[1]);
    let rest = spent[2].trim();
    let date = todayStr();
    const yesterday = rest.match(/(yesterday|yday)/i);
    if (yesterday) date = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    rest = rest.replace(/(yesterday|yday)\s*/gi, "").trim();
    let groupHint = null;
    const lastSpace = rest.lastIndexOf(" ");
    if (lastSpace > 0) {
      const maybeGroup = rest.slice(lastSpace + 1).trim();
      if (maybeGroup.startsWith("@") && maybeGroup.length > 1) {
        groupHint = maybeGroup.slice(1);
        rest = rest.slice(0, lastSpace).trim();
      }
    }
    const catPart = rest || "Other";
    return {
      amount,
      categoryHint: catPart,
      date,
      groupHint: groupHint || undefined,
      transactionType: inferTransactionType(t, "debit"),
    };
  }
  const simple = t.match(/^(\d+(?:\.\d+)?)\s+(?:on\s+)?(.+?)(?:\s+(yesterday|today))?$/i);
  if (simple) {
    const amount = parseFloat(simple[1]);
    let date = todayStr();
    if (simple[3] && simple[3].toLowerCase() === "yesterday") date = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    let catPart = simple[2].trim();
    let groupHint = null;
    const lastSpace = catPart.lastIndexOf(" ");
    if (lastSpace > 0) {
      const maybeGroup = catPart.slice(lastSpace + 1).trim();
      if (maybeGroup.startsWith("@") && maybeGroup.length > 1) {
        groupHint = maybeGroup.slice(1);
        catPart = catPart.slice(0, lastSpace).trim();
      }
    }
    return {
      amount,
      categoryHint: catPart || "Other",
      date,
      groupHint: groupHint || undefined,
      transactionType: inferTransactionType(t, "debit"),
    };
  }
  const withGroup = t.match(/^(\d+(?:\.\d+)?)\s+(.+?)\s+@([A-Za-z0-9_-]+)$/);
  if (withGroup) {
    const amount = parseFloat(withGroup[1]);
    const mid = withGroup[2].trim();
    const last = withGroup[3];
    if (!DATE_RE.test(last)) {
      return {
        amount,
        categoryHint: mid,
        date: todayStr(),
        groupHint: last,
        transactionType: inferTransactionType(t, "debit"),
      };
    }
  }
  const justAmount = t.match(/^(\d+(?:\.\d+)?)\s*$/);
  if (justAmount) {
    return {
      amount: parseFloat(justAmount[1]),
      categoryHint: "Other",
      date: todayStr(),
      transactionType: "debit",
    };
  }
  return null;
}

async function resolveCategoryId(groupId, categoryHint, userId) {
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
  if (byName) {
    return { categoryId: byName.categoryId, categoryName: byName.name || byName.categoryId };
  }
  const byId = cats.find((c) => c.categoryId === categoryHint);
  if (byId) {
    return { categoryId: byId.categoryId, categoryName: byId.name || byId.categoryId };
  }
  const fuzzy = cats.find((c) => c.name && c.name.toLowerCase().includes(hint));
  if (fuzzy) {
    return { categoryId: fuzzy.categoryId, categoryName: fuzzy.name || fuzzy.categoryId };
  }
  return { categoryId: "default-other", categoryName: "Other" };
}

async function handleMessage(telegramUserId, chatId, chatType, text, token, userId, fromName) {
  const groups = require("./handlers/groups");
  const transactions = require("./handlers/transactions");
  const categories = require("./handlers/categories");

  if (!text) return;

  const linkRecord = await getLinkRecord(telegramUserId);
  const chatLinkedGroupId = (chatType === "group" || chatType === "supergroup") ? await getChatLinkedGroupId(chatId) : null;

  if (text === "/start" || text.startsWith("/start ")) {
    const inGroupChat = chatType === "group" || chatType === "supergroup";
    const linkTip = inGroupChat && !chatLinkedGroupId
      ? "\n\n📌 <b>In this chat:</b> To have everyone's spend go to <b>one shared Saven group</b>, an admin must run /linkgroup with a code from Saven app → Settings → Link Telegram group."
      : "";
    await sendMessage(token, chatId,
      "👋 <b>Saven</b> — track spend from Telegram.\n\n" +
      "Commands:\n" +
      "• /add [credit|debit] &lt;amount&gt; &lt;category&gt; [date] [group] — record transaction\n" +
      "• /today — today's summary\n" +
      "• /month [YYYY-MM] — monthly summary\n" +
      "• /range &lt;start&gt; &lt;end&gt; — summary for date range\n" +
      "• Or free text: <i>50 coffee</i>, <i>50 coffee Household</i>\n\n" +
      "You're linked. Use /add or type an amount and category." + linkTip);
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
    const inGroupChat = chatType === "group" || chatType === "supergroup";
    if (inGroupChat && chatLinkedGroupId) {
      const isMemberOfLinkedGroup = userGroups.some((g) => g.id === chatLinkedGroupId);
      if (!isMemberOfLinkedGroup) {
        await sendMessage(token, chatId,
          "You’re not a member of the Saven group linked to this chat. Ask the admin to add you to that group in the Saven app (Settings or group members), then you can add transactions here.");
        return;
      }
    }
    if (userGroups.length === 0) {
      await sendMessage(token, chatId, "Create a group first in the Saven app.");
      return;
    }
    if (inGroupChat && !chatLinkedGroupId) {
      await sendMessage(token, chatId,
        "This chat isn’t linked to a shared Saven group. To record everyone’s spend here into one group:\n" +
        "1) In Saven app: Settings → Link Telegram group → pick the group → generate code.\n" +
        "2) Here, have an admin run: /linkgroup &lt;code&gt;\n" +
        "Then everyone in this chat can add spend to that same Saven group.");
      return;
    }
    const groupId = resolveGroupId(userGroups, {
      groupHint: parsed.groupHint,
      defaultGroupId: linkRecord?.defaultGroupId,
      chatLinkedGroupId,
    });
    if (!groupId) {
      await sendMessage(token, chatId, "Could not pick a group. Set a default in Settings or use: /add amount category GroupName");
      return;
    }
    const resolvedCategory = await resolveCategoryId(groupId, parsed.categoryHint, userId);
    const categoryId = resolvedCategory?.categoryId || "default-other";
    const categoryName = resolvedCategory?.categoryName || parsed.categoryHint;
    const groupName = userGroups.find((g) => g.id === groupId)?.name || groupId;
    const createRes = await transactions.create(
      { groupId },
      {
        amount: parsed.amount,
        date: parsed.date,
        categoryId,
        note: "via Telegram",
        transactionType: parsed.transactionType || "debit",
      },
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
      const noteText = tx?.note && typeof tx.note === "string" && tx.note.trim() ? tx.note.trim() : "—";
      const submittedBy = fromName && fromName.trim() ? fromName.trim() : "Unknown";
      await sendMessage(
        token,
        chatId,
        [
          `✅ Recorded ${tx.amount} in <b>${groupName}</b>`,
          `• Type: ${tx.transactionType === "credit" ? "Credit" : "Spend"}`,
          `• Date: ${tx.date}`,
          `• Category: ${categoryName}`,
          `• Note: ${noteText}`,
          `• Submitted by: ${submittedBy}`,
        ].join("\n")
      );
    } else {
      let msg = "Failed to add transaction.";
      if (createRes.statusCode === 403) {
        msg = "You’re not a member of the Saven group linked to this chat. Ask the admin to add you in the Saven app.";
      } else {
        try {
          const err = JSON.parse(createRes.body);
          if (err.message) msg = err.message;
        } catch (_) {}
      }
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
      const groupTotal = txList.reduce(
        (s, t) => s + ((t.transactionType === "credit" ? 1 : -1) * (t.amount || 0)),
        0
      );
      total += groupTotal;
      if (txList.length > 0) lines.push(`<b>${g.name}</b>: ${groupTotal.toFixed(2)} (${txList.length} tx)`);
    }
    lines.unshift(`📅 <b>Today</b> (${day})`);
    lines.push(`<b>Total:</b> ${total.toFixed(2)}`);
    await sendMessage(token, chatId, lines.join("\n") || `No transactions today (${day}).`);
    return;
  }

  if (text === "/groups") {
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
      await sendMessage(token, chatId, "You don't have any Saven groups yet. Create one in the app.");
      return;
    }
    const lines = [
      "Your Saven groups:",
      ...userGroups.map((g) => `• ${g.name}`),
      "",
      "Tip: when adding via Telegram, you can target a group with @GroupName, e.g. 200 breakfast @Household",
    ];
    await sendMessage(token, chatId, lines.join("\n"));
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
      const groupTotal = txList.reduce(
        (s, t) => s + ((t.transactionType === "credit" ? 1 : -1) * (t.amount || 0)),
        0
      );
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
      const groupTotal = txList.reduce(
        (s, t) => s + ((t.transactionType === "credit" ? 1 : -1) * (t.amount || 0)),
        0
      );
      total += groupTotal;
      if (txList.length > 0) lines.push(`<b>${g.name}</b>: ${groupTotal.toFixed(2)} (${txList.length} tx)`);
    }
    lines.unshift(`📅 <b>Range</b> ${startDate} → ${endDate}`);
    lines.push(`<b>Total:</b> ${total.toFixed(2)}`);
    await sendMessage(token, chatId, lines.join("\n") || `No transactions in this range.`);
    return;
  }

  // Free-text: load groups first so we can pass default group's categories to GPT-4o mini
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
  const inGroupChatFree = chatType === "group" || chatType === "supergroup";
  if (inGroupChatFree && chatLinkedGroupId) {
    const isMemberOfLinkedGroup = userGroups.some((g) => g.id === chatLinkedGroupId);
    if (!isMemberOfLinkedGroup) {
      await sendMessage(
        token,
        chatId,
        "You’re not a member of the Saven group linked to this chat. Ask the admin to add you to that group in the Saven app (Settings or group members), then you can add transactions here."
      );
      return;
    }
  }
  if (inGroupChatFree && !chatLinkedGroupId) {
    await sendMessage(token, chatId,
      "This chat isn’t linked to a shared Saven group. To record everyone’s spend here into one group:\n" +
      "1) In Saven app: Settings → Link Telegram group → pick the group → generate code.\n" +
      "2) Here, have an admin run: /linkgroup &lt;code&gt;\n" +
      "Then everyone in this chat can add spend to that same Saven group.");
    return;
  }
  let categoryNames = [];
  const groupNames = userGroups.map((g) => g.name).filter(Boolean);
  const defaultGroupIdForNlp = resolveGroupId(userGroups, {
    groupHint: null,
    defaultGroupId: linkRecord?.defaultGroupId,
    chatLinkedGroupId,
  });
  if (defaultGroupIdForNlp) {
    const catRes = await categories.list({ groupId: defaultGroupIdForNlp }, {}, userId);
    if (catRes.statusCode === 200) {
      try {
        const catData = JSON.parse(catRes.body);
        const cats = catData.categories || [];
        categoryNames = cats.map((c) => c.name).filter(Boolean);
      } catch (_) {}
    }
  }
  let free = null;
  console.log("[Telegram] free-text: trying GPT-4o mini");
  try {
    const telegramNlp = require("./telegramNlp");
    free = await telegramNlp.extract(text, { todayDate: todayStr(), categoryNames, groupNames });
  } catch (e) {
    console.error("[Telegram] free-text: NLP extract error:", e.message);
  }
  if (!free) {
    console.log("[Telegram] free-text: GPT-4o mini unavailable or failed, using regex parser");
    free = parseFreeText(text);
  } else if (free.fromNlp) {
    console.log("[Telegram] free-text: GPT-4o mini extracted, using result");
  }
  if (free) {
    if (userGroups.length === 0) {
      await sendMessage(token, chatId, "Create a group first in the Saven app.");
      return;
    }
    const groupId = resolveGroupId(userGroups, {
      groupHint: free.groupHint,
      defaultGroupId: linkRecord?.defaultGroupId,
      chatLinkedGroupId,
    });
    if (!groupId) {
      await sendMessage(token, chatId, "Could not pick a group. Set a default in Settings or add group name: 50 coffee GroupName");
      return;
    }
    const resolvedCategory = await resolveCategoryId(groupId, free.categoryHint, userId);
    const categoryId = resolvedCategory?.categoryId || "default-other";
    const categoryName = resolvedCategory?.categoryName || free.categoryHint;
    const groupName = userGroups.find((g) => g.id === groupId)?.name || groupId;
    const createRes = await transactions.create(
      { groupId },
      {
        amount: free.amount,
        date: free.date,
        categoryId,
        note: free.fromNlp ? (free.note ?? "") : "via Telegram (free text)",
        paymentMode: free.paymentMode || "",
        transactionType: free.transactionType || inferTransactionType(text, "debit"),
      },
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
      const noteText = tx?.note && typeof tx.note === "string" && tx.note.trim() ? tx.note.trim() : "—";
      const paymentText = tx?.paymentMode && typeof tx.paymentMode === "string" && tx.paymentMode.trim()
        ? tx.paymentMode.trim()
        : "—";
      const submittedBy = fromName && fromName.trim() ? fromName.trim() : "Unknown";
      await sendMessage(
        token,
        chatId,
        [
          `✅ Recorded ${tx.amount} in <b>${groupName}</b>`,
          `• Type: ${tx.transactionType === "credit" ? "Credit" : "Spend"}`,
          `• Date: ${tx.date}`,
          `• Category: ${categoryName}`,
          `• Payment mode: ${paymentText}`,
          `• Note: ${noteText}`,
          `• Submitted by: ${submittedBy}`,
        ].join("\n")
      );
    } else {
      let msg = "Could not add transaction. Try /add amount category";
      if (createRes.statusCode === 403) {
        msg = "You’re not a member of the Saven group linked to this chat. Ask the admin to add you in the Saven app.";
      }
      await sendMessage(token, chatId, msg);
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

/** Option C: link this Telegram group/supergroup to a Saven group (code from app) */
async function handleLinkGroup(telegramUserId, chatId, chatType, code, token) {
  if (chatType !== "group" && chatType !== "supergroup") {
    await sendMessage(token, chatId, "Use /linkgroup in a Telegram group (add the bot to the group first).");
    return;
  }
  if (!TABLES.telegram_chat_link_codes || !code) {
    await sendMessage(token, chatId, "Use: /linkgroup &lt;code&gt;\nGet the code from Saven app → Settings → Link Telegram group.");
    return;
  }
  const r = await doc.get({
    TableName: TABLES.telegram_chat_link_codes,
    Key: { code: code.trim() },
  }).promise();
  if (!r.Item) {
    await sendMessage(token, chatId, "Invalid or expired code. Get a new code from the Saven app.");
    return;
  }
  const savenGroupId = r.Item.groupId;
  const createdBy = r.Item.userId;
  const userId = await getLinkedUserId(telegramUserId);
  if (!userId) {
    await sendMessage(token, chatId, "Link your Telegram account first (send /start to the bot in a private chat).");
    return;
  }
  const { requireMember } = require("./db");
  const isMember = await requireMember(savenGroupId, userId);
  if (!isMember) {
    await sendMessage(token, chatId, "You are not a member of that Saven group. Only members can link this chat.");
    return;
  }
  await doc.put({
    TableName: TABLES.telegram_chat_links,
    Item: {
      telegramChatId: String(chatId),
      savenGroupId,
      linkedBy: createdBy,
      linkedAt: now(),
    },
  }).promise();
  await doc.delete({
    TableName: TABLES.telegram_chat_link_codes,
    Key: { code: code.trim() },
  }).promise();
  await sendMessage(token, chatId, "✅ This Telegram group is now linked to the Saven group. Messages here will record to that group.");
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

  const { chatId, chatType, telegramUserId, text, fromName } = ctx;
  let userId = await getLinkedUserId(telegramUserId);

  if (text.startsWith("/link ")) {
    const code = text.replace(/^\s*\/link\s*/i, "").trim();
    await handleLink(telegramUserId, chatId, code, token);
    return { statusCode: 200, body: "" };
  }

  if (text.startsWith("/linkgroup ")) {
    const code = text.replace(/^\s*\/linkgroup\s*/i, "").trim();
    await handleLinkGroup(telegramUserId, chatId, chatType, code, token);
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

  if (text) await handleMessage(telegramUserId, chatId, chatType, text, token, userId, fromName);
  return { statusCode: 200, body: "" };
};
