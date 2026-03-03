const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

function error(statusCode, code, message) {
  return json(statusCode, { error: code, message });
}

function badRequest(message) {
  return error(400, "BadRequest", message || "Invalid request");
}

function unauthorized(message) {
  return error(401, "Unauthorized", message || "Missing or invalid token");
}

function forbidden(message) {
  return error(403, "Forbidden", message || "Not allowed");
}

function notFound(message) {
  return error(404, "NotFound", message || "Resource not found");
}

module.exports = { json, error, badRequest, unauthorized, forbidden, notFound };
