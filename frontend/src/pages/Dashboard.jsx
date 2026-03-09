import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { formatCurrency, getTransactionType } from "../config";

function signedAmount(t) {
  const amt = t.amount ?? 0;
  return getTransactionType(t) === "credit" ? amt : -amt;
}

export default function Dashboard() {
  const { token, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const [todayNet, setTodayNet] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [monthNet, setMonthNet] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [groupTotals, setGroupTotals] = useState([]);
  const [recentCategories, setRecentCategories] = useState([]);
  const [categoryIdToName, setCategoryIdToName] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api(() => token, "/groups");
        if (!cancelled) setGroups(data.groups || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load groups");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!groups.length) {
      setRecent([]);
      setTodayNet(0);
      setTodayCount(0);
      setMonthNet(0);
      setMonthCount(0);
      setGroupTotals([]);
      setRecentCategories([]);
      setCategoryIdToName({});
      return;
    }
    let cancelled = false;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayStr = now.toISOString().slice(0, 10);
    (async () => {
      try {
        const [txResults, catResults] = await Promise.all([
          Promise.all(groups.map((g) => api(() => token, `/groups/${g.id}/transactions?month=${month}`))),
          Promise.all(groups.map((g) => api(() => token, `/groups/${g.id}/categories`))),
        ]);
        if (cancelled) return;
        const withGroup = txResults.flatMap((data, i) => (data.transactions || []).map((t) => ({ ...t, _groupId: groups[i].id, _groupName: groups[i].name })));
        withGroup.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        const top5 = withGroup.slice(0, 5);
        const todays = withGroup.filter((t) => t.date === todayStr);
        const todayNetVal = todays.reduce((s, t) => s + signedAmount(t), 0);
        const todayNum = todays.length;
        const monthNetVal = withGroup.reduce((s, t) => s + signedAmount(t), 0);
        const monthNum = withGroup.length;
        const catMap = {};
        catResults.forEach((data) => {
          (data.categories || []).forEach((c) => {
            if (!catMap[c.categoryId]) catMap[c.categoryId] = c.name;
          });
        });
        const byGroup = {};
        withGroup.forEach((t) => {
          const gid = t._groupId;
          const gname = t._groupName || gid;
          if (!byGroup[gid]) byGroup[gid] = { groupName: gname, net: 0, lastUsed: 0 };
          byGroup[gid].net += signedAmount(t);
          const ts = t.createdAt ? new Date(t.createdAt).getTime() : 0;
          if (ts > byGroup[gid].lastUsed) byGroup[gid].lastUsed = ts;
        });
        const groupTotalsList = Object.entries(byGroup)
          .map(([groupId, { groupName, net, lastUsed }]) => ({
            groupId,
            groupName,
            net,
            lastUsed,
          }))
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, 6);

        const byCategory = {};
        withGroup.forEach((t) => {
          const cid = t.categoryId || "default-other";
          if (!byCategory[cid]) byCategory[cid] = { net: 0, lastUsed: 0 };
          byCategory[cid].net += signedAmount(t);
          const ts = t.createdAt ? new Date(t.createdAt).getTime() : 0;
          if (ts > byCategory[cid].lastUsed) byCategory[cid].lastUsed = ts;
        });
        const recentCategoriesList = Object.entries(byCategory)
          .map(([categoryId, { net, lastUsed }]) => ({
            categoryId,
            categoryName: catMap[categoryId] || categoryId,
            net,
            lastUsed,
          }))
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, 3);

        setRecent(top5);
        setTodayNet(todayNetVal);
        setTodayCount(todayNum);
        setMonthNet(monthNetVal);
        setMonthCount(monthNum);
        setGroupTotals(groupTotalsList);
        setRecentCategories(recentCategoriesList);
        setCategoryIdToName(catMap);
      } catch (_) {
        if (!cancelled) {
          setRecent([]);
          setTodayNet(0);
          setTodayCount(0);
          setMonthNet(0);
          setMonthCount(0);
          setGroupTotals([]);
          setRecentCategories([]);
          setCategoryIdToName({});
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, groups]);

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

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Dashboard</h1>

      {groups.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">Create a group to start tracking spending.</p>
          <Link
            to="/groups"
            className="inline-flex py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Groups to create one
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Today&apos;s net</p>
              <p className={`text-2xl font-semibold ${todayNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(todayNet)}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {todayCount} {todayCount === 1 ? "transaction" : "transactions"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                This month&apos;s net
              </p>
              <p className={`text-2xl font-semibold ${monthNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(monthNet)}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {monthCount} {monthCount === 1 ? "transaction" : "transactions"}
              </p>
            </div>
          </div>

          {groupTotals.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                By group (most recent)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupTotals.map(({ groupId, groupName, net }) => (
                  <div
                    key={groupId}
                    className="rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <p className="text-sm font-medium text-muted-foreground truncate">
                      {groupName}
                    </p>
                    <p className={`text-xl font-semibold mt-0.5 ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(net)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recentCategories.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Recent categories
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentCategories.map(({ categoryId, categoryName, net }) => (
                  <div
                    key={categoryId}
                    className="rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <p className="text-sm font-medium text-muted-foreground truncate">
                      {categoryName}
                    </p>
                    <p className={`text-xl font-semibold mt-0.5 ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(net)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Recent transactions</h2>
            {recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent transactions.</p>
            ) : (
              <TableContainer component={Paper} className="-mx-4 sm:mx-0" sx={{ maxWidth: "100%" }}>
                <Table size="small" stickyHeader aria-label="Recent transactions">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>Date of entry</TableCell>
                      <TableCell>Group</TableCell>
                      <TableCell>Amount (₹)</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell sx={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>Note</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>Submitted by</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recent.map((t) => (
                      <TableRow key={`${t._groupId}-${t.sk || t.transactionId}`} hover>
                        <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                          {t.createdAt
                            ? new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </TableCell>
                        <TableCell>{t._groupName}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {formatCurrency(signedAmount(t))}
                        </TableCell>
                        <TableCell>{categoryIdToName[t.categoryId] ?? t.categoryId}</TableCell>
                        <TableCell sx={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{t.note ?? "—"}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                          {t.userId === user?.sub ? "You" : t.userId ? `…${String(t.userId).slice(-8)}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
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
              className="inline-flex py-2 px-4 rounded-md border border-input bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              View all & filter
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
