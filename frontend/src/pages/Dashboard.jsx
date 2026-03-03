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

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">Loading…</div>
    );
  }
  if (error && groups.length > 0) {
    return (
      <div className="py-4 px-3 rounded-md bg-destructive/10 text-destructive text-sm">
        {error}
      </div>
    );
  }

  const totalMonth = recent.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Dashboard</h1>

      {groups.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">Create a group to start tracking spending.</p>
          <form onSubmit={handleCreateGroup} className="max-w-xs space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            <label className="block">
              <span className="text-sm font-medium text-foreground block mb-1">Group name</span>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Household"
                required
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </label>
            <button
              type="submit"
              disabled={creating}
              className="py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {creating ? "Creating…" : "Create group"}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-muted-foreground">Group</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">This month</h2>
            <p className="text-2xl font-semibold text-foreground">{totalMonth.toFixed(2)}</p>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Recent transactions</h2>
            {recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">No transactions this month.</p>
            ) : (
              <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
                {recent.map((t) => (
                  <li key={t.sk || t.transactionId} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="text-muted-foreground w-24">{t.date}</span>
                    <span className="font-medium text-foreground min-w-[4rem]">{t.amount}</span>
                    <span className="text-muted-foreground">{t.categoryId}</span>
                    {t.note && <span className="text-muted-foreground/80 truncate max-w-[12rem]">{t.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/add"
              className="inline-flex py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Add transaction
            </Link>
            <Link
              to="/transactions"
              className="inline-flex py-2 px-4 rounded-md border border-input bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              View all & filter
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
