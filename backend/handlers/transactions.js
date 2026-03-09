const { doc, TABLES, requireMember, now, uuid } = require("../db");
const { json, badRequest, forbidden, notFound } = require("../responses");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function parseDateRange(query) {
  const day = query && query.day;
  const month = query && query.month;
  const startDate = query && query.startDate;
  const endDate = query && query.endDate;
  if (day) {
    if (!DATE_RE.test(day)) return { err: "day must be YYYY-MM-DD" };
    return { skStart: `${day}#`, skEnd: `${day}\uffff` };
  }
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return { err: "month must be YYYY-MM" };
    const [y, m] = month.split("-");
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return { skStart: `${month}-01#`, skEnd: `${month}-${String(lastDay).padStart(2, "0")}\uffff` };
  }
  if (startDate && endDate) {
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) return { err: "startDate and endDate must be YYYY-MM-DD" };
    if (startDate > endDate) return { err: "startDate must be before endDate" };
    return { skStart: `${startDate}#`, skEnd: `${endDate}\uffff` };
  }
  return { err: "Provide one of: day (YYYY-MM-DD), month (YYYY-MM), or startDate and endDate" };
}

async function list(params, body, userId, query) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const range = parseDateRange(query);
  if (range.err) return badRequest(range.err);
  const req = {
    TableName: TABLES.transactions,
    KeyConditionExpression: "groupId = :gid AND sk BETWEEN :start AND :end",
    ExpressionAttributeValues: { ":gid": groupId, ":start": range.skStart, ":end": range.skEnd },
    ScanIndexForward: false,
  };
  const paymentModeRaw = query.paymentMode !== undefined ? query.paymentMode : query.payment_mode;
  const transactionTypeRaw = query.transactionType !== undefined ? query.transactionType : query.transaction_type;
  const paymentMode = paymentModeRaw !== undefined && paymentModeRaw !== null ? String(paymentModeRaw).trim() : undefined;
  const transactionType =
    transactionTypeRaw === "credit" || transactionTypeRaw === "debit" ? transactionTypeRaw : undefined;
  const filters = [];
  const names = {};
  if (paymentMode !== undefined) {
    if (paymentMode !== "") {
      filters.push("#pm = :pm");
      names["#pm"] = "paymentMode";
      req.ExpressionAttributeValues[":pm"] = paymentMode;
    } else {
      filters.push("(attribute_not_exists(#pm) OR #pm = :pm)");
      names["#pm"] = "paymentMode";
      req.ExpressionAttributeValues[":pm"] = "";
    }
  }
  if (transactionType) {
    names["#txType"] = "transactionType";
    req.ExpressionAttributeValues[":tt"] = transactionType;
    if (transactionType === "debit") {
      filters.push("(attribute_not_exists(#txType) OR #txType = :tt)");
    } else {
      filters.push("#txType = :tt");
    }
  }
  if (filters.length) {
    req.FilterExpression = filters.join(" AND ");
    if (Object.keys(names).length) req.ExpressionAttributeNames = names;
  }
  const r = await doc.query(req).promise();
  const items = (r.Items || []).map((item) => ({
    ...item,
    transactionType: item.transactionType === "credit" ? "credit" : "debit",
  }));
  return json(200, { transactions: items });
}

async function create(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const amount = body && body.amount;
  const date = body && body.date;
  const categoryId = body && body.categoryId;
  const rawType = body && (body.transactionType ?? body.transaction_type);
  let transactionType = String(rawType || "").toLowerCase().trim() === "credit" ? "credit" : "debit";
  if (amount === undefined || amount === null || typeof amount !== "number") return badRequest("amount (number) is required");
  if (amount < 0) return badRequest("amount must be non-negative; use transactionType 'credit' or 'debit' to indicate direction");
  if (!date || !DATE_RE.test(date)) return badRequest("date (YYYY-MM-DD) is required");
  if (!categoryId || typeof categoryId !== "string" || !categoryId.trim()) return badRequest("categoryId is required");
  const transactionId = uuid();
  const sk = `${date}#${transactionId}`;
  const ts = now();
  const item = {
    groupId,
    sk,
    transactionId,
    date,
    amount,
    transactionType,
    categoryId: categoryId.trim(),
    userId,
    createdBy: userId,
    createdAt: ts,
    updatedAt: ts,
    note: (body.note && String(body.note)) || undefined,
    paymentMode: typeof body.paymentMode === "string" ? body.paymentMode : "",
  };
  await doc.put({ TableName: TABLES.transactions, Item: item }).promise();
  return json(201, { transaction: item });
}

