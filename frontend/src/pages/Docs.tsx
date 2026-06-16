import { motion } from "framer-motion";
import { AppNavbar } from "../components/Navbar";

const sections = [
  {
    title: "Getting Started",
    icon: "🚀",
    items: [
      { q: "What is NexTrade AI?", a: "NexTrade AI is an automated trading bot for MEXC exchange. It runs two bots: an Analyst that scans markets using 8 strategies (RSI, MACD, EMA, Bollinger, Volume, Supertrend, ADX, Ichimoku) and a Trader that executes signals on your account." },
      { q: "How do I start?", a: "1. Sign up for an account\n2. Go to Settings and add your MEXC API keys (with trading permission, no withdrawal)\n3. Configure your trading mode (paper/live) and type (spot/futures)\n4. Click Start Bot on the Dashboard" },
      { q: "What plans are available?", a: "Basic ($29/mo) — 1 bot, 3 pairs, spot only, max $500 position\nPro ($79/mo) — 3 bots, 10 pairs, spot+futures, max $5,000\nEnterprise ($199/mo) — unlimited bots, all pairs, spot+futures, unlimited position, API access" },
    ],
  },
  {
    title: "Trading Concepts",
    icon: "📈",
    items: [
      { q: "What strategies does the Analyst use?", a: "8 strategies: RSI oversold/overbought, MACD crossovers, EMA trend following, volume breakout detection, Bollinger squeeze, Supertrend, ADX trend strength, and Ichimoku cloud." },
      { q: "What is paper trading?", a: "Paper mode simulates trades with virtual balance. No real money is at risk. Perfect for testing strategies before going live." },
      { q: "How does risk management work?", a: "Circuit breaker stops trading at 10% drawdown. Daily loss limits and cooldown periods prevent cascade failures. Trailing stop-loss protects profits." },
    ],
  },
  {
    title: "Accounts & Security",
    icon: "🔐",
    items: [
      { q: "Is my money safe?", a: "We never custody your funds. MEXC API keys are restricted to trading only — no withdrawals possible. All keys encrypted with AES-256 at rest." },
      { q: "How do I connect my wallet?", a: "Go to Settings > Wallet. Connect MetaMask (EVM) or Phantom (Solana). Used for identity verification and future crypto payments." },
      { q: "Can I cancel my subscription?", a: "Yes. No lock-in contracts. Cancel anytime from your account settings." },
    ],
  },
  {
    title: "Technical",
    icon: "⚙️",
    items: [
      { q: "What exchange do you support?", a: "Currently MEXC spot and perpetual futures. More exchanges coming soon." },
      { q: "What timeframes are analyzed?", a: "15-minute, 1-hour, and 4-hour candles." },
      { q: "How often are signals generated?", a: "The Analyst scans every minute on configured timeframes. Signals are published to Redis and executed by the Trader in real-time." },
    ],
  },
];

export default function Docs() {
  return (
    <div className="min-h-screen bg-dark-900">
      <AppNavbar />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">Documentation</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">Everything you need to know about NexTrade AI — from setup to advanced trading concepts.</p>
        </div>

        <div className="space-y-16">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="flex items-center gap-3 mb-8">
                <span className="text-2xl">{section.icon}</span>
                <h2 className="font-heading text-2xl font-bold">{section.title}</h2>
              </div>
              <div className="space-y-4">
                {section.items.map((item) => (
                  <motion.div key={item.q} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-6 hover:border-accent/20 transition-all">
                    <h3 className="font-heading font-bold text-sm mb-3">{item.q}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{item.a}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
