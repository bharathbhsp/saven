const { doc, TABLES, now } = require("../db");
const { json, badRequest } = require("../responses");

const EXPIRES_IN_SECONDS = 600;

function randomCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function create(params, body, userId) {
  if (!TABLES.telegram_link_codes) return badRequest("Telegram link not configured");
  const code = randomCode();
  const expiresAt = Math.floor(Date.now() / 1000) + EXPIRES_IN_SECONDS;
  await doc.put({
    TableName: TABLES.telegram_link_codes,
    Item: {
      code,
      userId,
      createdAt: now(),
      expiresAt,
    },
  }).promise();
  return json(201, { code, expiresIn: EXPIRES_IN_SECONDS });
}

module.exports = { create };
