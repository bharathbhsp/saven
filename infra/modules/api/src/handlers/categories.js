const { doc, TABLES, requireMember, now, uuid } = require("../db");
const { json, badRequest, forbidden, notFound } = require("../responses");

async function list(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const [groupCat, globalCat] = await Promise.all([
    doc.query({
      TableName: TABLES.categories,
      KeyConditionExpression: "groupId = :gid",
      ExpressionAttributeValues: { ":gid": groupId },
    }).promise(),
    doc.query({
      TableName: TABLES.categories,
      KeyConditionExpression: "groupId = :gid",
      ExpressionAttributeValues: { ":gid": "GLOBAL" },
    }).promise(),
  ]);
  const group = (groupCat.Items || []).filter((c) => !c.archived);
  const global = (globalCat.Items || []).filter((c) => !c.archived);
  const categories = [...global, ...group];
  return json(200, { categories });
}

async function create(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const name = body && body.name;
  if (!name || typeof name !== "string" || !name.trim()) return badRequest("name is required");
  const categoryId = uuid();
  const ts = now();
  const item = {
    groupId,
    categoryId,
    name: name.trim(),
    archived: false,
    createdAt: ts,
    updatedAt: ts,
    createdBy: userId,
  };
  await doc.put({ TableName: TABLES.categories, Item: item }).promise();
  return json(201, { category: item });
}

async function get(params, body, userId) {
  const { groupId, categoryId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const r = await doc.get({
    TableName: TABLES.categories,
    Key: { groupId, categoryId },
  }).promise();
  if (!r.Item) {
    const global = await doc.get({
      TableName: TABLES.categories,
      Key: { groupId: "GLOBAL", categoryId },
    }).promise();
    if (!global.Item) return notFound("Category not found");
    return json(200, { category: global.Item });
  }
  return json(200, { category: r.Item });
}

async function update(params, body, userId) {
  const { groupId, categoryId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  const r = await doc.get({
    TableName: TABLES.categories,
    Key: { groupId, categoryId },
  }).promise();
  if (!r.Item) return notFound("Category not found");
  const name = body && body.name;
  const archived = body && body.archived;
  const updates = [];
  const names = {};
  const values = { ":t": now() };
  if (name !== undefined && typeof name === "string") {
    updates.push("#n = :n");
    names["#n"] = "name";
    values[":n"] = name.trim();
  }
  if (archived !== undefined && typeof archived === "boolean") {
    updates.push("archived = :a");
    values[":a"] = archived;
  }
  if (updates.length === 0) return json(200, { category: r.Item });
  updates.push("updatedAt = :t");
  await doc.update({
    TableName: TABLES.categories,
    Key: { groupId, categoryId },
    UpdateExpression: "SET " + updates.join(", "),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }).promise();
  const out = await doc.get({
    TableName: TABLES.categories,
    Key: { groupId, categoryId },
  }).promise();
  return json(200, { category: out.Item });
}

async function archive(params, body, userId) {
  return update({ ...params }, { ...body, archived: true }, userId);
}

module.exports = { list, create, get, update, archive };
