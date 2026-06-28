import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { BotMode, TradeType, Signal } from "../types";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { useToast } from "../context/ToastContext";
import { AppNavbar } from "../components/Navbar";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Table } from "../components/ui/Table";
import { PlayIcon, StopIcon } from "../components/Icons";

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 10000 });
  const { data: positions } = useQuery({ queryKey: ["positions"], queryFn: api.positions, refetchInterval: 10000 });
  const { data: signals } = useQuery({ queryKey: ["signals"], queryFn: () => api.signals(5), refetchInterval: 10000 });
  const { data: performance } = useQuery({ queryKey: ["performance"], queryFn: api.performance, refetchInterval: 10000 });
  const { data: botStatus } = useQuery({ queryKey: ["botStatus"], queryFn: api.botStatus });
  const { data: botLogs } = useQuery({ queryKey: ["botLogs"], queryFn: api.botLogs, refetchInterval: 5000 });
  const { data: _portfolio } = useQuery({ queryKey: ["portfolio"], queryFn: api.portfolio, refetchInterval: 15000 });
  const { data: strategyScores } = useQuery({ queryKey: ["strategyScores"], queryFn: api.strategyScores, refetchInterval: 60000 });
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
    onSuccess: (data) => { updateUser({ bot_active: data.bot_active }); queryClient.invalidateQueries({ queryKey: ["botStatus"] }); addToast("Bot started", "success"); },
  });

  const stopBot = useMutation({
    mutationFn: () => api.controlBot("stop"),
    onSuccess: (data) => { updateUser({ bot_active: data.bot_active }); queryClient.invalidateQueries({ queryKey: ["botStatus"] }); addToast("Bot stopped", "info"); },
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
    { key: "symbol", label: "Symbol", render: (s: Signal) => <span className="font-medium text-xs">{s.symbol}</span> },
    { key: "action", label: "Action", render: (s: Signal) => <Badge variant={s.action as "buy" | "sell" | "hold"}>{s.action}</Badge> },
    { key: "confidence", label: "Confidence", render: (s: Signal) => `${(s.confidence * 100).toFixed(0)}%` },
    { key: "timeframe", label: "TF", render: (s: Signal) => <span className="text-gray-500 text-xs">{s.timeframe}</span> },
    { key: "time", label: "Time", render: (s: Signal) => <span className="text-gray-600 text-xs">{new Date(s.timestamp).toLocaleTimeString()}</span> },
  ];

  const strategyWeightData = strategyScores?.weights
    ? Object.entries(strategyScores.weights)
        .sort(([, a], [, b]) => b - a)
        .map(([name, weight]) => ({ name, weight: +(weight * 100).toFixed(1) }))
    : [];

  return (
    <div className="min-h-screen bg-dark-950">
      <AppNavbar />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Dashboard</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${analystAlive ? "bg-positive" : "bg-dark-500"}`} />
              <span className="text-xs text-gray-600">Analyst {analystAlive ? "online" : "offline"}</span>
              <span className="text-gray-700 mx-1">·</span>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${traderAlive ? "bg-positive" : "bg-dark-500"}`} />
              <span className="text-xs text-gray-600">Trader {traderAlive ? "online" : "offline"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-dark-800 rounded-lg p-0.5 border border-dark-700">
              {(["spot", "futures"] as const).map((t) => (
                <button key={t} onClick={() => switchTradeType.mutate(t)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    (user?.trade_type || "spot") === t
                      ? "bg-accent text-dark-950"
                      : "text-gray-500 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex bg-dark-800 rounded-lg p-0.5 border border-dark-700">
              {(["paper", "live"] as const).map((m) => (
                <button key={m} onClick={() => switchMode.mutate(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    (user?.mode || "paper") === m
                      ? m === "live" ? "bg-positive text-dark-950" : "bg-accent text-dark-950"
                      : "text-gray-500 hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bot Controls */}
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${botActive ? "bg-positive animate-pulse" : "bg-dark-500"}`} />
              <div>
                <span className="text-sm font-medium">{botActive ? "Bot Active" : "Bot Idle"}</span>
                <span className="text-xs text-gray-600 ml-2">
                  {botMode === "paper" ? "Paper trading" : "Live trading"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {keysRequired && <span className="text-xs text-accent">Set API keys in Settings first</span>}
              <button
                onClick={() => botActive ? stopBot.mutate() : startBot.mutate()}
                disabled={keysRequired || startBot.isPending || stopBot.isPending}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  botActive
                    ? "bg-negative/15 text-negative hover:bg-negative/25"
                    : "bg-accent text-dark-950 hover:bg-accent-dark"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {startBot.isPending || stopBot.isPending ? (
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : botActive ? (
                  <><StopIcon className="w-3.5 h-3.5" /> Stop</>
                ) : (
                  <><PlayIcon className="w-3.5 h-3.5" /> Start</>
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-gray-600 mb-1">Total P&L</div>
              <div className={`text-lg font-semibold tabular-nums ${totalPnl >= 0 ? "text-positive" : "text-negative"}`}>
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-gray-600 mb-1">Win Rate</div>
              <div className="text-lg font-semibold tabular-nums">{performance ? `${performance.win_rate}%` : "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-gray-600 mb-1">Total Trades</div>
              <div className="text-lg font-semibold tabular-nums">{performance?.total_trades ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-gray-600 mb-1">Open Positions</div>
              <div className="text-lg font-semibold tabular-nums">{positions?.length ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Strategy Intelligence */}
        {strategyScores && strategyWeightData.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-3">Strategy Intelligence</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="py-4">
                  <div className="text-xs text-gray-600 mb-3">Weight Distribution</div>
                  <div className="space-y-1.5">
                    {strategyWeightData.map((s) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-24 truncate">{s.name}</span>
                        <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${s.weight * 5}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-gray-500 w-8 text-right">{s.weight}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-xs text-gray-600 mb-3">Accuracy & Backtest Score</div>
                  <div className="space-y-1.5">
                    {strategyWeightData.slice(0, 10).map((s) => {
                      const acc = strategyScores?.accuracy?.[s.name];
                      const bt = strategyScores?.backtest?.[s.name];
                      const accPct = acc && acc.total > 0 ? ((acc.correct / acc.total) * 100).toFixed(0) : "—";
                      return (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 w-24 truncate">{s.name}</span>
                          <span className="tabular-nums text-gray-500 w-12">Acc: {accPct}%</span>
                          <span className="tabular-nums text-gray-500 w-12">Score: {bt ? bt.composite.toFixed(2) : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Equity Curve */}
        <Card>
          <CardContent className="py-4">
            <h2 className="text-sm font-semibold mb-3">Equity Curve</h2>
            {performance?.equity_curve && performance.equity_curve.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={performance.equity_curve}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: "#525252", fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString()} axisLine={false} tickLine={false} />
                  <YAxis domain={["dataMin - 100", "dataMax + 100"]} tick={{ fill: "#525252", fontSize: 10 }} tickFormatter={(v) => `$${v.toLocaleString()}`} axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={{ background: "#1e1e1e", border: "1px solid #2a2a2a", borderRadius: 8, color: "#e5e5e5", fontSize: 12 }} labelFormatter={(v) => new Date(v).toLocaleString()} />
                  <Area type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={1.5} fill="url(#eqGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-600 py-8 text-sm">No trade history yet</div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio */}
        {portfolio && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Portfolio</h2>
                <div className="flex gap-2">
                  <button onClick={() => { api.exportTradesCsv().then(b => { const url = URL.createObjectURL(b); const a = document.createElement("a"); a.href = url; a.download = "trades.csv"; a.click(); URL.revokeObjectURL(url); addToast("Trades exported", "success"); }).catch(() => addToast("Export failed", "error")); }}
                    className="text-xs text-gray-500 hover:text-white border border-dark-600 px-2.5 py-1 rounded-md transition-colors"
                  >
                    Export
                  </button>
                  <button onClick={() => navigate("/strategy-performance")}
                    className="text-xs text-accent hover:text-accent-dark border border-accent/20 px-2.5 py-1 rounded-md transition-colors"
                  >
                    Strategies
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-600">Total P&L</div>
                  <div className={`text-sm font-semibold tabular-nums ${portfolio.total_pnl >= 0 ? "text-positive" : "text-negative"}`}>
                    ${portfolio.total_pnl.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Unrealized P&L</div>
                  <div className={`text-sm font-semibold tabular-nums ${portfolio.total_unrealized_pnl >= 0 ? "text-positive" : "text-negative"}`}>
                    ${portfolio.total_unrealized_pnl.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Open Positions</div>
                  <div className="text-sm font-semibold tabular-nums">{portfolio.open_positions}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Total Invested</div>
                  <div className="text-sm font-semibold tabular-nums">${portfolio.total_invested.toFixed(2)}</div>
                </div>
              </div>
              {portfolio.pair_breakdown.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Pair Breakdown</div>
                  <div className="space-y-1">
                    {portfolio.pair_breakdown.map((p) => (
                      <div key={p.symbol} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{p.symbol}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-600">{p.trades} trades</span>
                          <span className={`tabular-nums font-medium ${p.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                            ${p.pnl.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Signals + Logs */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Latest Signals</h2>
              <button onClick={() => navigate("/signals")} className="text-xs text-accent hover:underline">View All</button>
            </div>
            <Card>
              <Table columns={signalColumns} data={signals?.slice(0, 5) || []} emptyMessage="No signals yet" />
            </Card>
          </div>
          <div>
            <h2 className="text-sm font-semibold mb-3">Bot Logs</h2>
            <Card className="max-h-56 overflow-y-auto">
              {botLogs && botLogs.length > 0 ? (
                <div className="p-4 space-y-1 font-mono text-xs">
                  {botLogs.map((log, i) => (
                    <div key={i} className={`flex gap-2 ${log.level === "error" ? "text-negative" : log.level === "warn" ? "text-accent" : "text-gray-600"}`}>
                      <span className="text-gray-700 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-600 py-8 text-sm">No logs yet</div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
