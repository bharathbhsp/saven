const { doc, TABLES, now, requireMember } = require("../db");
const { json, badRequest, forbidden, notFound } = require("../responses");

async function get(params, body, userId) {
  if (!TABLES.telegram_links) return json(200, { linked: false });
  const q = await doc.query({
    TableName: TABLES.telegram_links,
    IndexName: "by-user",
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }).promise();
  const items = q.Items || [];
  if (items.length === 0) return json(200, { linked: false });
  const link = items[0];
  return json(200, { linked: true, defaultGroupId: link.defaultGroupId || null });
}

async function update(params, body, userId) {
  if (!TABLES.telegram_links) return badRequest("Telegram link not configured");
  const defaultGroupId = body && body.defaultGroupId;
  if (defaultGroupId !== undefined && defaultGroupId !== null) {
    if (typeof defaultGroupId !== "string" || !defaultGroupId.trim()) {
      return badRequest("defaultGroupId must be a non-empty string, or omit to clear");
    }
    const isMember = await requireMember(defaultGroupId.trim(), userId);
    if (!isMember) return forbidden("Not a member of that group");
  }
  const q = await doc.query({
    TableName: TABLES.telegram_links,
    IndexName: "by-user",
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }).promise();
  const items = q.Items || [];
  if (items.length === 0) return notFound("No Telegram account linked. Use Settings → Connect Telegram first.");
  const link = items[0];
  const telegramUserId = link.telegramUserId;
  if (defaultGroupId === undefined || defaultGroupId === null || defaultGroupId === "") {
    await doc.update({
      TableName: TABLES.telegram_links,
      Key: { telegramUserId },
      UpdateExpression: "REMOVE defaultGroupId SET updatedAt = :t",
      ExpressionAttributeValues: { ":t": now() },
    }).promise();
  } else {
    await doc.update({
      TableName: TABLES.telegram_links,
      Key: { telegramUserId },
      UpdateExpression: "SET defaultGroupId = :gid, updatedAt = :t",
      ExpressionAttributeValues: { ":gid": defaultGroupId.trim(), ":t": now() },
    }).promise();
  }
  return json(200, { ok: true, defaultGroupId: defaultGroupId == null || defaultGroupId === "" ? null : defaultGroupId.trim() });
}

module.exports = { get, update };
