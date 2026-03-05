import { useState, useEffect } from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

const inputClass =
  "px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function Groups() {
  const { token } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [members, setMembers] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState(null);

  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const data = await api(() => token, "/groups");
        if (cancelled) return;
        const list = data.groups || [];
        setGroups(list);
        if (list.length > 0 && !selectedGroupId) {
          setSelectedGroupId(list[0].id);
        }
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
    if (!selectedGroupId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingMembers(true);
        const data = await api(() => token, `/groups/${selectedGroupId}/members`);
        if (!cancelled) setMembers(data.members || []);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load members");
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedGroupId]);

  async function handleAddMember(e) {
    e.preventDefault();
    if (!selectedGroupId || !newMemberEmail.trim()) return;
    setAddingMember(true);
    setError(null);
    try {
      const data = await api(() => token, `/groups/${selectedGroupId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: newMemberEmail.trim() }),
      });
      const member = data.member;
      setMembers((prev) => [...prev, member]);
      setNewMemberEmail("");
    } catch (e) {
      setError(e.message || "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  }

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
      setSelectedGroupId(data.group.id);
      setCreateName("");
      setShowCreateGroup(false);
    } catch (e) {
      setError(e.message || "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  async function handleRemoveMember(userId) {
    if (!selectedGroupId) return;
    setError(null);
    try {
      await api(() => token, `/groups/${selectedGroupId}/members/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e) {
      setError(e.message || "Failed to remove member");
    }
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Groups</h1>
      <p className="text-sm text-muted-foreground">
        Groups are the buckets where spend is recorded. Add members here so they can add transactions (including from the
        linked Telegram group).
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loadingGroups ? (
        <p className="text-sm text-muted-foreground">Loading groups…</p>
      ) : groups.length === 0 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">Create a group to start tracking spending.</p>
          <form onSubmit={handleCreateGroup} className="max-w-xs space-y-4">
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
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-foreground" htmlFor="group-select">
              Select group
            </label>
            <select
              id="group-select"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className={inputClass}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateGroup((v) => !v)}
              className="py-2 px-3 rounded-md border border-input bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
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
            </div>
          )}

          {selectedGroup && (
            <section className="mt-6 bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-medium text-foreground">{selectedGroup.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    Group ID: <code className="text-xs">{selectedGroup.id}</code>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Members</h3>
                {loadingMembers ? (
                  <p className="text-sm text-muted-foreground">Loading members…</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet. Add the first member below.</p>
                ) : (
                  <TableContainer component={Paper} className="-mx-4 sm:mx-0" sx={{ maxWidth: "100%" }}>
                    <Table size="small" stickyHeader aria-label="Group members">
                      <TableHead>
                        <TableRow>
                          <TableCell>User ID</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>Joined at</TableCell>
                          <TableCell align="right" />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {members.map((m) => (
                          <TableRow key={m.userId} hover>
                            <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>{m.userId}</TableCell>
                            <TableCell>{m.role || "member"}</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                              {m.joinedAt ? new Date(m.joinedAt).toLocaleString() : "—"}
                            </TableCell>
                            <TableCell align="right">
                              <Button size="small" color="error" onClick={() => handleRemoveMember(m.userId)}>
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </div>

              <form onSubmit={handleAddMember} className="space-y-2 pt-4 border-t border-border mt-2">
                <label className="text-sm font-medium text-foreground block" htmlFor="add-member-email">
                  Add member
                  <span className="block text-xs text-muted-foreground mt-1">
                    Enter the user&apos;s email address. They must already have a Saven account (same Cognito user pool).
                  </span>
                </label>
                <div className="flex flex-wrap gap-3 items-center">
                  <input
                    id="add-member-email"
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="member@example.com"
                    className={`${inputClass} flex-1 min-w-[220px]`}
                  />
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {addingMember ? "Adding…" : "Add member"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
}

