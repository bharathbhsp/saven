import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { formatCurrency, getTransactionType } from "../config";
import LoadingSpinner from "../components/LoadingSpinner";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function signedAmount(t) {
  const amt = t.amount ?? 0;
  return getTransactionType(t) === "credit" ? amt : -amt;
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const inputClass =
  "px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const ALL_START = "2000-01-01";
const ALL_END = "2030-12-31";

const PAYMENT_OPTIONS = [
  { value: "__all__", label: "All payment modes" },
  { value: "UPI", label: "UPI" },
  { value: "Cash", label: "Cash" },
  { value: "Credit card", label: "Credit card" },
  { value: "Debit card", label: "Debit card" },
  { value: "Netbanking", label: "Netbanking" },
  { value: "Wallet", label: "Wallet" },
  { value: "Other", label: "Other" },
];

const PAYMENT_OPTIONS_EDIT = [
  { value: "", label: "—" },
  ...PAYMENT_OPTIONS.filter((o) => o.value !== "__all__"),
];

const inputClassFull =
  "w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const ALL_GROUPS_ID = "__all_groups__";

export default function Transactions() {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(ALL_GROUPS_ID);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("__all__");
  const [typeFilter, setTypeFilter] = useState("__all__");
  const [exporting, setExporting] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editForm, setEditForm] = useState({ amount: "", transactionType: "debit", categoryId: "", paymentMode: "", note: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deleteConfirmTransaction, setDeleteConfirmTransaction] = useState(null);
  const [deleteDeleting, setDeleteDeleting] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(() => token, "/groups");
        if (!cancelled) {
          const list = data.groups || [];
          setGroups(list);
          const fromUrl = searchParams.get("groupId");
          if (list.length > 0) {
            if (fromUrl === ALL_GROUPS_ID) {
              setGroupId(ALL_GROUPS_ID);
            } else if (fromUrl && list.some((g) => g.id === fromUrl)) {
              setGroupId(fromUrl);
            } else if (!groupId) {
              setGroupId(ALL_GROUPS_ID);
            }
          }
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [token]);

  function queryString() {
    const params = new URLSearchParams();
    if (filter === "day") {
      params.set("day", day);
    } else if (filter === "month") {
      params.set("month", month);
    } else if (filter === "all") {
      params.set("startDate", ALL_START);
      params.set("endDate", ALL_END);
    } else {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    if (paymentFilter !== "__all__") params.set("paymentMode", paymentFilter);
    if (typeFilter === "credit" || typeFilter === "debit") params.set("transactionType", typeFilter);
    return params.toString();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(() => token, "/me/categories");
        if (!cancelled) setCategories(data.categories || []);
      } catch (_) {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!groupId) return;
    if (filter === "range" && (!startDate || !endDate)) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        setError(null);
        const q = queryString();
        if (groupId === ALL_GROUPS_ID) {
          if (!groups || groups.length === 0) {
            if (!cancelled) {
              setTransactions([]);
            }
          } else {
            const results = await Promise.all(
              groups.map((g) =>
                api(() => token, `/groups/${g.id}/transactions?${q}`).catch(() => ({ transactions: [] }))
              )
            );
            if (!cancelled) {
              const merged = results.flatMap((res, idx) =>
                (res.transactions || []).map((t) => ({
                  ...t,
                  groupId: groups[idx].id,
                  groupName: groups[idx].name,
                }))
              );
              setTransactions(merged);
            }
          }
        } else {
          const data = await api(
            () => token,
            `/groups/${groupId}/transactions?${q}`
          );
          if (!cancelled) setTransactions(data.transactions || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, groups, groupId, filter, day, month, startDate, endDate, paymentFilter, typeFilter]);

  const net = transactions.reduce((s, t) => s + signedAmount(t), 0);
  const categoryIdToName = Object.fromEntries((categories || []).map((c) => [c.categoryId, c.name]));
  const groupIdToName = Object.fromEntries((groups || []).map((g) => [g.id, g.name]));
  // Sort by date of entry (createdAt), latest first; items without createdAt go last
  const sortedTransactions = [...transactions].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  const totalRows = sortedTransactions.length;
  const maxPage = Math.max(0, Math.ceil(totalRows / rowsPerPage) - 1);
  const currentPage = Math.min(page, maxPage);
  const paginatedTransactions = sortedTransactions.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage
  );

  useEffect(() => {
    setPage((p) => Math.min(p, maxPage));
  }, [totalRows, rowsPerPage, maxPage]);

  useEffect(() => {
    setPage(0);
  }, [groupId, filter, day, month, startDate, endDate, paymentFilter, typeFilter]);

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
    if (filter === "all") return { startDate: ALL_START, endDate: ALL_END };
    return { startDate, endDate };
  }

  function exportQueryParams() {
    const { startDate: s, endDate: e } = exportStartEnd();
    const params = new URLSearchParams({ startDate: s, endDate: e });
    if (paymentFilter !== "__all__") params.set("paymentMode", paymentFilter);
    if (typeFilter === "credit" || typeFilter === "debit") params.set("transactionType", typeFilter);
    return params.toString();
  }

  function openEdit(t) {
    setEditingTransaction(t);
    setEditForm({
      amount: String(t.amount ?? ""),
      transactionType: getTransactionType(t) === "credit" ? "credit" : "debit",
      categoryId: t.categoryId || "",
      paymentMode: t.paymentMode || "",
      note: t.note || "",
    });
    setEditError(null);
  }

  function closeEdit() {
    setEditingTransaction(null);
    setEditError(null);
  }

  function openDeleteConfirm(t) {
    setDeleteConfirmTransaction(t);
  }

  function closeDeleteConfirm() {
    setDeleteConfirmTransaction(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirmTransaction || !groupId) return;
    setDeleteDeleting(true);
    try {
      await api(
        () => token,
        `/groups/${groupId}/transactions/${deleteConfirmTransaction.transactionId}?date=${encodeURIComponent(deleteConfirmTransaction.date)}`,
        { method: "DELETE" }
      );
      setTransactions((prev) =>
        prev.filter(
          (tx) =>
            !(tx.transactionId === deleteConfirmTransaction.transactionId && tx.date === deleteConfirmTransaction.date)
        )
      );
      closeDeleteConfirm();
    } catch (err) {
      setError(err.message || "Delete failed");
      closeDeleteConfirm();
    } finally {
      setDeleteDeleting(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!editingTransaction || !groupId) return;
    const num = parseFloat(editForm.amount, 10);
    if (Number.isNaN(num) || num < 0) {
      setEditError("Amount must be a non-negative number.");
      return;
    }
    if (!editForm.categoryId.trim()) {
      setEditError("Category is required.");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await api(() => token, `/groups/${groupId}/transactions/${editingTransaction.transactionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          date: editingTransaction.date,
          amount: num,
          transactionType: editForm.transactionType,
          categoryId: editForm.categoryId.trim(),
          paymentMode: editForm.paymentMode.trim() || "",
          note: editForm.note.trim() || undefined,
        }),
      });
      setTransactions((prev) =>
        prev.map((tx) =>
          tx.transactionId === editingTransaction.transactionId && tx.date === editingTransaction.date
            ? {
                ...tx,
                amount: num,
                transactionType: editForm.transactionType,
                categoryId: editForm.categoryId.trim(),
                paymentMode: editForm.paymentMode.trim() || "",
                note: editForm.note.trim() || undefined,
              }
            : tx
        )
      );
      closeEdit();
    } catch (err) {
      setEditError(err.message || "Update failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleExport(format) {
    if (!groupId) return;
    const { startDate: s, endDate: e } = exportStartEnd();
    if (!s || !e) return;
    setExporting(format);
    try {
      const q = exportQueryParams();
      const res = await fetch(
        `${API_URL}/groups/${groupId}/export/${format}?${q}`,
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
              aria-label="Group"
            >
              <option value={ALL_GROUPS_ID}>All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={inputClass}
              aria-label="Period"
            >
              <option value="all">All time</option>
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
              <option value="range">Date range</option>
            </select>
            {filter === "day" && (
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={inputClass}
                aria-label="Day"
              />
            )}
            {filter === "month" && (
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={inputClass}
                aria-label="Month"
              />
            )}
            {filter === "range" && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                  aria-label="Start date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                  aria-label="End date"
                />
              </>
            )}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className={inputClass}
              aria-label="Payment mode"
              title="Filter by payment mode"
            >
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={inputClass}
              aria-label="Transaction type"
              title="Filter by Credit or Spend"
            >
              <option value="__all__">All types (Credit and Spend)</option>
              <option value="credit">Credit</option>
              <option value="debit">Spend</option>
            </select>
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
            <LoadingSpinner label="Loading transactions…" inline />
          ) : (
            <>
              <p className="text-lg font-medium text-foreground">
                Net:{" "}
                <span className={net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  {formatCurrency(net)}
                </span>{" "}
                <span className="text-sm text-muted-foreground">
                  ({transactions.length} {transactions.length === 1 ? "transaction" : "transactions"})
                </span>
              </p>
              {transactions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No transactions for this filter.</p>
              ) : (
                <TableContainer component={Paper} className="-mx-4 sm:mx-0" sx={{ maxWidth: "100%" }}>
                  <Table size="small" stickyHeader aria-label="Transactions">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>Date of entry</TableCell>
                        <TableCell>Group</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Amount (₹)</TableCell>
                        <TableCell>Payment mode</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>Note</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>Submitted by</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", width: 90 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedTransactions.map((t) => (
                        <TableRow key={t.sk || t.transactionId} hover>
                          <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                            {t.createdAt
                              ? new Date(t.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {groupId === ALL_GROUPS_ID
                              ? t.groupName || groupIdToName[t.groupId] || "—"
                              : groupIdToName[groupId] || "—"}
                          </TableCell>
                          <TableCell sx={{ textTransform: "capitalize" }}>
                            {getTransactionType(t) === "credit" ? "Credit" : "Spend"}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              color: signedAmount(t) >= 0 ? "success.main" : "error.main",
                            }}
                          >
                            {formatCurrency(signedAmount(t))}
                          </TableCell>
                          <TableCell>{t.paymentMode || "—"}</TableCell>
                          <TableCell>{categoryIdToName[t.categoryId] ?? t.categoryId}</TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }} title={t.note ?? ""}>
                            {t.note ?? "—"}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                            {t.userId === user?.sub ? "You" : t.userId ? `…${String(t.userId).slice(-8)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Button size="small" variant="outlined" onClick={() => openEdit(t)} aria-label="Edit transaction">
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    component="div"
                    count={totalRows}
                    page={currentPage}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    labelRowsPerPage="Rows per page:"
                    showFirstButton
                    showLastButton
                  />
                </TableContainer>
              )}
            </>
          )}
        </div>
      )}

      <Dialog open={!!editingTransaction} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit transaction</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {editError && (
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 px-2 py-1.5 rounded" role="alert">
                {editError}
              </p>
            )}
            {editingTransaction && (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Date (transaction date)</span>
                  <input
                    type="text"
                    value={editingTransaction.date}
                    readOnly
                    className={inputClassFull + " mt-1 bg-muted/50"}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Type</span>
                  <div className="flex gap-4 mt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editTransactionType"
                        value="debit"
                        checked={editForm.transactionType === "debit"}
                        onChange={() => setEditForm((f) => ({ ...f, transactionType: "debit" }))}
                        className="rounded-full border-input"
                      />
                      <span className="text-sm">Spend</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editTransactionType"
                        value="credit"
                        checked={editForm.transactionType === "credit"}
                        onChange={() => setEditForm((f) => ({ ...f, transactionType: "credit" }))}
                        className="rounded-full border-input"
                      />
                      <span className="text-sm">Credit</span>
                    </label>
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Amount (₹)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    className={inputClassFull + " mt-1"}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Category</span>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className={inputClassFull + " mt-1"}
                    required
                  >
                    <option value="">Select category</option>
                    {(categories || []).map((c) => (
                      <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Payment mode</span>
                  <select
                    value={editForm.paymentMode}
                    onChange={(e) => setEditForm((f) => ({ ...f, paymentMode: e.target.value }))}
                    className={inputClassFull + " mt-1"}
                  >
                    {PAYMENT_OPTIONS_EDIT.map((o) => (
                      <option key={o.value || "__none__"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Note</span>
                  <input
                    type="text"
                    value={editForm.note}
                    onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                    className={inputClassFull + " mt-1"}
                    placeholder="Optional"
                  />
                </label>
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
            <Button
              type="button"
              onClick={() => {
                if (editingTransaction) openDeleteConfirm(editingTransaction);
                closeEdit();
              }}
              color="error"
              disabled={editSaving}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" onClick={closeEdit} color="inherit">
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={editSaving}>
                {editSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!deleteConfirmTransaction} onClose={closeDeleteConfirm}>
        <DialogTitle>Delete transaction?</DialogTitle>
        <DialogContent>
          <p className="text-foreground">
            Are you sure you want to delete this transaction? This cannot be undone.
          </p>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteConfirm} color="inherit" disabled={deleteDeleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleteDeleting}>
            {deleteDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
