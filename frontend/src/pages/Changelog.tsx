import { motion } from "framer-motion";
import { AppNavbar } from "../components/Navbar";
import { PageTransition } from "../components/PageTransition";

const releases = [
  {
    version: "v1.2.0", date: "June 2026",
    changes: [
      { type: "feature", text: "Strategy performance dashboard — per-strategy win rate & P&L" },
      { type: "feature", text: "Backtesting UI — configurable date range, pair, strategy" },
      { type: "feature", text: "User API keys — programmatic access to platform data" },
      { type: "feature", text: "Custom pair selection — choose which pairs to trade" },
      { type: "feature", text: "Notification preferences — per-user Telegram/email toggles" },
      { type: "feature", text: "Dark/light mode toggle" },
      { type: "feature", text: "CSV export for trades, positions, and performance data" },
      { type: "feature", text: "Portfolio view — aggregate P&L with pair breakdown" },
      { type: "feature", text: "GDPR compliance — data export & account deletion endpoints" },
      { type: "improvement", text: "Loading skeletons on all data pages" },
      { type: "improvement", text: "Sortable columns on all tables" },
      { type: "improvement", text: "Error boundaries on every page" },
      { type: "improvement", text: "Code splitting — lazy loaded routes for faster initial load" },
    ],
  },
  {
    version: "v1.1.0", date: "April 2026",
    changes: [
      { type: "feature", text: "WebSocket real-time updates with exponential backoff reconnection" },
      { type: "feature", text: "Withdrawal protection — whitelist + time delays" },
      { type: "feature", text: "Wallet authentication (MetaMask EVM + Phantom Solana)" },
      { type: "feature", text: "Email verification & password reset flow" },
      { type: "feature", text: "Admin panel with user management" },
    ],
  },
  {
    version: "v1.0.0", date: "February 2026",
    changes: [
      { type: "feature", text: "Initial release — Analyst + Trader dual-bot system" },
      { type: "feature", text: "8 trading strategies (RSI, MACD, EMA, Volume, Bollinger, Supertrend, ADX, Ichimoku)" },
      { type: "feature", text: "MEXC spot + futures trading" },
      { type: "feature", text: "Paper trading with realistic fill simulation" },
      { type: "feature", text: "Multi-tenant architecture — per-user isolated sessions" },
      { type: "feature", text: "JWT authentication with bcrypt password hashing" },
      { type: "feature", text: "Fernet AES-256 encrypted API key storage" },
      { type: "feature", text: "Three subscription tiers (Basic/Pro/Enterprise) with plan enforcement" },
      { type: "feature", text: "Real-time bot control via Redis pub/sub" },
      { type: "feature", text: "Live dashboard with equity curve, positions, signals, trade history" },
    ],
  },
];

const typeStyles: Record<string, string> = {
  feature: "bg-accent/10 text-accent border-accent/20",
  improvement: "bg-dark-600/30 text-gray-400 border-dark-600",
  fix: "bg-negative/10 text-negative border-negative/20",
};

export default function Changelog() {
  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-16">
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">Changelog</h1>
            <p className="text-gray-400">Track every update, improvement, and fix</p>
          </div>

          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-dark-700/40" />
            {releases.map((release, ri) => (
              <motion.div key={ri} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="relative pl-12 pb-12 last:pb-0"
              >
                <div className="absolute left-3 top-1 w-8 h-8 rounded-full bg-dark-800 border-2 border-accent/30 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                </div>
                <div className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-heading text-xl font-bold">{release.version}</h2>
                    <span className="text-xs text-gray-500">{release.date}</span>
                  </div>
                  <ul className="space-y-2">
                    {release.changes.map((c, ci) => (
                      <li key={ci} className="flex items-start gap-3 text-sm">
                        <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold border capitalize ${typeStyles[c.type] || typeStyles.feature}`}>
                          {c.type}
                        </span>
                        <span className="text-gray-400">{c.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
