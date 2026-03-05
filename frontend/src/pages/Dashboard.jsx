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

export default function Dashboard() {
  const { token, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
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
      setTodayTotal(0);
      setTodayCount(0);
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
        const todaySum = todays.reduce((s, t) => s + (t.amount || 0), 0);
        const todayNum = todays.length;
        const catMap = {};
        catResults.forEach((data) => {
          (data.categories || []).forEach((c) => {
            if (!catMap[c.categoryId]) catMap[c.categoryId] = c.name;
          });
        });
        setRecent(top5);
        setTodayTotal(todaySum);
        setTodayCount(todayNum);
        setCategoryIdToName(catMap);
      } catch (_) {
        if (!cancelled) {
          setRecent([]);
          setTodayTotal(0);
          setTodayCount(0);
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
          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Today</h2>
            <p className="text-2xl font-semibold text-foreground">
              {todayTotal.toFixed(2)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({todayCount} {todayCount === 1 ? "transaction" : "transactions"})
              </span>
            </p>
          </section>

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
                      <TableCell>Amount</TableCell>
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
                        <TableCell sx={{ fontWeight: 600 }}>{t.amount}</TableCell>
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
