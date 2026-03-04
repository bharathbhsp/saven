import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REGION = import.meta.env.VITE_AWS_REGION || "ap-south-2";

function parseHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    id_token: params.get("id_token"),
    access_token: params.get("access_token"),
    expires_in: params.get("expires_in"),
  };
}

function getStoredToken() {
  try {
    const t = sessionStorage.getItem("saven_id_token");
    if (t) return t;
  } catch (_) {}
  return null;
}

function setStoredToken(token) {
  try {
    if (token) sessionStorage.setItem("saven_id_token", token);
    else sessionStorage.removeItem("saven_id_token");
  } catch (_) {}
}

function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (_) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const { id_token } = parseHash(hash);
      if (id_token) {
        setStoredToken(id_token);
        setToken(id_token);
        setUser(decodeJwt(id_token));
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    if (!hash && token) {
      setUser(decodeJwt(token));
    }
    setLoading(false);
  }, [token]);

  // Use app root as redirect so it matches Cognito callback URLs (e.g. http://localhost:5173/)
  const redirectUri = encodeURIComponent(window.location.origin + "/");
  const login = useCallback(() => {
    const url = `https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/login?client_id=${CLIENT_ID}&response_type=token&scope=openid+email+profile&redirect_uri=${redirectUri}`;
    window.location.href = url;
  }, [redirectUri]);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    const url = `https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/logout?client_id=${CLIENT_ID}&logout_uri=${redirectUri}`;
    window.location.href = url;
  }, [redirectUri]);

  const value = { token, user, loading, login, logout, isAuthenticated: !!token };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
