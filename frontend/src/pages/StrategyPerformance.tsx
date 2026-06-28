import { useState, useEffect } from "react";
import { api } from "../api/client";
import type { StrategyScores } from "../types";
import { AppNavbar } from "../components/Navbar";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../context/ToastContext";

export default function StrategyPerformance() {
  const { addToast } = useToast();
  const [dbData, setDbData] = useState<Record<string, { signals: number; wins: number; losses: number; total_pnl: number; win_rate: number; avg_confidence: number }> | null>(null);
  const [scores, setScores] = useState<StrategyScores | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.strategyPerformance(),
      api.strategyScores(),
    ]).then(([d, s]) => {
      setDbData(d);
      setScores(s);
    }).catch(() => {
      addToast("Failed to load strategy data", "error");
    }).finally(() => setLoading(false));
  }, []);

  const entries = dbData ? Object.entries(dbData).sort((a, b) => b[1].total_pnl - a[1].total_pnl) : [];

  return (
    <div className="min-h-screen bg-dark-950">
      <AppNavbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold">Strategy Performance</h1>
          <p className="text-xs text-gray-600 mt-1">Per-strategy P&L, accuracy, backtest scores, and weights</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-dark-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map(([name, stats]) => {
              const acc = scores?.accuracy?.[name];
              const bt = scores?.backtest?.[name];
              const weight = scores?.weights?.[name];
              const accPct = acc && acc.total > 0 ? ((acc.correct / acc.total) * 100).toFixed(0) : "—";
              return (
                <Card key={name} hover>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{name}</span>
                        {bt && <Badge variant={bt.composite > 0.5 ? "success" : "warning"}>{`Score: ${bt.composite.toFixed(2)}`}</Badge>}
                        <Badge variant="default">{`Weight: ${weight ? `${(weight * 100).toFixed(0)}%` : "—"}`}</Badge>
                      </div>
                      <Badge variant={stats.win_rate >= 50 ? "success" : "error"}>{`${stats.win_rate}% WR`}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                      <div>
                        <div className="text-gray-600 mb-0.5">Signals</div>
                        <div className="font-medium tabular-nums">{stats.signals}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 mb-0.5">Wins / Losses</div>
                        <div className="font-medium tabular-nums">{stats.wins} / {stats.losses}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 mb-0.5">P&L</div>
                        <div className={`font-medium tabular-nums ${stats.total_pnl >= 0 ? "text-positive" : "text-negative"}`}>
                          ${stats.total_pnl.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 mb-0.5">Accuracy</div>
                        <div className="font-medium tabular-nums">{accPct}%</div>
                      </div>
                      <div>
                        <div className="text-gray-600 mb-0.5">Backtest</div>
                        <div className="font-medium tabular-nums">
                          {bt ? `S:${bt.sharpe.toFixed(1)} WR:${bt.win_rate.toFixed(0)}%` : "—"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-1 bg-dark-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${stats.win_rate >= 50 ? "bg-positive" : "bg-negative"}`}
                        style={{ width: `${Math.abs(stats.win_rate)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
