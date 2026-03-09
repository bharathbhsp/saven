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
  let q = event.queryStringParameters;
  if (!q || typeof q !== "object") {
    const raw = event.rawQueryString || event.queryString;
    if (typeof raw === "string" && raw.trim()) {
      q = Object.fromEntries(new URLSearchParams(raw));
    } else {
      return {};
    }
  }
  const out = { ...q };
  if (q.paymentmode !== undefined) out.paymentMode = q.paymentmode;
  if (q.transactiontype !== undefined) out.transactionType = q.transactiontype;
  if (q.startdate !== undefined) out.startDate = q.startdate;
  if (q.enddate !== undefined) out.endDate = q.enddate;
  if (q.categoryid !== undefined) out.categoryId = q.categoryid;
  return out;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

exports.handler = async (event) => {
  const routeKey = event?.requestContext?.routeKey;
  if (routeKey === "GET /health") {
    return json(200, { status: "ok", phase: 2 });
  }

  const method = getMethod(event);
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  const path = getPath(event);
  if (method === "POST" && path === "/webhook/telegram") {
    const telegram = require("./telegram");
    return telegram.handle(event);
  }

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

  const exportHandler = require("./handlers/export");
  const telegramLinkCode = require("./handlers/telegramLinkCode");
  const telegramLink = require("./handlers/telegramLink");
  const telegramChatLinkCode = require("./handlers/telegramChatLinkCode");
  const telegramChatLinks = require("./handlers/telegramChatLinks");
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
    "export.csv": (p, b, uid, q) => exportHandler.csv(p, b, uid, q),
    "export.pdf": (p, b, uid, q) => exportHandler.pdf(p, b, uid, q),
    "telegramLinkCode.create": (p, b, uid) => telegramLinkCode.create(p, b, uid),
    "telegramLink.get": (p, b, uid) => telegramLink.get(p, b, uid),
    "telegramLink.update": (p, b, uid) => telegramLink.update(p, b, uid),
    "telegramChatLinkCode.create": (p, b, uid) => telegramChatLinkCode.create(p, b, uid),
    "telegramChatLinks.list": (p, b, uid) => telegramChatLinks.list(p, b, uid),
  };

  const handler = HANDLERS[route.route];
  if (!handler) return badRequest("Handler not found");

  const body = parseBody(event);
  const query = parseQuery(event);

  try {
    const db = require("./db");
    if (typeof db.ensureTables === "function") db.ensureTables();
    if (
      route.route === "transactions.list" ||
      route.route === "transactions.get" ||
      route.route === "transactions.delete" ||
      route.route === "export.csv" ||
      route.route === "export.pdf"
    ) {
      return await handler(route.params, body, userId, query);
    }
    return await handler(route.params, body, userId);
  } catch (err) {
    console.error(route.route, err.message || err);
    if (err.stack) console.error(err.stack);
    const msg = err.message && /Missing Lambda env|TableName|ResourceNotFoundException|AccessDenied/i.test(err.message)
      ? err.message
      : "An error occurred";
    return json(500, { error: "InternalServerError", message: msg });
  }
};
