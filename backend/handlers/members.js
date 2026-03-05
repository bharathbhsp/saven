const { CognitoIdentityProviderClient, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { doc, TABLES, requireMember, now } = require("../db");
const { json, badRequest, forbidden, notFound } = require("../responses");

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const cognito = userPoolId ? new CognitoIdentityProviderClient({}) : null;

async function resolveUserIdByEmail(email) {
  if (!cognito || !userPoolId) return null;
  const trimmed = email && typeof email === "string" ? email.trim() : "";
  if (!trimmed) return null;
  // Cognito ListUsers filter: exact match. Use plain quotes; SDK escapes when serializing to JSON.
  const Filter = `email = "${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const cmd = new ListUsersCommand({
    UserPoolId: userPoolId,
    Filter,
    Limit: 2,
  });
  let res;
  try {
    res = await cognito.send(cmd);
  } catch (err) {
    const code = err.name || err.code || "";
    const msg = err.message || String(err);
    if (/InvalidParameter|InvalidParameterException/i.test(code)) {
      throw new Error("Invalid email format or lookup failed. Try the exact email they use to sign in.");
    }
    if (/NotAuthorized|AccessDenied|ResourceNotFoundException/i.test(code)) {
      throw new Error("Unable to look up users. Check that the API has permission to list users in the Cognito user pool.");
    }
    throw new Error(msg || "Could not look up user by email.");
  }
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
  if (!userPoolId || !cognito) {
    return badRequest("Add member by email is not configured. Deploy the API with COGNITO_USER_POOL_ID set.");
  }
  let targetUserId;
  try {
    targetUserId = await resolveUserIdByEmail(email);
  } catch (err) {
    return badRequest(err.message || "Could not look up user by email.");
  }
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
