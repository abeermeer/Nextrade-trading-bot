import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppNavbar } from "../components/Navbar";
import { PageTransition } from "../components/PageTransition";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function AdminAnalytics() {
  const { addToast } = useToast();
  const [data, setData] = useState<{
    total_users: number; monthly_users: number; active_bots: number;
    total_trades: number; total_pnl: number;
    plan_breakdown: { basic: number; pro: number; enterprise: number };
    user_growth: { month: string; new_users: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminAnalytics().then(setData).catch(() => { addToast("Failed to load analytics", "error"); }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-dark-900 text-white">
      <AppNavbar />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="h-10 w-60 bg-dark-800/40 rounded-xl animate-pulse mb-8" />
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-dark-800/40 rounded-xl animate-pulse" />)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="mb-8">
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Admin Analytics</h1>
            <p className="text-gray-400">Platform-wide metrics and user growth</p>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Users", value: data?.total_users ?? 0, color: "text-accent" },
              { label: "New (30d)", value: data?.monthly_users ?? 0, color: "text-accent" },
              { label: "Active Bots", value: data?.active_bots ?? 0, color: "text-positive" },
              { label: "Total Trades", value: data?.total_trades ?? 0, color: "text-accent" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-dark-800/40 border border-white/[0.06] rounded-xl p-5"
              >
                <div className="text-gray-500 text-xs mb-1">{s.label}</div>
                <div className={`font-heading text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-6"
            >
              <h2 className="font-heading text-lg font-bold mb-4">Plan Breakdown</h2>
              <div className="space-y-3">
                {Object.entries(data?.plan_breakdown || {}).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between">
                    <span className="text-sm capitalize text-gray-400">{plan}</span>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold">{count}</div>
                      <div className="w-24 h-2 bg-dark-900 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          plan === "basic" ? "bg-dark-600" : plan === "pro" ? "bg-accent" : "bg-accent/60"
                        }`} style={{ width: `${data ? (count / Math.max(data.total_users, 1)) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-6"
            >
              <h2 className="font-heading text-lg font-bold mb-4">Total P&L</h2>
              <div className={`font-heading text-3xl font-bold ${(data?.total_pnl ?? 0) >= 0 ? "text-positive" : "text-negative"}`}>
                ${(data?.total_pnl ?? 0).toLocaleString()}
              </div>
              <p className="text-gray-500 text-xs mt-1">Across all users and trades</p>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-6"
          >
            <h2 className="font-heading text-lg font-bold mb-4">User Growth (6 months)</h2>
            <div className="space-y-2">
              {data?.user_growth.map((g, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-xs text-gray-500 w-20 shrink-0">{g.month}</span>
                  <div className="flex-1 h-5 bg-dark-900 rounded overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-accent to-blue-accent rounded transition-all duration-500"
                      style={{ width: `${Math.min((g.new_users / Math.max(...(data?.user_growth.map(x => x.new_users) || [1]), 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right">{g.new_users}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </PageTransition>
    </div>
  );
}
