const { doc, TABLES, now, requireMember } = require("../db");
const { json, badRequest, forbidden } = require("../responses");

const EXPIRES_IN_SECONDS = 600;

function randomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function create(params, body, userId) {
  if (!TABLES.telegram_chat_link_codes) return badRequest("Telegram chat link not configured");
  const groupId = body && body.groupId;
  if (!groupId || typeof groupId !== "string" || !groupId.trim()) {
    return badRequest("groupId is required");
  }
  const isMember = await requireMember(groupId.trim(), userId);
  if (!isMember) return forbidden("Not a member of that group");
  const code = randomCode();
  const expiresAt = Math.floor(Date.now() / 1000) + EXPIRES_IN_SECONDS;
  await doc.put({
    TableName: TABLES.telegram_chat_link_codes,
    Item: {
      code,
      groupId: groupId.trim(),
      userId,
      createdAt: now(),
      expiresAt,
    },
  }).promise();
  return json(201, { code, expiresIn: EXPIRES_IN_SECONDS });
}

module.exports = { create };
