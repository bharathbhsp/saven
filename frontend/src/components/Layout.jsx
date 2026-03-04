import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) =>
    isActive
      ? "text-foreground font-medium border-b-2 border-primary"
      : "text-muted-foreground hover:text-foreground transition-colors";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <nav className="flex gap-6 text-sm">
            <NavLink to="/" end className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/add" className={linkClass}>
              Add transaction
            </NavLink>
            <NavLink to="/transactions" className={linkClass}>
              Transactions
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              Settings
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="text-sm text-muted-foreground hover:text-foreground py-1 px-2 rounded-md transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
