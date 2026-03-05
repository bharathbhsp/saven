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

const inputClass =
  "px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function Categories() {
  const { token } = useAuth();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [categories, setCategories] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [error, setError] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api(() => token, "/groups");
        if (cancelled) return;
        const list = data.groups || [];
        setGroups(list);
        if (list.length > 0 && !groupId) setGroupId(list[0].id);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load groups");
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!groupId) {
      setCategories([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingCategories(true);
        const data = await api(() => token, `/groups/${groupId}/categories`);
        if (!cancelled) setCategories(data.categories || []);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load categories");
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, groupId]);

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategoryName.trim() || !groupId) return;
    setAddingCategory(true);
    setAddCategoryError(null);
    try {
      const data = await api(() => token, `/groups/${groupId}/categories`, {
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

  const selectedGroup = groups.find((g) => g.id === groupId) || null;

  function scopeForCategory(cat) {
    if (cat.groupId === "GLOBAL") return "Global";
    if (cat.groupId === groupId) return "Group";
    return cat.groupId || "";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Categories</h1>
      <p className="text-sm text-muted-foreground">
        View the categories you can use when adding transactions. Global categories are shared; group categories are specific
        to the selected group.
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loadingGroups ? (
        <p className="text-sm text-muted-foreground">Loading groups…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any groups yet. Create one on the Dashboard, then you can see its categories here.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-foreground" htmlFor="group-select">
              Select group
            </label>
            <select
              id="group-select"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={inputClass}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {selectedGroup && (
            <section className="mt-6 bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-medium text-foreground">Categories for {selectedGroup.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Includes global categories shared across all groups and any categories created for this group.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 pt-2">
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

              {loadingCategories ? (
                <p className="text-sm text-muted-foreground">Loading categories…</p>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories yet.</p>
              ) : (
                <TableContainer component={Paper} className="-mx-4 sm:mx-0" sx={{ maxWidth: "100%" }}>
                  <Table size="small" stickyHeader aria-label="Categories">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Scope</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categories.map((cat) => (
                        <TableRow key={`${cat.groupId}-${cat.categoryId}`} hover>
                          <TableCell>{cat.name}</TableCell>
                          <TableCell>{scopeForCategory(cat)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

