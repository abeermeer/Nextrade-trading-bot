import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ChartIcon, SettingsIcon, PositionIcon, SignalIcon, TradeIcon, AdminIcon, LogoutIcon, MenuIcon, CloseIcon } from "./Icons";
import { useState } from "react";

export function AppNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = user ? [
    { label: "Dashboard", path: "/dashboard", icon: ChartIcon },
    { label: "Positions", path: "/positions", icon: PositionIcon },
    { label: "Signals", path: "/signals", icon: SignalIcon },
    { label: "Trades", path: "/trades", icon: TradeIcon },
    { label: "Settings", path: "/settings", icon: SettingsIcon },
    ...(user?.is_admin ? [{ label: "Admin", path: "/admin", icon: AdminIcon }] : []),
  ] : [];

  return (
    <nav className="border-b border-white/5 bg-dark-900/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-blue-accent flex items-center justify-center shadow-lg shadow-accent/20">
            <span className="text-dark-900 font-heading font-bold text-sm">N</span>
          </div>
          <span className="font-heading font-bold text-base tracking-wider hidden sm:block">NexTrade AI</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <button key={l.path} onClick={() => navigate(l.path)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
              <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">
                <LogoutIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              {/* Mobile menu toggle */}
              <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-gray-400 p-1">
                {mobileOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
              <Link to="/signup" className="text-sm bg-accent hover:bg-accent-dark text-dark-900 px-5 py-2 rounded-lg font-bold transition-all shadow-lg shadow-accent/20">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && user && (
        <div className="md:hidden border-t border-white/5 bg-dark-800/95 backdrop-blur-xl">
          <div className="px-6 py-4 space-y-1">
            {navLinks.map((l) => (
              <button key={l.path} onClick={() => { navigate(l.path); setMobileOpen(false); }}
                className="flex items-center gap-3 w-full text-sm text-gray-400 hover:text-white px-3 py-3 rounded-lg transition-colors"
              >
                <l.icon className="w-5 h-5" />
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
