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
  const r = await doc.query({
    TableName: TABLES.transactions,
    KeyConditionExpression: "groupId = :gid AND sk BETWEEN :start AND :end",
    ExpressionAttributeValues: { ":gid": groupId, ":start": range.skStart, ":end": range.skEnd },
    ScanIndexForward: false, // latest date first (descending order by sk = date#transactionId)
  }).promise();
  return json(200, { transactions: r.Items || [] });
}

async function create(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const amount = body && body.amount;
  const date = body && body.date;
  const categoryId = body && body.categoryId;
  if (amount === undefined || amount === null || typeof amount !== "number") return badRequest("amount (number) is required");
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
  return json(200, { transaction: r.Item });
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
    updates.push("amount = :a");
    values[":a"] = body.amount;
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
