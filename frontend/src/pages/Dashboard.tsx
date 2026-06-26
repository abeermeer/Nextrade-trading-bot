import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import type { BotMode, TradeType, Signal } from "../types";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { useToast } from "../context/ToastContext";
import { AppNavbar } from "../components/Navbar";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table } from "../components/ui/Table";
import { PlayIcon, StopIcon, WalletIcon } from "../components/Icons";
import WalletConnect from "../components/WalletConnect";
export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showConfetti, setShowConfetti] = useState(false);

  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 10000 });
  const { data: positions } = useQuery({ queryKey: ["positions"], queryFn: api.positions, refetchInterval: 10000 });
  const { data: signals } = useQuery({ queryKey: ["signals"], queryFn: () => api.signals(5), refetchInterval: 10000 });
  const { data: performance } = useQuery({ queryKey: ["performance"], queryFn: api.performance, refetchInterval: 10000 });
  const { data: botStatus } = useQuery({ queryKey: ["botStatus"], queryFn: api.botStatus });
  const { data: botLogs } = useQuery({ queryKey: ["botLogs"], queryFn: api.botLogs, refetchInterval: 5000 });
  const { data: _portfolio } = useQuery({ queryKey: ["portfolio"], queryFn: api.portfolio, refetchInterval: 15000 });
  const portfolio = _portfolio as import("../types").PortfolioStats | undefined;

  const onWSMessage = useCallback((msg: { type: string; data: unknown }) => {
    if (msg.type === "status") queryClient.setQueryData(["status"], msg.data);
    if (msg.type === "signals") queryClient.setQueryData(["signals"], msg.data);
    if (msg.type === "positions") queryClient.setQueryData(["positions"], msg.data);
    if (msg.type === "performance") queryClient.setQueryData(["performance"], msg.data);
    if (msg.type === "logs") queryClient.setQueryData(["botLogs"], msg.data);
  }, [queryClient]);

  useWebSocket(onWSMessage);

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
  const hasKeys = botStatus?.has_api_keys ?? user?.has_api_keys ?? false;
  const botMode = botStatus?.mode ?? user?.mode ?? "paper";
  const keysRequired = botMode !== "paper" && !hasKeys;

  const signalColumns = [
    { key: "symbol", label: "Symbol", render: (s: Signal) => <span className="font-medium">{s.symbol}</span> },
    {
      key: "action", label: "Action",
      render: (s: Signal) => <Badge variant={s.action as "buy" | "sell" | "hold"}>{s.action}</Badge>,
    },
    { key: "confidence", label: "Confidence", render: (s: Signal) => `${(s.confidence * 100).toFixed(0)}%` },
    { key: "timeframe", label: "Timeframe", render: (s: Signal) => <span className="text-gray-400">{s.timeframe}</span> },
    { key: "time", label: "Time", render: (s: Signal) => <span className="text-gray-500 text-xs">{new Date(s.timestamp).toLocaleTimeString()}</span> },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <AppNavbar />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold">Trading Dashboard</h1>
            <p className="text-gray-400 text-sm">Real-time bot status and performance</p>
          </div>
          <div className="flex items-center gap-3">
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
        </motion.div>

        {/* Bot Communication Visualization */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-8">
            <div className="flex items-center justify-center gap-8 md:gap-16">
              <div className="text-center">
                <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-3 transition-all ${
                  analystAlive ? "bg-accent/20 border-2 border-accent shadow-lg shadow-accent/10" : "bg-dark-600 border border-white/10 opacity-50"
                }`}>
                  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke={analystAlive ? "#00d4aa" : "#6b7280"} strokeWidth="1.5">
                    <path d="M12 3a3 3 0 0 0-3 3v.5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 21a3 3 0 0 0 3-3v-.5a3 3 0 0 0-6 0v.5a3 3 0 0 0 3 3Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4.5 9.5a3 3 0 0 0 1.5 5.6 3 3 0 0 0 2.4-1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M19.5 9.5a3 3 0 0 1-1.5 5.6 3 3 0 0 1-2.4-1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 7.5a5 5 0 0 0 0 9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 7.5a5 5 0 0 1 0 9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="font-heading font-bold text-sm">Analyst</div>
                <div className={`text-xs mt-1 ${analystAlive ? "text-accent" : "text-gray-500"}`}>
                  {analystAlive ? "Active" : "Offline"}
                </div>
              </div>

              <div className="flex-1 max-w-48 relative">
                <div className="h-0.5 bg-gradient-to-r from-accent via-blue-accent to-green-500 mt-10" />
                <div className={`absolute -top-1 left-1/2 -translate-x-1/2 transition-all ${botActive ? "opacity-100" : "opacity-30"}`}>
                  <svg className={`w-6 h-6 ${botActive ? "text-yellow-400 animate-pulse" : "text-gray-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M13 2L4 14h6l-1 8 10-12h-6l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center text-xs text-gray-500 mt-2">
                  {botActive ? "Trading Live" : "Idle"}
                </div>
              </div>

              <div className="text-center">
                <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-3 transition-all ${
                  traderAlive ? "bg-green-500/20 border-2 border-green-500 shadow-lg shadow-green-500/10" : "bg-dark-600 border border-white/10 opacity-50"
                }`}>
                  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke={traderAlive ? "#22c55e" : "#6b7280"} strokeWidth="1.5">
                    <rect x="3" y="8" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 12h6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 16h6" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 2v3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 5h8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="font-heading font-bold text-sm">Trader</div>
                <div className={`text-xs mt-1 ${traderAlive ? "text-green-400" : "text-gray-500"}`}>
                  {traderAlive ? "Active" : "Offline"}
                </div>
              </div>
            </div>

            <div className="text-center mt-8">
              {keysRequired && (
                <p className="text-yellow-400 text-sm mb-3">Set your exchange API keys in Settings first</p>
              )}
              {botMode === "paper" && !hasKeys && !botActive && (
                <p className="text-blue-400 text-sm mb-3">Paper mode — no API keys needed</p>
              )}
              <button
                onClick={() => botActive ? stopBot.mutate() : startBot.mutate()}
                disabled={keysRequired || startBot.isPending || stopBot.isPending}
                className={`inline-flex items-center gap-2 px-10 py-3.5 rounded-xl font-bold text-lg transition-all ${
                  botActive
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                    : "bg-accent hover:bg-accent-dark text-dark-900 shadow-lg shadow-accent/20"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {startBot.isPending || stopBot.isPending ? (
                  "..."
                ) : botActive ? (
                  <><StopIcon className="w-5 h-5" /> Stop Bot</>
                ) : (
                  <><PlayIcon className="w-5 h-5" /> Start Bot</>
                )}
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Stats Cards */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent>
              <div className="text-sm text-gray-400 mb-1">Total P&L</div>
              <div className={`font-heading text-2xl font-bold ${totalPnl >= 0 ? "text-accent" : "text-red-400"}`}>
                ${totalPnl.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-sm text-gray-400 mb-1">Win Rate</div>
              <div className="font-heading text-2xl font-bold">{performance ? `${performance.win_rate}%` : "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-sm text-gray-400 mb-1">Total Trades</div>
              <div className="font-heading text-2xl font-bold">{performance?.total_trades ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-sm text-gray-400 mb-1">Open Positions</div>
              <div className="font-heading text-2xl font-bold">{positions?.length ?? 0}</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Wallet Status */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <WalletIcon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-sm">Crypto Wallet</h3>
                <p className="text-xs text-gray-500 mt-0.5">Connect for auth, payments & payouts</p>
              </div>
            </div>
            <WalletConnect />
          </Card>
        </motion.div>

        {/* Equity Curve */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6">
            <h2 className="font-heading text-lg font-bold mb-4">Equity Curve</h2>
            {performance?.equity_curve && performance.equity_curve.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={performance.equity_curve}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                  <YAxis domain={["dataMin - 100", "dataMax + 100"]} tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                  <Tooltip contentStyle={{ background: "#1c1c2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} labelFormatter={(v) => new Date(v).toLocaleString()} />
                  <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} fill="url(#eqGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 py-8">No trade history yet</div>
            )}
          </Card>
        </motion.div>

        {/* Portfolio */}
        {portfolio && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-lg font-bold">Portfolio Overview</h2>
                <div className="flex gap-2">
                  <button onClick={() => { api.exportTradesCsv().then(b => { const url = URL.createObjectURL(b); const a = document.createElement("a"); a.href = url; a.download = "trades.csv"; a.click(); URL.revokeObjectURL(url); addToast("Trades exported", "success"); }).catch(() => addToast("Export failed", "error")); }}
                    className="text-xs text-gray-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Export Trades
                  </button>
                  <button onClick={() => navigate("/strategy-performance")}
                    className="text-xs text-accent hover:text-accent-dark border border-accent/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Strategy Performance
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-gray-500 text-xs">Total P&L</div>
                  <div className={`font-heading text-lg font-bold ${portfolio.total_pnl >= 0 ? "text-accent" : "text-red-400"}`}>
                    ${portfolio.total_pnl.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Unrealized P&L</div>
                  <div className={`font-heading text-lg font-bold ${portfolio.total_unrealized_pnl >= 0 ? "text-accent" : "text-red-400"}`}>
                    ${portfolio.total_unrealized_pnl.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Open Positions</div>
                  <div className="font-heading text-lg font-bold">{portfolio.open_positions}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Total Invested</div>
                  <div className="font-heading text-lg font-bold">${portfolio.total_invested.toFixed(2)}</div>
                </div>
              </div>
              {portfolio.pair_breakdown.length > 0 && (
                <div>
                  <h3 className="font-heading text-sm font-semibold text-gray-400 mb-2">Pair Breakdown</h3>
                  <div className="space-y-1.5">
                    {portfolio.pair_breakdown.map((p) => (
                      <div key={p.symbol} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{p.symbol}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500 text-xs">{p.trades} trades</span>
                          <span className={`font-semibold ${p.pnl >= 0 ? "text-accent" : "text-red-400"}`}>
                            ${p.pnl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Signals Preview */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold">Latest Signals</h2>
            <button onClick={() => navigate("/signals")} className="text-sm text-accent hover:underline">View All</button>
          </div>
          <Card>
            <Table columns={signalColumns} data={signals?.slice(0, 5) || []} emptyMessage="No signals yet. Start the bot to generate signals." />
          </Card>
        </motion.div>

        {/* Bot Logs */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="font-heading text-lg font-bold mb-4">Bot Logs</h2>
          <Card className="max-h-64 overflow-y-auto">
            {botLogs && botLogs.length > 0 ? (
              <div className="p-4 space-y-1.5 font-mono text-xs">
                {botLogs.map((log, i) => (
                  <div key={i} className={`flex gap-2 ${log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-yellow-400" : "text-gray-400"}`}>
                    <span className="text-gray-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">No logs yet</div>
            )}
          </Card>
        </motion.div>

        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }} className="text-6xl">🚀</motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
