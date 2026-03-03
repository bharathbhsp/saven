import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function SavenIcon() {
  return (
    <span
      className="flex items-center justify-center w-24 h-24 rounded-2xl bg-primary text-primary-foreground text-5xl font-bold shadow-lg"
      aria-hidden
    >
      S
    </span>
  );
}

export default function Login() {
  const { isAuthenticated, loading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/", { replace: true });
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-muted/30">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30 gap-8">
      <SavenIcon />
      <div className="w-full max-w-sm bg-card rounded-xl border border-border shadow-lg p-10 text-center">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Saven</h1>
        <p className="text-muted-foreground text-sm mb-8">Spend less, together.</p>
        <button
          type="button"
          onClick={login}
          className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          Sign in
        </button>
        <p className="mt-6 text-muted-foreground text-xs">Invite only.</p>
      </div>
    </div>
  );
}
