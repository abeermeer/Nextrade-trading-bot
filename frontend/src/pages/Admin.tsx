import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: users, isLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: api.adminUsers,
  });

  return (
    <div className="min-h-screen bg-dark-900">
      <nav className="border-b border-white/5 bg-dark-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-dark-900 font-heading font-bold text-sm">N</span>
            </div>
            <span className="font-heading font-bold text-lg tracking-wider hidden sm:block">NexTrade AI</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Dashboard</button>
            <button onClick={() => navigate("/settings")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Settings</button>
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold">Admin Panel</h1>
          <p className="text-gray-400 text-sm">Manage all users and their bot instances</p>
        </div>

        <div className="bg-dark-700/50 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-4 font-medium">ID</th>
                <th className="text-left px-6 py-4 font-medium">Email</th>
                <th className="text-left px-6 py-4 font-medium">Plan</th>
                <th className="text-left px-6 py-4 font-medium">Mode</th>
                <th className="text-left px-6 py-4 font-medium">Type</th>
                <th className="text-left px-6 py-4 font-medium">Bot</th>
                <th className="text-left px-6 py-4 font-medium">MEXC</th>
                <th className="text-left px-6 py-4 font-medium">Max Pos</th>
                <th className="text-left px-6 py-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : users?.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">No users registered</td></tr>
              ) : (
                users?.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-6 py-4 text-gray-400">{u.id}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium">{u.email}</span>
                      {u.is_admin && <span className="ml-2 text-xs text-yellow-400">(admin)</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`capitalize ${
                        u.plan === "enterprise" ? "text-purple-400" :
                        u.plan === "pro" ? "text-accent" : "text-gray-400"
                      }`}>{u.plan}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={u.mode === "live" ? "text-green-400" : "text-yellow-400"}>{u.mode}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{u.trade_type}</td>
                    <td className="px-6 py-4">
                      <span className={u.bot_active ? "text-green-400" : "text-gray-500"}>{u.bot_active ? "🟢 On" : "🔴 Off"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={u.has_mexc_keys ? "text-accent" : "text-gray-500"}>{u.has_mexc_keys ? "✓" : "—"}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">${u.max_position_usdt?.toFixed(0)}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
