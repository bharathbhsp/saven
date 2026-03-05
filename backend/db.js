const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);

/** DocumentClient-style wrapper so handlers can keep using doc.get().promise(), etc. */
const doc = {
  get: (params) => ({ promise: () => ddb.send(new GetCommand(params)) }),
  put: (params) => ({ promise: () => ddb.send(new PutCommand(params)) }),
  query: (params) => ({ promise: () => ddb.send(new QueryCommand(params)) }),
  update: (params) => ({ promise: () => ddb.send(new UpdateCommand(params)) }),
  delete: (params) => ({ promise: () => ddb.send(new DeleteCommand(params)) }),
};

const TABLES = {
  groups: process.env.GROUPS_TABLE,
  group_members: process.env.GROUP_MEMBERS_TABLE,
  categories: process.env.CATEGORIES_TABLE,
  transactions: process.env.TRANSACTIONS_TABLE,
  telegram_links: process.env.TELEGRAM_LINKS_TABLE,
  telegram_link_codes: process.env.TELEGRAM_LINK_CODES_TABLE,
  telegram_chat_links: process.env.TELEGRAM_CHAT_LINKS_TABLE,
  telegram_chat_link_codes: process.env.TELEGRAM_CHAT_LINK_CODES_TABLE,
};

function ensureTables() {
  const missing = Object.entries(TABLES).filter(([, v]) => !v || typeof v !== "string").map(([k]) => k);
  if (missing.length) {
    throw new Error("Missing Lambda env: " + missing.join(", ") + ". Set GROUPS_TABLE, GROUP_MEMBERS_TABLE, CATEGORIES_TABLE, TRANSACTIONS_TABLE.");
  }
}

async function getGroupMember(groupId, userId) {
  const r = await doc.get({
    TableName: TABLES.group_members,
    Key: { groupId, userId },
  }).promise();
  return r.Item;
}

async function requireMember(groupId, userId) {
  const member = await getGroupMember(groupId, userId);
  return member !== undefined && member !== null;
}

function now() {
  return new Date().toISOString();
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

module.exports = { doc, TABLES, getGroupMember, requireMember, now, uuid, ensureTables };
