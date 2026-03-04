const { doc, TABLES } = require("../db");
const { json } = require("../responses");

async function list(params, body, userId) {
  if (!TABLES.telegram_chat_links) return json(200, { links: [] });
  const groups = require("./groups");
  const groupsRes = await groups.list({}, {}, userId);
  if (groupsRes.statusCode !== 200) return json(200, { links: [] });
  let groupList;
  try {
    groupList = JSON.parse(groupsRes.body);
  } catch {
    return json(200, { links: [] });
  }
  const userGroups = groupList.groups || [];
  const links = [];
  for (const g of userGroups) {
    const q = await doc.query({
      TableName: TABLES.telegram_chat_links,
      IndexName: "by-group",
      KeyConditionExpression: "savenGroupId = :gid",
      ExpressionAttributeValues: { ":gid": g.id },
    }).promise();
    const items = q.Items || [];
    for (const item of items) {
      links.push({
        groupId: g.id,
        groupName: g.name,
        telegramChatId: item.telegramChatId,
      });
    }
  }
  return json(200, { links });
}

module.exports = { list };
