const { doc, TABLES, requireMember, now } = require("../db");
const { json, badRequest, forbidden, notFound } = require("../responses");

async function list(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const r = await doc.query({
    TableName: TABLES.group_members,
    KeyConditionExpression: "groupId = :gid",
    ExpressionAttributeValues: { ":gid": groupId },
  }).promise();
  return json(200, { members: r.Items || [] });
}

async function add(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const targetUserId = body && body.userId;
  if (!targetUserId || typeof targetUserId !== "string" || !targetUserId.trim()) return badRequest("userId is required");
  const ts = now();
  await doc.put({
    TableName: TABLES.group_members,
    Item: { groupId, userId: targetUserId.trim(), role: "member", joinedAt: ts },
  }).promise();
  const member = { groupId, userId: targetUserId.trim(), role: "member", joinedAt: ts };
  return json(201, { member });
}

async function remove(params, body, userId) {
  const { groupId, userId: targetUserId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const existing = await doc.get({
    TableName: TABLES.group_members,
    Key: { groupId, userId: targetUserId },
  }).promise();
  if (!existing.Item) return notFound("Member not found");
  await doc.delete({
    TableName: TABLES.group_members,
    Key: { groupId, userId: targetUserId },
  }).promise();
  return json(200, { ok: true });
}

module.exports = { list, add, remove };
