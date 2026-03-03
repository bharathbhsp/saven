import { useState, useEffect } from "react";
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
  const { token } = useAuth();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [transactions, setTransactions] = useState([]);
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
      <h1 className="text-xl font-semibold text-foreground mb-6">Transactions</h1>

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
                <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
                  {transactions.map((t) => (
                    <li key={t.sk || t.transactionId} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                      <span className="text-muted-foreground w-24">{t.date}</span>
                      <span className="font-medium text-foreground min-w-[4rem]">{t.amount}</span>
                      <span className="text-muted-foreground">{t.categoryId}</span>
                      {t.note && <span className="text-muted-foreground/80 truncate max-w-[12rem]">{t.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
