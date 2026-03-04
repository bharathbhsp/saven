import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

export default function Settings() {
  const { token } = useAuth();
  const [code, setCode] = useState(null);
  const [expiresIn, setExpiresIn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [groups, setGroups] = useState([]);
  const [linkStatus, setLinkStatus] = useState(null);
  const [defaultGroupId, setDefaultGroupId] = useState("");
  const [defaultGroupLoading, setDefaultGroupLoading] = useState(false);

  const [chatLinkGroupId, setChatLinkGroupId] = useState("");
  const [chatLinkCode, setChatLinkCode] = useState(null);
  const [chatLinkExpiresIn, setChatLinkExpiresIn] = useState(null);
  const [chatLinkLoading, setChatLinkLoading] = useState(false);
  const [chatLinkError, setChatLinkError] = useState(null);

  const [chatLinks, setChatLinks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [groupsRes, linkRes, chatLinksRes] = await Promise.all([
          api(() => token, "/groups"),
          api(() => token, "/telegram/link").catch(() => ({ linked: false })),
          api(() => token, "/telegram/chat-links").catch(() => ({ links: [] })),
        ]);
        if (cancelled) return;
        setGroups(groupsRes.groups || []);
        setLinkStatus(linkRes);
        setChatLinks(chatLinksRes.links || []);
        if (linkRes.linked && linkRes.defaultGroupId) setDefaultGroupId(linkRes.defaultGroupId);
      } catch (_) {}
    }
    if (token) load();
    return () => { cancelled = true; };
  }, [token]);

  async function generateCode() {
    setError(null);
    setCode(null);
    setLoading(true);
    try {
      const data = await api(() => token, "/telegram/link-code", { method: "POST" });
      setCode(data.code);
      setExpiresIn(data.expiresIn ?? 600);
    } catch (e) {
      setError(e.message || "Failed to generate code");
    } finally {
      setLoading(false);
    }
  }

  async function saveDefaultGroup() {
    if (!linkStatus?.linked) return;
    setDefaultGroupLoading(true);
    setError(null);
    try {
      await api(() => token, "/telegram/link", {
        method: "PATCH",
        body: JSON.stringify({ defaultGroupId: defaultGroupId || null }),
      });
      setLinkStatus((s) => (s ? { ...s, defaultGroupId: defaultGroupId || null } : s));
    } catch (e) {
      setError(e.message || "Failed to save default group");
    } finally {
      setDefaultGroupLoading(false);
    }
  }

  async function generateChatLinkCode() {
    setChatLinkError(null);
    setChatLinkCode(null);
    if (!chatLinkGroupId) {
      setChatLinkError("Select a group first");
      return;
    }
    setChatLinkLoading(true);
    try {
      const data = await api(() => token, "/telegram/chat-link-code", {
        method: "POST",
        body: JSON.stringify({ groupId: chatLinkGroupId }),
      });
      setChatLinkCode(data.code);
      setChatLinkExpiresIn(data.expiresIn ?? 600);
    } catch (e) {
      setChatLinkError(e.message || "Failed to generate code");
    } finally {
      setChatLinkLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>

      <section className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium text-foreground mb-2">Connect Telegram</h2>
        {linkStatus?.linked && (
          <p className="text-sm text-green-600 dark:text-green-400 mb-4 font-medium">
            ✓ Telegram linked — you can use the bot in private chat and in linked groups.
          </p>
        )}
        <p className="text-sm text-muted-foreground mb-4">
          Link your Telegram account to record spend and view summaries from the Saven bot.
        </p>
        {error && (
          <p className="text-sm text-destructive mb-4" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={generateCode}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Generating…" : "Generate link code"}
        </button>
        {code && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-2">
              Send this code to the Saven bot within {Math.floor(expiresIn / 60)} minutes:
            </p>
            <p className="text-2xl font-mono font-semibold tracking-widest text-foreground mb-4">
              {code}
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Open Telegram and find the Saven bot (or ask your admin for the bot link).</li>
              <li>Send: <code className="bg-muted px-1 rounded">/link {code}</code></li>
              <li>After linking, you can use /add, /today, /month and free text to log spend.</li>
            </ol>
          </div>
        )}
      </section>

      {linkStatus?.linked && groups.length > 0 && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium text-foreground mb-2">Default group for Telegram (Option B)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            When you don’t specify a group in a message, the bot will record to this group.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={defaultGroupId}
              onChange={(e) => setDefaultGroupId(e.target.value)}
              onBlur={saveDefaultGroup}
              className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
            >
              <option value="">First group (no default)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={saveDefaultGroup}
              disabled={defaultGroupLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {defaultGroupLoading ? "Saving…" : "Save"}
            </button>
          </div>
        </section>
      )}

      <section className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium text-foreground mb-2">Link Telegram group (Option C)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Link a Telegram group so that all spend messages in that group are recorded to one Saven group. Add the bot to the Telegram group first.
        </p>
        {chatLinkError && (
          <p className="text-sm text-destructive mb-4" role="alert">
            {chatLinkError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={chatLinkGroupId}
            onChange={(e) => setChatLinkGroupId(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground"
          >
            <option value="">Select Saven group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={generateChatLinkCode}
            disabled={chatLinkLoading || !chatLinkGroupId}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {chatLinkLoading ? "Generating…" : "Generate chat link code"}
          </button>
        </div>
        {chatLinkCode && (
          <div className="p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-2">
              In the Telegram group, send within {Math.floor(chatLinkExpiresIn / 60)} minutes:
            </p>
            <p className="text-2xl font-mono font-semibold tracking-widest text-foreground mb-4">
              /linkgroup {chatLinkCode}
            </p>
            <p className="text-sm text-muted-foreground">
              Only members of this Saven group can run /linkgroup. After linking, messages in that Telegram group will record to this Saven group.
            </p>
          </div>
        )}

        {chatLinks.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-foreground mb-2">Linked Telegram groups</h3>
            <p className="text-sm text-muted-foreground mb-3">
              These Saven groups are linked to a Telegram group; spend added in that Telegram group goes here.
            </p>
            <ul className="space-y-2">
              {chatLinks.map((link) => (
                <li key={`${link.groupId}-${link.telegramChatId}`} className="text-sm flex items-center gap-2">
                  <span className="text-green-600 dark:text-green-400">✓</span>
                  <strong className="text-foreground">{link.groupName}</strong>
                  <span className="text-muted-foreground">— Telegram group linked</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
