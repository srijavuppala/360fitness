import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Utensils,
  BookOpen,
  ChartNoAxesCombined,
  Settings,
  Search,
  ArrowUpRight,
  Menu,
  X,
  WifiOff,
  Plus,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Logo, Notice } from "./ui";
import { useStore } from "../lib/store";
const navigation = [
  ["/app", "Overview", LayoutDashboard],
  ["/app/diary", "Food diary", Utensils],
  ["/app/plan", "Meal plan", BookOpen],
  ["/app/library", "Food library", Search],
  ["/app/progress", "Progress", ChartNoAxesCombined],
  ["/app/settings", "Settings", Settings],
] as const;
export function Layout() {
  const { state, user, ready, error, notice, signOut, busy } = useStore();
  const [open, setOpen] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const location = useLocation();
  useEffect(() => {
    const on = () => setOffline(false),
      off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    document.title = `${navigation.find(([path]) => path === location.pathname)?.[1] ?? "Workspace"} · 360° Fitness`;
  }, [location.pathname]);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <button
        className={`mobile-menu icon-button ${open ? "menu-open" : ""}`}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="workspace-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        className={`sidebar ${open ? "open" : ""}`}
      >
        <Logo />
        <div className="workspace-label">YOUR DAILY SPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/app"}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="sunburst">✳</span>
          <h3>A little, every day.</h3>
          <p>Make your usual meals the easiest part of your routine.</p>
          <Link to="/app/plan" onClick={() => setOpen(false)}>
            Build your plan
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="sidebar-bottom">
          <Link
            to="/app/settings"
            className="account"
            onClick={() => setOpen(false)}
          >
            <span className="avatar">
              {(state.profile.name || user?.displayName || "You")
                .slice(0, 1)
                .toUpperCase()}
            </span>
            <span>
              <strong>
                {state.profile.name || user?.displayName || "Your workspace"}
              </strong>
              <small>
                {user ? "Connected account" : "Saved on this browser"}
              </small>
            </span>
            <Settings size={16} />
          </Link>
          {user && (
            <button className="text-button" disabled={busy} onClick={signOut}>
              <LogOut size={14} />
              Sign out
            </button>
          )}
          <Link
            className="privacy-link"
            to="/privacy"
            onClick={() => setOpen(false)}
          >
            <ShieldCheck size={13} /> Privacy & data
          </Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div>
            <span className="live-dot" />
            {user ? "Your connected workspace" : "Your local workspace"}
          </div>
          <div className="topbar-actions">
            <span>
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <Link className="button small" to="/app/diary?add=1">
              <Plus size={16} />
              Log meal
            </Link>
          </div>
        </header>
        {offline && (
          <div className="offline-banner">
            <WifiOff size={16} />
            {user
              ? "You’re offline. Reconnect to save account changes."
              : "You’re offline. Your local meal log still works."}
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {error ? (
            <Notice error>
              {error}
              <p>
                <button
                  className="button secondary"
                  onClick={() => locationReload()}
                >
                  Reload safely
                </button>
              </p>
            </Notice>
          ) : !ready ? (
            <div className="loading" role="status">
              Opening your workspace…
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="app-footer">
          <span>360° Fitness · Small steps. Real life.</span>
          <Link to="/privacy">Privacy</Link>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
function locationReload() {
  window.location.reload();
}
