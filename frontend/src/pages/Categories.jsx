import { useState, useEffect } from "react";
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
import LoadingSpinner from "../components/LoadingSpinner";

const inputClass =
  "px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function Categories() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api(() => token, "/me/categories");
        if (!cancelled) setCategories(data.categories || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load categories");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    setAddCategoryError(null);
    try {
      const data = await api(() => token, "/me/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setCategories((prev) => [...prev, data.category]);
      setNewCategoryName("");
    } catch (e) {
      setAddCategoryError(e.message || "Failed to add category");
    } finally {
      setAddingCategory(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">My categories</h1>
      <p className="text-sm text-muted-foreground">
        Categories are per user. Use them when adding transactions in any group.
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <section className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <form onSubmit={handleAddCategory} className="flex flex-wrap items-center gap-2">
            <label htmlFor="new-category-name" className="sr-only">
              New category name
            </label>
            <input
              id="new-category-name"
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="flex-1 min-w-[10rem] px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={addingCategory || !newCategoryName.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {addingCategory ? "Adding…" : "Add category"}
            </button>
          </form>
          {addCategoryError && (
            <span className="text-sm text-destructive" role="alert">
              {addCategoryError}
            </span>
          )}
        </div>

        {loading ? (
          <LoadingSpinner label="Loading categories…" inline />
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
        ) : (
          <TableContainer component={Paper} className="-mx-4 sm:mx-0" sx={{ maxWidth: "100%" }}>
            <Table size="small" stickyHeader aria-label="Categories">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.categoryId} hover>
                    <TableCell>{cat.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </section>
    </div>
  );
}

