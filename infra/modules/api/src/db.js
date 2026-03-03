const AWS = require("aws-sdk");
const doc = new AWS.DynamoDB.DocumentClient();

const TABLES = {
  groups: process.env.GROUPS_TABLE,
  group_members: process.env.GROUP_MEMBERS_TABLE,
  categories: process.env.CATEGORIES_TABLE,
  transactions: process.env.TRANSACTIONS_TABLE,
};

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

module.exports = { doc, TABLES, getGroupMember, requireMember, now, uuid };