async function get(params, body, userId, query) {
  const { groupId, transactionId } = params;
  const date = query && query.date;
  if (!date || !DATE_RE.test(date)) return badRequest("date (YYYY-MM-DD) query is required");
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const sk = `${date}#${transactionId}`;
  const r = await doc.get({
    TableName: TABLES.transactions,
    Key: { groupId, sk },
  }).promise();
  if (!r.Item) return notFound("Transaction not found");
  const item = {
    ...r.Item,
    transactionType: r.Item.transactionType === "credit" ? "credit" : "debit",
  };
  return json(200, { transaction: item });
}

async function update(params, body, userId) {
  const { groupId, transactionId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const date = body && body.date;
  if (!date || !DATE_RE.test(date)) return badRequest("date (YYYY-MM-DD) is required to identify the transaction");
  const sk = `${date}#${transactionId}`;
  const existing = await doc.get({
    TableName: TABLES.transactions,
    Key: { groupId, sk },
  }).promise();
  if (!existing.Item) return notFound("Transaction not found");
  const updates = [];
  const names = {};
  const values = { ":t": now() };
  if (body.amount !== undefined && typeof body.amount === "number") {
    if (body.amount < 0) return badRequest("amount must be non-negative");
    updates.push("amount = :a");
    values[":a"] = body.amount;
  }
  if (body.transactionType !== undefined || body.transaction_type !== undefined) {
    const raw = body.transactionType ?? body.transaction_type;
    const tt = String(raw).toLowerCase().trim() === "credit" ? "credit" : "debit";
    updates.push("transactionType = :tt");
    values[":tt"] = tt;
  }
  if (body.categoryId !== undefined && typeof body.categoryId === "string") {
    updates.push("categoryId = :c");
    values[":c"] = body.categoryId.trim();
  }
  if (body.note !== undefined) {
    updates.push("#note = :note");
    names["#note"] = "note";
    values[":note"] = body.note == null ? null : String(body.note);
  }
  if (body.paymentMode !== undefined) {
    updates.push("#paymentMode = :pm");
    names["#paymentMode"] = "paymentMode";
    values[":pm"] = body.paymentMode == null ? "" : String(body.paymentMode);
  }
  if (updates.length === 0) return json(200, { transaction: existing.Item });
  updates.push("updatedAt = :t");
  await doc.update({
    TableName: TABLES.transactions,
    Key: { groupId, sk },
    UpdateExpression: "SET " + updates.join(", "),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }).promise();
  const out = await doc.get({ TableName: TABLES.transactions, Key: { groupId, sk } }).promise();
  return json(200, { transaction: out.Item });
}

async function del(params, body, userId, query) {
  const { groupId, transactionId } = params;
  const date = (query && query.date) || (body && body.date);
  if (!date || !DATE_RE.test(date)) return badRequest("date (YYYY-MM-DD) is required");
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const sk = `${date}#${transactionId}`;
  const existing = await doc.get({
    TableName: TABLES.transactions,
    Key: { groupId, sk },
  }).promise();
  if (!existing.Item) return notFound("Transaction not found");
  await doc.delete({ TableName: TABLES.transactions, Key: { groupId, sk } }).promise();
  return json(200, { ok: true });
}

module.exports = { list, create, get, update, delete: del };
