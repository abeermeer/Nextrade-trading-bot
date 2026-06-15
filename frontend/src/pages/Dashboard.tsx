import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { BotMode, TradeType } from "../types";

export default function Dashboard() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfetti, setShowConfetti] = useState(false);

  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status });
  const { data: positions } = useQuery({ queryKey: ["positions"], queryFn: api.positions });
  const { data: signals } = useQuery({ queryKey: ["signals"], queryFn: () => api.signals(5) });
  const { data: performance } = useQuery({ queryKey: ["performance"], queryFn: api.performance });
  const { data: botStatus } = useQuery({ queryKey: ["botStatus"], queryFn: api.botStatus });

  const startBot = useMutation({
    mutationFn: () => api.controlBot("start"),
    onSuccess: (data) => { updateUser({ bot_active: data.bot_active }); queryClient.invalidateQueries({ queryKey: ["botStatus"] }); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); },
  });

  const stopBot = useMutation({
    mutationFn: () => api.controlBot("stop"),
    onSuccess: (data) => { updateUser({ bot_active: data.bot_active }); queryClient.invalidateQueries({ queryKey: ["botStatus"] }); },
  });

  const switchMode = useMutation({
    mutationFn: (mode: BotMode) => api.updateSettings({ mode, trade_type: user?.trade_type || "spot", max_position_usdt: user?.max_position_usdt || 500 }),
    onSuccess: (data) => updateUser({ mode: data.mode as BotMode }),
  });

  const switchTradeType = useMutation({
    mutationFn: (trade_type: TradeType) => api.updateSettings({ mode: user?.mode || "paper", trade_type, max_position_usdt: user?.max_position_usdt || 500 }),
    onSuccess: (data) => updateUser({ trade_type: data.trade_type as TradeType }),
  });

  const totalPnl = performance?.total_pnl ?? 0;
  const analystAlive = status?.analyst_alive ?? false;
  const traderAlive = status?.trader_alive ?? false;
  const botActive = botStatus?.bot_active ?? user?.bot_active ?? false;
  const hasKeys = botStatus?.has_mexc_keys ?? user?.has_mexc_keys ?? false;

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Top Nav */}
      <nav className="border-b border-white/5 bg-dark-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-dark-900 font-heading font-bold text-sm">N</span>
            </div>
            <span className="font-heading font-bold text-lg tracking-wider hidden sm:block">NexTrade AI</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/settings")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Settings</button>
            <button onClick={() => navigate("/positions")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Positions</button>
            <button onClick={() => navigate("/signals")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Signals</button>
            <button onClick={() => navigate("/trades")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Trades</button>
            {user?.is_admin && (
              <button onClick={() => navigate("/admin")} className="text-sm text-yellow-400 hover:text-yellow-300 px-3 py-1.5 rounded-lg transition-colors">Admin</button>
            )}
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold">Trading Dashboard</h1>
            <p className="text-gray-400 text-sm">Real-time bot status and performance</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Spot/Futures toggle */}
            <div className="flex bg-dark-700 rounded-xl p-1 border border-white/5">
              {(["spot", "futures"] as const).map((t) => (
                <button key={t} onClick={() => switchTradeType.mutate(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                    (user?.trade_type || "spot") === t
                      ? "bg-blue-accent text-white shadow-lg"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Paper/Live toggle */}
            <div className="flex bg-dark-700 rounded-xl p-1 border border-white/5">
              {(["paper", "live"] as const).map((m) => (
                <button key={m} onClick={() => switchMode.mutate(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                    (user?.mode || "paper") === m
                      ? m === "live" ? "bg-green-500 text-white shadow-lg" : "bg-yellow-500 text-dark-900 shadow-lg"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bot Communication Visualization */}
        <div className="bg-dark-700/50 border border-white/5 rounded-2xl p-8">
          <div className="flex items-center justify-center gap-8 md:gap-16">
            {/* Analyst */}
            <div className="text-center">
              <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-3 transition-all ${
                analystAlive ? "bg-accent/20 border-2 border-accent shadow-lg shadow-accent/10" : "bg-dark-600 border border-white/10 opacity-50"
              }`}>
                🧠
              </div>
              <div className="font-heading font-bold text-sm">Analyst</div>
              <div className={`text-xs mt-1 ${analystAlive ? "text-accent" : "text-gray-500"}`}>
                {analystAlive ? "🟢 Active" : "🔴 Offline"}
              </div>
            </div>

            {/* Arrows */}
            <div className="flex-1 max-w-48 relative">
              <div className="h-0.5 bg-gradient-to-r from-accent via-blue-accent to-green-500 mt-10" />
              <div className={`absolute -top-1 left-1/2 -translate-x-1/2 text-2xl transition-all ${
                botActive ? "opacity-100 animate-pulse" : "opacity-30"
              }`}>
                ⚡
              </div>
              <div className="text-center text-xs text-gray-500 mt-2">
                {botActive ? "Trading Live" : "Idle"}
              </div>
            </div>

            {/* Trader */}
            <div className="text-center">
              <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-3 transition-all ${
                traderAlive ? "bg-green-500/20 border-2 border-green-500 shadow-lg shadow-green-500/10" : "bg-dark-600 border border-white/10 opacity-50"
              }`}>
                🤖
              </div>
              <div className="font-heading font-bold text-sm">Trader</div>
              <div className={`text-xs mt-1 ${traderAlive ? "text-green-400" : "text-gray-500"}`}>
                {traderAlive ? "🟢 Active" : "🔴 Offline"}
              </div>
            </div>
          </div>

          {/* Start/Stop Button */}
          <div className="text-center mt-8">
            {!hasKeys && (
              <p className="text-yellow-400 text-sm mb-3">⚠️ Set your MEXC API keys in Settings first</p>
            )}
            <button
              onClick={() => botActive ? stopBot.mutate() : startBot.mutate()}
              disabled={!hasKeys || startBot.isPending || stopBot.isPending}
              className={`px-10 py-3.5 rounded-xl font-bold text-lg transition-all ${
                botActive
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                  : "bg-accent hover:bg-accent-dark text-dark-900 shadow-lg shadow-accent/20"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {startBot.isPending || stopBot.isPending ? "..." : botActive ? "⏹ Stop Bot" : "▶ Start Bot"}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total P&L" value={`$${totalPnl.toFixed(2)}`} color={totalPnl >= 0 ? "text-accent" : "text-red-400"} />
          <StatCard label="Win Rate" value={performance ? `${performance.win_rate}%` : "—"} />
          <StatCard label="Total Trades" value={performance?.total_trades ?? 0} />
          <StatCard label="Open Positions" value={positions?.length ?? 0} />
        </div>

        {/* Signals Preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold">Latest Signals</h2>
            <button onClick={() => navigate("/signals")} className="text-sm text-accent hover:underline">View All</button>
          </div>
          <div className="bg-dark-700/50 border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-6 py-4 font-medium">Symbol</th>
                  <th className="text-left px-6 py-4 font-medium">Action</th>
                  <th className="text-left px-6 py-4 font-medium">Confidence</th>
                  <th className="text-left px-6 py-4 font-medium">Timeframe</th>
                  <th className="text-left px-6 py-4 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {signals?.slice(0, 5).map((s, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-6 py-4 font-medium">{s.symbol}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                        s.action === "buy" ? "bg-green-500/20 text-green-400" :
                        s.action === "sell" ? "bg-red-500/20 text-red-400" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>{s.action}</span>
                    </td>
                    <td className="px-6 py-4">{(s.confidence * 100).toFixed(0)}%</td>
                    <td className="px-6 py-4 text-gray-400">{s.timeframe}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{new Date(s.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {(!signals || signals.length === 0) && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No signals yet. Start the bot to generate signals.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confetti effect */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <div className="text-6xl animate-bounce">🚀</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-dark-700/50 border border-white/5 rounded-2xl p-5">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`font-heading text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
