const { doc, TABLES, requireMember, now, uuid } = require("../db");
const { json, badRequest, forbidden, notFound } = require("../responses");

async function list(params, body, userId) {
  const r = await doc.query({
    TableName: TABLES.group_members,
    IndexName: "by-user",
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": userId },
  }).promise();
  const groupIds = (r.Items || []).map((i) => i.groupId);
  if (groupIds.length === 0) return json(200, { groups: [] });
  const groups = [];
  for (const id of groupIds) {
    const g = await doc.get({ TableName: TABLES.groups, Key: { id } }).promise();
    if (g.Item) groups.push(g.Item);
  }
  return json(200, { groups });
}

async function create(params, body, userId) {
  const name = body && body.name;
  if (!name || typeof name !== "string" || !name.trim()) return badRequest("name is required");
  const id = uuid();
  const ts = now();
  await doc.put({
    TableName: TABLES.groups,
    Item: { id, name: name.trim(), createdAt: ts, updatedAt: ts, createdBy: userId },
  }).promise();
  await doc.put({
    TableName: TABLES.group_members,
    Item: { groupId: id, userId, role: "admin", joinedAt: ts },
  }).promise();
  const group = { id, name: name.trim(), createdAt: ts, updatedAt: ts, createdBy: userId };
  return json(201, { group });
}

async function get(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const r = await doc.get({ TableName: TABLES.groups, Key: { id: groupId } }).promise();
  if (!r.Item) return notFound("Group not found");
  return json(200, { group: r.Item });
}

async function update(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const name = body && body.name;
  if (!name || typeof name !== "string" || !name.trim()) return badRequest("name is required");
  const ts = now();
  await doc.update({
    TableName: TABLES.groups,
    Key: { id: groupId },
    UpdateExpression: "SET #n = :n, updatedAt = :t",
    ExpressionAttributeNames: { "#n": "name" },
    ExpressionAttributeValues: { ":n": name.trim(), ":t": ts },
  }).promise();
  const r = await doc.get({ TableName: TABLES.groups, Key: { id: groupId } }).promise();
  return json(200, { group: r.Item });
}

module.exports = { list, create, get, update };
