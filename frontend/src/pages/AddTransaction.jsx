import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CircularProgress } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { CURRENCY_SYMBOL } from "../config";

const inputClass =
  "w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent";
const labelClass = "text-sm font-medium text-foreground block mb-1";

const PAYMENT_OPTIONS = [
  { value: "", label: "—" },
  { value: "UPI", label: "UPI" },
  { value: "Cash", label: "Cash" },
  { value: "Credit card", label: "Credit card" },
  { value: "Debit card", label: "Debit card" },
  { value: "Netbanking", label: "Netbanking" },
  { value: "Wallet", label: "Wallet" },
  { value: "Other", label: "Other" },
];

export default function AddTransaction() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [transactionType, setTransactionType] = useState("debit"); // debit = spend, credit = income
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const num = parseFloat(amount, 10);
    if (Number.isNaN(num) || !date || !categoryId) {
      setError("Amount (₹), date and category are required.");
      return;
    }
    const selectedType = form.querySelector('input[name="transactionType"]:checked')?.value || "debit";
    setLoading(true);
    try {
      await api(() => token, `/groups/${groupId}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          amount: num,
          transactionType: selectedType === "credit" ? "credit" : "debit",
          date,
          categoryId,
          note: note.trim() || undefined,
          paymentMode: paymentMode.trim() || "",
        }),
      });
      navigate(`/transactions?groupId=${encodeURIComponent(groupId)}`);
    } catch (e) {
      setError(e.message || "Failed to add transaction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground mb-6">Add transaction</h1>
      <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        <label>
          <span className={labelClass}>Group</span>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required className={inputClass}>
            <option value="">Select group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Type</span>
          <div className="flex gap-4 mt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="radio" name="transactionType" value="debit" checked={transactionType === "debit"} onChange={() => setTransactionType("debit")} className="rounded-full border-input" />
              <span className="text-sm text-foreground">Spend</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="radio" name="transactionType" value="credit" checked={transactionType === "credit"} onChange={() => setTransactionType("credit")} className="rounded-full border-input" />
              <span className="text-sm text-foreground">Credit</span>
            </label>
          </div>
        </label>
        <label>
          <span className={labelClass}>Amount ({CURRENCY_SYMBOL})</span>
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} placeholder="0.00" aria-label="Amount in rupees" />
        </label>
        <label>
          <span className={labelClass}>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className={inputClass}>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Payment mode</span>
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={inputClass}>
            {PAYMENT_OPTIONS.map((o) => (
              <option key={o.value || "__none__"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Note (optional)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className={inputClass} />
        </label>
        <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity">
          {loading ? (
            <>
              <CircularProgress size={18} color="inherit" sx={{ color: "inherit" }} />
              Adding…
            </>
          ) : (
            "Add"
          )}
        </button>
      </form>
    </div>
  );
}
