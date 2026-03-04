import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";

export default function Settings() {
  const { token } = useAuth();
  const [code, setCode] = useState(null);
  const [expiresIn, setExpiresIn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>

      <section className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium text-foreground mb-2">Connect Telegram</h2>
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
    </div>
  );
}
