import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) =>
    isActive
      ? "text-foreground font-medium border-b-2 border-primary"
      : "text-muted-foreground hover:text-foreground transition-colors";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-6 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                S
              </span>
              <span className="tracking-tight">Saven</span>
            </button>
            <nav className="flex gap-4 sm:gap-6 text-xs sm:text-sm">
              <NavLink to="/" end className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/transactions" className={linkClass}>
                Transactions
              </NavLink>
              <NavLink to="/groups" className={linkClass}>
                Groups
              </NavLink>
              <NavLink to="/categories" className={linkClass}>
                Categories
              </NavLink>
              <NavLink to="/profile" className={linkClass}>
                Profile
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs max-w-[220px]">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/90 text-primary-foreground text-[10px] font-semibold">
                  {(user.email || user.username || user.sub || "?")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate">
                    {user.email || user.username || user.sub}
                  </span>
                  {user.sub && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {String(user.sub)}
                    </span>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground py-1 px-2 rounded-md transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
