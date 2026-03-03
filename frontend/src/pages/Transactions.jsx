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
    <div className="page">
      <h1>Transactions</h1>
      {groups.length === 0 ? (
        <p>No groups.</p>
      ) : (
        <>
          <div className="filters">
            <label>
              Group
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
            <label>
              Filter
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="day">Day</option>
                <option value="month">Month</option>
                <option value="range">Date range</option>
              </select>
            </label>
            {filter === "day" && (
              <label>Day <input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
            )}
            {filter === "month" && (
              <label>Month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
            )}
            {filter === "range" && (
              <>
                <label>From <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
                <label>To <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
              </>
            )}
          </div>
          {error && <div className="error">{error}</div>}
          <div className="export-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={exporting || (filter === "range" && (!startDate || !endDate))}
              onClick={() => handleExport("csv")}
            >
              {exporting === "csv" ? "…" : "Export CSV"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={exporting || (filter === "range" && (!startDate || !endDate))}
              onClick={() => handleExport("pdf")}
            >
              {exporting === "pdf" ? "…" : "Export PDF"}
            </button>
          </div>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <>
              <p className="total">Total: {total.toFixed(2)}</p>
              <ul className="transaction-list">
                {transactions.map((t) => (
                  <li key={t.sk || t.transactionId}>
                    <span className="date">{t.date}</span>
                    <span className="amount">{t.amount}</span>
                    <span className="cat">{t.categoryId}</span>
                    {t.note && <span className="note">{t.note}</span>}
                  </li>
                ))}
              </ul>
              {transactions.length === 0 && <p>No transactions for this filter.</p>}
            </>
          )}
        </>
      )}
    </div>
  );
}
