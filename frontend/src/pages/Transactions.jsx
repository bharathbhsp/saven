import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const inputClass =
  "px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function Transactions() {
  const { token, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("month");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(() => token, "/groups");
        if (!cancelled) {
          setGroups(data.groups || []);
          if ((data.groups || []).length > 0 && !groupId) setGroupId(data.groups[0].id);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [token]);

  function queryString() {
    if (filter === "day") return `day=${day}`;
    if (filter === "month") return `month=${month}`;
    return `startDate=${startDate}&endDate=${endDate}`;
  }

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api(() => token, `/groups/${groupId}/categories`);
        if (!cancelled) setCategories(data.categories || []);
      } catch (_) {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, groupId]);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        setError(null);
        const q = queryString();
        if (filter === "range" && (!startDate || !endDate)) {
          if (!cancelled) setTransactions([]);
          return;
        }
        const data = await api(
          () => token,
          `/groups/${groupId}/transactions?${q}`
        );
        if (!cancelled) setTransactions(data.transactions || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, groupId, filter, day, month, startDate, endDate]);

  const total = transactions.reduce((s, t) => s + (t.amount || 0), 0);
  const categoryIdToName = Object.fromEntries((categories || []).map((c) => [c.categoryId, c.name]));

  function exportStartEnd() {
    if (filter === "day") return { startDate: day, endDate: day };
    if (filter === "month") {
      const [y, m] = month.split("-");
      const last = new Date(Number(y), Number(m), 0).getDate();
      return {
        startDate: `${month}-01`,
        endDate: `${month}-${String(last).padStart(2, "0")}`,
      };
    }
    return { startDate, endDate };
  }

  async function handleExport(format) {
    if (!groupId) return;
    const { startDate: s, endDate: e } = exportStartEnd();
    if (!s || !e) return;
    setExporting(format);
    try {
      const res = await fetch(
        `${API_URL}/groups/${groupId}/export/${format}?startDate=${s}&endDate=${e}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const ext = format === "pdf" ? "pdf" : "csv";
      downloadBlob(blob, `saven-export.${ext}`);
    } catch (err) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-foreground">Transactions</h1>
        <Link
          to="/add"
          className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          Add transaction
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground">No groups.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={inputClass}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={inputClass}
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
              <option value="range">Date range</option>
            </select>
            {filter === "day" && (
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={inputClass}
              />
            )}
            {filter === "month" && (
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={inputClass}
              />
            )}
            {filter === "range" && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exporting || (filter === "range" && (!startDate || !endDate))}
              onClick={() => handleExport("csv")}
              className="py-2 px-3 rounded-md border border-input bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-60 transition-colors"
            >
              {exporting === "csv" ? "…" : "Export CSV"}
            </button>
            <button
              type="button"
              disabled={exporting || (filter === "range" && (!startDate || !endDate))}
              onClick={() => handleExport("pdf")}
              className="py-2 px-3 rounded-md border border-input bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-60 transition-colors"
            >
              {exporting === "pdf" ? "…" : "Export PDF"}
            </button>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <p className="text-lg font-medium text-foreground">Total: {total.toFixed(2)}</p>
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No transactions for this filter.</p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left text-muted-foreground font-medium">
                        <th className="px-4 py-2.5 w-24">Date</th>
                        <th className="px-4 py-2.5 min-w-[4rem]">Amount</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Note</th>
                        <th className="px-4 py-2.5 w-36">Date of entry</th>
                        <th className="px-4 py-2.5">Submitted by</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {transactions.map((t) => (
                        <tr key={t.sk || t.transactionId}>
                          <td className="px-4 py-3 text-muted-foreground">{t.date}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{t.amount}</td>
                          <td className="px-4 py-3 text-muted-foreground">{categoryIdToName[t.categoryId] ?? t.categoryId}</td>
                          <td className="px-4 py-3 text-muted-foreground/80 truncate max-w-[12rem]">{t.note ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {t.createdAt
                              ? new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {t.userId === user?.sub ? "You" : t.userId ? `…${String(t.userId).slice(-8)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
