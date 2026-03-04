import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

export default function Dashboard() {
  const { token, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

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
        const [txData, catData] = await Promise.all([
          api(() => token, `/groups/${selectedGroup}/transactions?month=${month}`),
          api(() => token, `/groups/${selectedGroup}/categories`),
        ]);
        if (!cancelled) setRecent((txData.transactions || []).slice(0, 5));
        if (!cancelled) setCategories(catData.categories || []);
      } catch (_) {
        if (!cancelled) setRecent([]);
        if (!cancelled) setCategories([]);
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
      setShowCreateGroup(false);
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
  const categoryIdToName = Object.fromEntries((categories || []).map((c) => [c.categoryId, c.name]));

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
            <button
              type="button"
              onClick={() => setShowCreateGroup((v) => !v)}
              className="py-2 px-3 rounded-md border border-input bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              {showCreateGroup ? "Cancel" : "New group"}
            </button>
          </div>

          {showCreateGroup && (
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
              <p className="text-sm text-muted-foreground">Create another group to track spending separately.</p>
              <form onSubmit={handleCreateGroup} className="flex flex-wrap items-end gap-3">
                <label className="flex-1 min-w-[12rem]">
                  <span className="text-sm font-medium text-foreground block mb-1">Group name</span>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Travel"
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
              {error && (
                <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
              )}
            </div>
          )}

          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">This month</h2>
            <p className="text-2xl font-semibold text-foreground">{totalMonth.toFixed(2)}</p>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Recent transactions</h2>
            {recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">No transactions this month.</p>
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
                    {recent.map((t) => (
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
