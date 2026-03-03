/**
 * Placeholder Lambda for Phase 0. Replace with real router in Phase 3.
 */
exports.handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path = event.requestContext?.http?.path ?? event.path ?? "/";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      message: "Saven API (placeholder)",
      method,
      path,
      phase: 0,
    }),
  };
};
