const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export async function api(getToken, path, options = {}) {
  const token = typeof getToken === "function" ? getToken() : getToken;
  const url = path.startsWith("http") ? path : `${API_URL}${path.startsWith("/") ? path : "/" + path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      try {
        sessionStorage.removeItem("saven_id_token");
      } catch (_) {}
      window.location.replace("/login");
    }
    let body;
    try {
      body = await res.json();
    } catch {
      body = { error: "Unknown", message: res.statusText };
    }
    const err = new Error(body.message || body.error || "Request failed");
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const contentType = res.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return res.json();
  if (contentType.includes("text/csv") || contentType.includes("application/pdf")) return res.blob();
  return res.text();
}

export function exportUrl(getToken, groupId, format, startDate, endDate, categoryId) {
  const token = typeof getToken === "function" ? getToken() : getToken;
  const params = new URLSearchParams({ startDate, endDate });
  if (categoryId) params.set("categoryId", categoryId);
  const path = `${API_URL}/groups/${groupId}/export/${format}?${params}`;
  return { url: path, token };
}
