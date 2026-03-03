const { match } = require("./router");
const { json, badRequest, unauthorized } = require("./responses");

function getMethod(event) {
  if (!event || !event.requestContext) return "GET";
  return event.requestContext.http?.method ?? event.requestContext.httpMethod ?? event.httpMethod ?? "GET";
}

function getPath(event) {
  if (!event) return "/";
  const raw = event.rawPath ?? event.requestContext?.http?.path ?? event.path;
  return typeof raw === "string" ? raw : "/";
}

function getUserId(event) {
  if (!event || !event.requestContext) return null;
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (!claims || !claims.sub) return null;
  return claims.sub;
}

function parseBody(event) {
  if (!event || !event.body) return {};
  try {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return {};
  }
}

function parseQuery(event) {
  if (!event) return {};
  return event.queryStringParameters || {};
}

exports.handler = async (event) => {
  const routeKey = event?.requestContext?.routeKey;
  if (routeKey === "GET /health") {
    return json(200, { status: "ok", phase: 2 });
  }

  const method = getMethod(event);
  const path = getPath(event);
  const route = match(method, path);

  if (!route) {
    return badRequest("Unknown route: " + method + " " + path);
  }

  if (route.route === "health") {
    return json(200, { status: "ok", phase: 2 });
  }

  const userId = getUserId(event);
  if (!userId) return unauthorized("Missing or invalid token");

  const groups = require("./handlers/groups");
  const members = require("./handlers/members");
  const categories = require("./handlers/categories");
  const transactions = require("./handlers/transactions");

  const HANDLERS = {
    "groups.list": (p, b, uid) => groups.list(p, b, uid),
    "groups.create": (p, b, uid) => groups.create(p, b, uid),
    "groups.get": (p, b, uid) => groups.get(p, b, uid),
    "groups.update": (p, b, uid) => groups.update(p, b, uid),
    "members.list": (p, b, uid) => members.list(p, b, uid),
    "members.add": (p, b, uid) => members.add(p, b, uid),
    "members.remove": (p, b, uid) => members.remove(p, b, uid),
    "categories.list": (p, b, uid) => categories.list(p, b, uid),
    "categories.create": (p, b, uid) => categories.create(p, b, uid),
    "categories.get": (p, b, uid) => categories.get(p, b, uid),
    "categories.update": (p, b, uid) => categories.update(p, b, uid),
    "categories.archive": (p, b, uid) => categories.archive(p, b, uid),
    "transactions.list": (p, b, uid, q) => transactions.list(p, b, uid, q),
    "transactions.create": (p, b, uid) => transactions.create(p, b, uid),
    "transactions.get": (p, b, uid, q) => transactions.get(p, b, uid, q),
    "transactions.update": (p, b, uid) => transactions.update(p, b, uid),
    "transactions.delete": (p, b, uid, q) => transactions.delete(p, b, uid, q),
  };

  const handler = HANDLERS[route.route];
  if (!handler) return badRequest("Handler not found");

  const body = parseBody(event);
  const query = parseQuery(event);

  try {
    if (route.route === "transactions.list" || route.route === "transactions.get" || route.route === "transactions.delete") {
      return await handler(route.params, body, userId, query);
    }
    return await handler(route.params, body, userId);
  } catch (err) {
    console.error(route.route, err);
    return json(500, { error: "InternalServerError", message: "An error occurred" });
  }
};
