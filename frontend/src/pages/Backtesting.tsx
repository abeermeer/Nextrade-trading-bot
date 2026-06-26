import { useState } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AppNavbar } from "../components/Navbar";
import { PageTransition } from "../components/PageTransition";
import { Badge } from "../components/ui/Badge";
import { api } from "../api/client";
import type { BacktestResult } from "../types";

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT", "DOGE/USDT", "XRP/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT"];
const STRATEGIES = ["rsi", "macd_cross", "ema_trend", "volume_breakout", "bollinger_squeeze", "supertrend", "adx", "ichimoku", "pullback", "range", "counter_trend", "stoch_rsi", "psar", "mfi", "vwap"];

function MetricCard({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-dark-900/50 border border-white/[0.04] rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function Backtesting() {
  const [pair, setPair] = useState("BTC/USDT");
  const [strategy, setStrategy] = useState("rsi");
  const [days, setDays] = useState(30);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | { status: string; message: string } | null>(null);

  const runBacktest = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.runBacktest({ pair, strategy, days });
      setResult(res);
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.detail ? (typeof e.detail === "string" ? e.detail : String(e.detail)) : e?.message || "Backtest failed";
      setResult({ status: "error", message: msg });
    } finally {
      setRunning(false);
    }
  };

  const isResult = (r: any): r is BacktestResult => r && "total_pnl" in r;

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="mb-8">
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Backtesting</h1>
            <p className="text-gray-400">Test strategies against historical data before going live</p>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-8"
          >
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Trading Pair</label>
                <select value={pair} onChange={e => setPair(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/50 focus:outline-none"
                >
                  {PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Strategy</label>
                <select value={strategy} onChange={e => setStrategy(e.target.value)}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/50 focus:outline-none"
                >
                  {STRATEGIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Period (days)</label>
                <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min={7} max={365}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/50 focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <button onClick={runBacktest} disabled={running}
                  className="w-full bg-accent hover:bg-accent-dark text-dark-900 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {running ? "Running..." : "Run Backtest"}
                </button>
              </div>
            </div>

            {result && !isResult(result) && (
              <div className="mt-6 p-4 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">
                {(result as any).message || "Backtest failed"}
              </div>
            )}

            {result && isResult(result) && (
              <div className="mt-8 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Total P&L" value={`$${result.total_pnl.toFixed(2)}`} color={result.total_pnl >= 0 ? "text-green-400" : "text-red-400"} />
                  <MetricCard label="Return" value={`${result.total_pnl_pct.toFixed(1)}%`} color={result.total_pnl_pct >= 0 ? "text-green-400" : "text-red-400"} />
                  <MetricCard label="Win Rate" value={`${result.win_rate}%`} color={result.win_rate >= 50 ? "text-green-400" : "text-yellow-400"} />
                  <MetricCard label="Max Drawdown" value={`${result.max_drawdown_pct.toFixed(1)}%`} color="text-red-400" />
                  <MetricCard label="Total Trades" value={String(result.total_trades)} />
                  <MetricCard label="Sharpe Ratio" value={result.sharpe_ratio.toFixed(2)} color={result.sharpe_ratio >= 1 ? "text-green-400" : "text-yellow-400"} />
                  <MetricCard label="Final Balance" value={`$${result.final_balance.toFixed(2)}`} />
                  <MetricCard label="Period" value={result.period} />
                </div>

                {result.equity_curve && result.equity_curve.length > 0 && (
                  <div className="bg-dark-900/50 border border-white/[0.04] rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Equity Curve</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={result.equity_curve}>
                          <defs><linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00d4aa" stopOpacity={0.3} /><stop offset="100%" stopColor="#00d4aa" stopOpacity={0} /></linearGradient></defs>
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666" }} tickFormatter={(v) => v.slice(0, 10)} />
                          <YAxis domain={["dataMin - 100", "dataMax + 100"]} tick={{ fontSize: 10, fill: "#666" }} />
                          <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                          <Area type="monotone" dataKey="equity" stroke="#00d4aa" fill="url(#eqGrad)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {result.trades && result.trades.length > 0 && (
                  <div className="bg-dark-900/50 border border-white/[0.04] rounded-xl overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-300 px-4 py-3 border-b border-white/[0.04]">Recent Trades</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                            <th className="text-left px-4 py-2 font-medium">Date</th>
                            <th className="text-left px-4 py-2 font-medium">Action</th>
                            <th className="text-right px-4 py-2 font-medium">Price</th>
                            <th className="text-right px-4 py-2 font-medium">P&L</th>
                            <th className="text-right px-4 py-2 font-medium">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.trades.map((t, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="px-4 py-2 text-gray-400 font-mono text-xs">{t.date?.slice(0, 10) || "-"}</td>
                              <td className="px-4 py-2"><Badge variant={t.action === "buy" ? "success" : t.action === "sell" ? "warning" : "default"}>{t.action}</Badge></td>
                              <td className="px-4 py-2 text-right font-mono">${t.price?.toFixed(4) || "-"}</td>
                              <td className={`px-4 py-2 text-right font-mono ${(t.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>{t.pnl ? `$${t.pnl.toFixed(2)}` : "-"}</td>
                              <td className="px-4 py-2 text-right font-mono text-gray-300">${t.balance?.toFixed(2) || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </PageTransition>
    </div>
  );
}
