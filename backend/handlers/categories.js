const { doc, TABLES, requireMember, now, uuid } = require("../db");
const { json, badRequest, forbidden, notFound } = require("../responses");

const DEFAULT_CATEGORIES = [
  { categoryId: "default-food", name: "Food" },
  { categoryId: "default-transport", name: "Transport" },
  { categoryId: "default-shopping", name: "Shopping" },
  { categoryId: "default-bills", name: "Bills" },
  { categoryId: "default-entertainment", name: "Entertainment" },
  { categoryId: "default-health", name: "Health" },
  { categoryId: "default-other", name: "Other" },
];

async function ensureGlobalDefaults(userId) {
  const r = await doc.query({
    TableName: TABLES.categories,
    KeyConditionExpression: "groupId = :gid",
    ExpressionAttributeValues: { ":gid": "GLOBAL" },
  }).promise();
  const items = r.Items || [];
  if (items.length > 0) return;
  const ts = now();
  for (const { categoryId, name } of DEFAULT_CATEGORIES) {
    await doc.put({
      TableName: TABLES.categories,
      Item: {
        groupId: "GLOBAL",
        categoryId,
        name,
        archived: false,
        createdAt: ts,
        updatedAt: ts,
        createdBy: userId,
      },
    }).promise();
  }
}

async function queryAll(TableName, KeyConditionExpression, ExpressionAttributeValues) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const params = {
      TableName,
      KeyConditionExpression,
      ExpressionAttributeValues,
    };
    if (ExclusiveStartKey) params.ExclusiveStartKey = ExclusiveStartKey;
    const r = await doc.query(params).promise();
    items.push(...(r.Items || []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function list(params, body, userId) {
  const { groupId } = params;
  const isMember = await requireMember(groupId, userId);
  if (!isMember) return forbidden("Not a member of this group");
  await ensureGlobalDefaults(userId);
  const [groupItems, globalItems] = await Promise.all([
    queryAll(TABLES.categories, "groupId = :gid", { ":gid": groupId }),
    queryAll(TABLES.categories, "groupId = :gid", { ":gid": "GLOBAL" }),
  ]);
  const group = groupItems.filter((c) => !c.archived);
  const global = globalItems.filter((c) => !c.archived);
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
