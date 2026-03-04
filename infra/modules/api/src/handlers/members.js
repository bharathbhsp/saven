const { CognitoIdentityProviderClient, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { doc, TABLES, requireMember, now } = require("../db");
const { json, badRequest, forbidden, notFound } = require("../responses");

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const cognito = userPoolId ? new CognitoIdentityProviderClient({}) : null;

async function resolveUserIdByEmail(email) {
  if (!cognito || !userPoolId) return null;
  const trimmed = email && typeof email === "string" ? email.trim() : "";
  if (!trimmed) return null;
  const Filter = `email = \\"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}\\"`;
  const cmd = new ListUsersCommand({
    UserPoolId: userPoolId,
    Filter,
    Limit: 2,
  });
  const res = await cognito.send(cmd);
  const users = res.Users || [];
  if (users.length !== 1) return null;
  const subAttr = (users[0].Attributes || []).find((a) => a.Name === "sub");
  return subAttr ? subAttr.Value : users[0].Username;
}

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
  const email = body && body.email;
  if (!email || typeof email !== "string" || !email.trim()) return badRequest("email is required");
  let targetUserId = await resolveUserIdByEmail(email);
  if (!targetUserId) return badRequest("No user found with that email address");
  const ts = now();
  await doc.put({
    TableName: TABLES.group_members,
    Item: { groupId, userId: targetUserId, role: "member", joinedAt: ts },
  }).promise();
  const member = { groupId, userId: targetUserId, role: "member", joinedAt: ts };
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
