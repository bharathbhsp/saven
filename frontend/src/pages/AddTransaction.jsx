import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

export default function AddTransaction() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");
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
    if (!groupId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api(() => token, `/groups/${groupId}/categories`);
        if (!cancelled) {
          setCategories(data.categories || []);
          setCategoryId("");
        }
      } catch (_) {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => { cancelled = true; };
  }, [token, groupId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const num = parseFloat(amount, 10);
    if (Number.isNaN(num) || !date || !categoryId) {
      setError("Amount, date and category are required.");
      return;
    }
    setLoading(true);
    try {
      await api(() => token, `/groups/${groupId}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          amount: num,
          date,
          categoryId,
          note: note.trim() || undefined,
        }),
      });
      navigate("/");
    } catch (e) {
      setError(e.message || "Failed to add transaction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Add transaction</h1>
      <form onSubmit={handleSubmit} className="form">
        {error && <div className="error">{error}</div>}
        <label>
          Group
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
            <option value="">Select group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">Select category</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Adding…" : "Add"}
        </button>
      </form>
    </div>
  );
}
