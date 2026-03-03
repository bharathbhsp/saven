import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { isAuthenticated, loading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/", { replace: true });
  }, [loading, isAuthenticated, navigate]);

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Saven</h1>
        <p>Track spending by group and period.</p>
        <button type="button" className="btn-primary" onClick={login}>
          Sign in
        </button>
        <p className="login-hint">Uses Cognito Hosted UI (email or Google).</p>
      </div>
    </div>
  );
}
