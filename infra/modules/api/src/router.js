/**
 * Simple router: match method + path to route key and params.
 * Path params: :groupId, :userId, :categoryId, :transactionId
 */
function match(method, path) {
  const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  // GET /health
  if (method === "GET" && segments.length === 1 && segments[0] === "health") {
    return { route: "health", params: {} };
  }
  // POST /telegram/link-code (Phase 6 — create one-time code for /link)
  if (segments[0] === "telegram" && segments[1] === "link-code" && segments.length === 2 && method === "POST") {
    return { route: "telegramLinkCode.create", params: {} };
  }
  // /groups
  if (segments[0] === "groups") {
    if (segments.length === 1) {
      if (method === "GET") return { route: "groups.list", params: {} };
      if (method === "POST") return { route: "groups.create", params: {} };
    }
    const groupId = segments[1];
    if (!groupId) return null;
    // /groups/:groupId
    if (segments.length === 2) {
      if (method === "GET") return { route: "groups.get", params: { groupId } };
      if (method === "PATCH") return { route: "groups.update", params: { groupId } };
    }
    // /groups/:groupId/members
    if (segments[2] === "members") {
      if (segments.length === 3) {
        if (method === "GET") return { route: "members.list", params: { groupId } };
        if (method === "POST") return { route: "members.add", params: { groupId } };
      }
      if (segments.length === 4 && method === "DELETE") {
        return { route: "members.remove", params: { groupId, userId: segments[3] } };
      }
    }
    // /groups/:groupId/categories
    if (segments[2] === "categories") {
      if (segments.length === 3) {
        if (method === "GET") return { route: "categories.list", params: { groupId } };
        if (method === "POST") return { route: "categories.create", params: { groupId } };
      }
      if (segments.length === 4) {
        const categoryId = segments[3];
        if (method === "GET") return { route: "categories.get", params: { groupId, categoryId } };
        if (method === "PATCH") return { route: "categories.update", params: { groupId, categoryId } };
        if (method === "DELETE") return { route: "categories.archive", params: { groupId, categoryId } };
      }
    }
    // /groups/:groupId/transactions
    if (segments[2] === "transactions") {
      if (segments.length === 3) {
        if (method === "GET") return { route: "transactions.list", params: { groupId } };
        if (method === "POST") return { route: "transactions.create", params: { groupId } };
      }
      if (segments.length === 4 && (method === "GET" || method === "PATCH" || method === "DELETE")) {
        return {
          route: method === "GET" ? "transactions.get" : method === "PATCH" ? "transactions.update" : "transactions.delete",
          params: { groupId, transactionId: segments[3] },
        };
      }
    }
    // /groups/:groupId/export/csv | /groups/:groupId/export/pdf (Phase 5)
    if (segments[2] === "export" && segments.length === 4 && method === "GET") {
      const format = segments[3];
      if (format === "csv") return { route: "export.csv", params: { groupId } };
      if (format === "pdf") return { route: "export.pdf", params: { groupId } };
    }
  }
  return null;
}

module.exports = { match };
