import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

export default function Dashboard() {
  const { token } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api(() => token, "/groups");
        if (!cancelled) setGroups(data.groups || []);
        if (!cancelled && (data.groups || []).length > 0 && !selectedGroup)
          setSelectedGroup(data.groups[0].id);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load groups");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!selectedGroup) return;
    let cancelled = false;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    (async () => {
      try {
        const data = await api(
          () => token,
          `/groups/${selectedGroup}/transactions?month=${month}`
        );
        if (!cancelled) setRecent((data.transactions || []).slice(0, 10));
      } catch (_) {
        if (!cancelled) setRecent([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, selectedGroup]);

  async function handleCreateGroup(e) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const data = await api(() => token, "/groups", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim() }),
      });
      setGroups((prev) => [...prev, data.group]);
      setSelectedGroup(data.group.id);
      setCreateName("");
    } catch (e) {
      setError(e.message || "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error && groups.length > 0) return <div className="error">{error}</div>;

  const totalMonth = recent.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="page dashboard">
      <h1>Dashboard</h1>
      {groups.length === 0 ? (
        <>
          <p>Create a group to start tracking spending.</p>
          <form onSubmit={handleCreateGroup} className="form" style={{ maxWidth: "20rem" }}>
            {error && <div className="error">{error}</div>}
            <label>
              Group name
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Household"
                required
              />
            </label>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? "Creating…" : "Create group"}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="dashboard-group">
            <label>Group</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <section className="summary">
            <h2>This month</h2>
            <p className="total">{totalMonth.toFixed(2)}</p>
          </section>
          <section>
            <h2>Recent transactions</h2>
            {recent.length === 0 ? (
              <p>No transactions this month.</p>
            ) : (
              <ul className="transaction-list">
                {recent.map((t) => (
                  <li key={t.sk || t.transactionId}>
                    <span className="date">{t.date}</span>
                    <span className="amount">{t.amount}</span>
                    <span className="cat">{t.categoryId}</span>
                    {t.note && <span className="note">{t.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p>
            <Link to="/add" className="btn-primary">Add transaction</Link>
            {" "}
            <Link to="/transactions">View all & filter</Link>
          </p>
        </>
      )}
    </div>
  );
}
