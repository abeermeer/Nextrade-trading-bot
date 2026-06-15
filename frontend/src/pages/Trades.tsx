import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Trades() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: trades } = useQuery({ queryKey: ["trades"], queryFn: api.trades });

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
            <button onClick={() => navigate("/positions")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Positions</button>
            <button onClick={() => navigate("/signals")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Signals</button>
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="font-heading text-2xl font-bold mb-6">Trade History</h1>

        <div className="bg-dark-700/50 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-4 font-medium">Time</th>
                <th className="text-left px-6 py-4 font-medium">Symbol</th>
                <th className="text-left px-6 py-4 font-medium">Side</th>
                <th className="text-left px-6 py-4 font-medium">Price</th>
                <th className="text-left px-6 py-4 font-medium">Qty</th>
                <th className="text-left px-6 py-4 font-medium">Total</th>
                <th className="text-left px-6 py-4 font-medium">Fee</th>
              </tr>
            </thead>
            <tbody>
              {trades?.map((t, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="px-6 py-4 text-gray-400 text-xs">{new Date(t.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 font-medium">{t.symbol}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                      t.side === "buy" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}>{t.side}</span>
                  </td>
                  <td className="px-6 py-4">${t.price.toFixed(4)}</td>
                  <td className="px-6 py-4">{t.quantity}</td>
                  <td className="px-6 py-4">${t.total.toFixed(2)}</td>
                  <td className="px-6 py-4 text-gray-400">${t.fee.toFixed(4)}</td>
                </tr>
              ))}
              {(!trades || trades.length === 0) && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No trades executed yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
