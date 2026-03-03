import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-sm bg-card rounded-lg border border-border shadow-sm p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Saven</h1>
        <p className="text-muted-foreground text-sm mb-6">Track spending by group and period.</p>
        <button
          type="button"
          onClick={login}
          className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Sign in
        </button>
        <p className="mt-5 text-muted-foreground text-xs">Uses Cognito (email or Google).</p>
      </div>
    </div>
  );
}
