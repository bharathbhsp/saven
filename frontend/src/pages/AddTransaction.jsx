import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

const inputClass =
  "w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent";
const labelClass = "text-sm font-medium text-foreground block mb-1";

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
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState(null);

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

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim() || !groupId) return;
    setAddingCategory(true);
    setCategoryError(null);
    try {
      const data = await api(() => token, `/groups/${groupId}/categories`, {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setCategories((prev) => [...prev, data.category]);
      setCategoryId(data.category.categoryId);
      setNewCategoryName("");
    } catch (e) {
      setCategoryError(e.message || "Failed to add category");
    } finally {
      setAddingCategory(false);
    }
  }

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
          <span className={labelClass}>Amount</span>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputClass} />
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Or add new:</span>
            <form onSubmit={handleAddCategory} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="flex-1 min-w-[8rem] px-2 py-1.5 text-sm border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={addingCategory || !newCategoryName.trim()}
                className="py-1.5 px-3 rounded-md border border-input bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-60 transition-opacity"
              >
                {addingCategory ? "Adding…" : "Add"}
              </button>
            </form>
            {categoryError && (
              <span className="text-sm text-destructive">{categoryError}</span>
            )}
          </div>
        </label>
        <label>
          <span className={labelClass}>Note (optional)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className={inputClass} />
        </label>
        <button type="submit" disabled={loading} className="py-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity">
          {loading ? "Adding…" : "Add"}
        </button>
      </form>
    </div>
  );
}
