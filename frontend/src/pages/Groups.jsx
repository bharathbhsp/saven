import { useState, useEffect } from "react";
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
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any groups yet. Create one on the Dashboard, then come back here to manage members.
        </p>
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
          </div>

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
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-4 font-medium text-muted-foreground">User ID</th>
                        <th className="py-2 pr-4 font-medium text-muted-foreground">Role</th>
                        <th className="py-2 pr-4 font-medium text-muted-foreground">Joined at</th>
                        <th className="py-2 font-medium text-muted-foreground" />
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.userId} className="border-b border-border last:border-b-0">
                          <td className="py-2 pr-4 font-mono text-xs break-all">{m.userId}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{m.role || "member"}</td>
                          <td className="py-2 pr-4 text-muted-foreground text-xs">
                            {m.joinedAt ? new Date(m.joinedAt).toLocaleString() : "—"}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.userId)}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

