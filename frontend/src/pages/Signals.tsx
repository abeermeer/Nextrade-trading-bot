import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Signals() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: signals } = useQuery({ queryKey: ["signals"], queryFn: () => api.signals(100) });

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
            <button onClick={() => navigate("/trades")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Trades</button>
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="font-heading text-2xl font-bold mb-6">Signal History</h1>

        <div className="bg-dark-700/50 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-6 py-4 font-medium">Time</th>
                <th className="text-left px-6 py-4 font-medium">Symbol</th>
                <th className="text-left px-6 py-4 font-medium">Action</th>
                <th className="text-left px-6 py-4 font-medium">Confidence</th>
                <th className="text-left px-6 py-4 font-medium">Price</th>
                <th className="text-left px-6 py-4 font-medium">Timeframe</th>
                <th className="text-left px-6 py-4 font-medium">Strategies</th>
              </tr>
            </thead>
            <tbody>
              {signals?.map((s, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="px-6 py-4 text-gray-400 text-xs">{new Date(s.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 font-medium">{s.symbol}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                      s.action === "buy" ? "bg-green-500/20 text-green-400" :
                      s.action === "sell" ? "bg-red-500/20 text-red-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>{s.action}</span>
                  </td>
                  <td className="px-6 py-4">{(s.confidence * 100).toFixed(0)}%</td>
                  <td className="px-6 py-4">${s.price.toFixed(4)}</td>
                  <td className="px-6 py-4 text-gray-400">{s.timeframe}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {s.strategy_results?.map((r, j) => (
                        <span key={j} className={`text-xs px-2 py-0.5 rounded ${
                          r.action === "buy" ? "bg-green-500/10 text-green-400" :
                          r.action === "sell" ? "bg-red-500/10 text-red-400" :
                          "bg-gray-500/10 text-gray-400"
                        }`}>{r.strategy_name}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {(!signals || signals.length === 0) && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No signals yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
