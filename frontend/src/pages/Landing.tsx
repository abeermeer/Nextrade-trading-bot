import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { LightningIcon, ChartIcon, ShieldIcon, KeyIcon, BrainIcon, BotIcon, EyeIcon, FlaskIcon } from "../components/Icons";
import { api } from "../api/client";

const plans = [
  {
    name: "Basic",
    price: "$29",
    period: "/mo",
    desc: "For individual traders getting started",
    features: ["1 bot instance", "3 trading pairs", "Spot only", "Max $500 position", "Email support"],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/mo",
    desc: "For serious traders who want more firepower",
    features: ["3 bot instances", "10 trading pairs", "Spot + Futures", "Max $5,000 position", "Priority support", "Advanced strategies"],
    cta: "Go Pro",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$199",
    period: "/mo",
    desc: "Maximum power for professional operations",
    features: ["Unlimited bots", "All trading pairs", "Spot + Futures", "Unlimited position size", "24/7 dedicated support", "API access", "Custom strategies"],
    cta: "Contact Sales",
    popular: false,
  },
];

const faqs = [
  { q: "How does NexTrade AI work?", a: "NexTrade AI runs two bots — an Analyst that scans markets using 15 strategies (RSI, MACD, EMA, CounterTrend, etc.) and a Trader that executes signals on your exchange account. You connect your API keys and click start." },
  { q: "Is my money safe?", a: "We never custody your funds. You connect your own exchange API keys with restricted permissions. We can only trade — no withdrawals. All keys are encrypted at rest with AES-256." },
  { q: "Can I test before going live?", a: "Yes. Every account gets paper trading mode. The bot simulates trades with virtual balance so you can see performance before risking real capital." },
  { q: "What exchanges do you support?", a: "MEXC, Binance, and Bybit — spot and perpetual futures. More exchanges coming soon." },
  { q: "Can I cancel anytime?", a: "Yes. No lock-in contracts. You can stop your bot or cancel your subscription at any time." },
  { q: "What kind of returns can I expect?", a: "Returns vary by market conditions. Our 15 strategies are designed for different market regimes. Paper trade first to evaluate performance with your settings." },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState<{ total_users: number; weekly_users: number; total_trades: number; win_rate: number } | null>(null);
  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-dark-950 text-white selection:bg-accent/30 selection:text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-950/90 backdrop-blur-md border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center font-bold text-xs text-dark-950">
              N
            </div>
            <span className="font-semibold text-xs tracking-wider text-white/70">NexTrade</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-xs text-gray-500 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-xs text-gray-500 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-xs text-gray-500 hover:text-white transition-colors">FAQ</a>
            {user ? (
              <button onClick={() => navigate("/dashboard")} className="text-xs bg-accent text-dark-950 px-5 py-2 rounded-md font-medium hover:bg-accent-dark transition-all">
                Dashboard
              </button>
            ) : (
              <>
                <Link to="/login" className="text-xs text-gray-500 hover:text-white transition-colors">Sign In</Link>
                <Link to="/signup" className="text-xs bg-accent text-dark-950 px-5 py-2 rounded-md font-medium hover:bg-accent-dark transition-all">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-gray-500 p-2 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-dark-900 border-t border-dark-800">
            <div className="px-6 py-4 space-y-2">
              {[
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "FAQ", href: "#faq" },
              ].map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)}
                  className="block text-xs text-gray-500 hover:text-white px-3 py-2.5 rounded-md transition-colors"
                >{item.label}</a>
              ))}
              {user ? (
                <button onClick={() => { navigate("/dashboard"); setMobileOpen(false); }}
                  className="w-full text-xs bg-accent text-dark-950 px-5 py-2.5 rounded-md font-medium mt-2"
                >Dashboard</button>
              ) : (
                <div className="pt-2 space-y-2">
                  <Link to="/login" onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center w-full text-xs text-gray-500 hover:text-white px-3 py-2.5 rounded-md border border-dark-600"
                  >Sign In</Link>
                  <Link to="/signup" onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center w-full text-xs bg-accent text-dark-950 px-5 py-2.5 rounded-md font-medium"
                  >Get Started</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dark-700 bg-dark-800 text-gray-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                v2.0 — Live on MEXC, Binance, Bybit
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight mt-6"
            >
              Intelligent trading,<br />
              <span className="text-accent">automatically executed</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="text-sm text-gray-500 leading-relaxed max-w-lg mt-4"
            >
              Institutional-grade AI that scans markets across 15 strategies, manages risk in real time, and executes trades 24/7 on your exchange account.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center gap-3 mt-8"
            >
              <Link to="/signup" className="bg-accent hover:bg-accent-dark text-dark-950 px-6 py-2.5 rounded-md font-medium text-xs transition-all inline-flex items-center gap-2 group">
                Start Free Trial
                <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <a href="#features" className="border border-dark-700 hover:border-dark-600 text-gray-500 hover:text-white px-6 py-2.5 rounded-md text-xs transition-all inline-flex items-center gap-2">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Watch Demo
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-6 mt-10"
            >
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-dark-950 bg-dark-700 flex items-center justify-center text-[9px] font-bold text-gray-500">
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <span><span className="text-white font-semibold text-sm">{stats ? `${stats.total_users}+` : "—"}</span> traders</span>
                <span className="w-px h-3 bg-dark-700" />
                <span><span className="text-white font-semibold text-sm">{stats ? `${stats.total_trades > 1000 ? (stats.total_trades / 1000).toFixed(0) + "K" : stats.total_trades}+` : "—"}</span> trades</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Live Stats */}
      <section className="py-16 px-6 border-t border-dark-800">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-dark-800 rounded-xl overflow-hidden">
            {[
              { label: "Active Traders", value: stats ? `${stats.total_users}+` : "—" },
              { label: "Trades Executed", value: stats ? `${stats.total_trades.toLocaleString()}+` : "—" },
              { label: "Strategies Deployed", value: "15" },
              { label: "Win Rate", value: stats ? `${stats.win_rate}%` : "—" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="bg-dark-900 p-6 text-center"
              >
                <div className="text-xl font-bold text-white tabular-nums">{s.value}</div>
                <div className="text-xs text-gray-600 mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12">
            <h2 className="text-2xl font-bold">Everything you need to trade smarter</h2>
            <p className="text-sm text-gray-600 mt-2">15 strategies, real-time execution, risk management built in.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { Icon: BrainIcon, title: "15 AI Strategies", desc: "RSI, MACD, EMA, Bollinger, Supertrend, ADX, Ichimoku, CounterTrend, StochRSI, PSAR, MFI, VWAP — diversified across timeframes" },
              { Icon: BotIcon, title: "Auto-Pilot 24/7", desc: "Analyst + Trader communicate via Redis pub/sub. Click start and they work around the clock." },
              { Icon: ShieldIcon, title: "Risk-First Design", desc: "Circuit breaker at 10% drawdown. Daily loss limits. Trailing stop-loss. Cooldown protection." },
              { Icon: ChartIcon, title: "Live Dashboard", desc: "Real-time P&L, equity curve, open positions, signal history, and bot logs. Every trade visible." },
              { Icon: LightningIcon, title: "Spot & Futures", desc: "Trade both markets. Set leverage per symbol. Full position mode control." },
              { Icon: KeyIcon, title: "Self-Custody", desc: "Your keys, your coins. Restricted API keys — can trade, cannot withdraw. Encrypted at rest." },
              { Icon: FlaskIcon, title: "Paper Trading", desc: "Test every strategy risk-free with virtual balance before going live." },
              { Icon: EyeIcon, title: "Full Transparency", desc: "Every signal, trade, and position visible on your dashboard. No black boxes." },
              { Icon: ShieldIcon, title: "Strategy Scoring", desc: "Each strategy is automatically backtested and scored. Poor performers lose weight over time." },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }}
                className="bg-dark-800 border border-dark-700 rounded-xl p-5 hover:border-dark-600 transition-all"
              >
                <div className="w-8 h-8 mb-3 rounded-lg bg-dark-700 flex items-center justify-center">
                  <f.Icon className="w-4 h-4 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium mb-1">{f.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-dark-800">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 text-center">
            <h2 className="text-2xl font-bold">Simple. Transparent.</h2>
            <p className="text-sm text-gray-600 mt-2">No hidden fees. No lock-in. Cancel anytime.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3 }}
                className={`relative rounded-xl p-6 border transition-all ${
                  plan.popular
                    ? "bg-dark-800 border-accent/40"
                    : "bg-dark-800/50 border-dark-700 hover:border-dark-600"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-dark-950 text-[10px] font-bold px-3 py-1 rounded-md tracking-wider">
                    BEST VALUE
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-xs font-semibold uppercase text-gray-500">{plan.name}</h3>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  <span className="text-gray-600 text-xs">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-accent">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`block text-center py-2 rounded-lg text-xs font-medium transition-all ${
                  plan.popular
                    ? "bg-accent text-dark-950 hover:bg-accent-dark"
                    : "border border-dark-700 hover:border-dark-600 text-gray-400 hover:text-white"
                }`}>
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 border-t border-dark-800">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10">
            <h2 className="text-2xl font-bold">Frequently asked</h2>
          </motion.div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 4 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.03 }}
                className="border border-dark-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-dark-800/50 transition-colors"
                >
                  <span className="text-xs text-gray-400 font-medium pr-4">{faq.q}</span>
                  <svg className={`w-3 h-3 shrink-0 text-gray-600 transition-transform ${openFaq === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-60" : "max-h-0"}`}>
                  <p className="px-4 pb-4 text-xs text-gray-600 leading-relaxed">{faq.a}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-dark-800">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl font-bold mb-3">
              Ready to trade <span className="text-accent">on autopilot?</span>
            </h2>
            <p className="text-sm text-gray-600 mb-8 max-w-md mx-auto">
              Join {stats ? `${stats.total_users}+ ` : ""}traders who already automated their trading. Start risk-free with paper mode.
            </p>
            <Link to="/signup" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-dark-950 px-8 py-2.5 rounded-md font-medium text-xs transition-all group">
              Start Free Trial
              <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-800 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-12 gap-8 mb-8">
            <div className="md:col-span-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center font-bold text-xs text-dark-950">N</div>
                <span className="font-semibold text-xs text-gray-500">NexTrade</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed max-w-xs">
                Institutional-grade AI trading bots for MEXC, Binance, and Bybit. Automated, self-custodial, transparent.
              </p>
            </div>
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-semibold tracking-widest text-gray-700 mb-3 uppercase">Company</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link to="/changelog" className="hover:text-white transition-colors">Changelog</Link></li>
                <li><Link to="/security" className="hover:text-white transition-colors">Security</Link></li>
                <li><Link to="/status" className="hover:text-white transition-colors">System Status</Link></li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-semibold tracking-widest text-gray-700 mb-3 uppercase">Legal</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/whitepaper" className="hover:text-white transition-colors">Whitepaper</Link></li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <h4 className="text-[10px] font-semibold tracking-widest text-gray-700 mb-3 uppercase">Contact</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                <li>support@nextrade.ai</li>
                <li>NexTrade AI Ltd.</li>
                <li>Larnaca, Cyprus</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-dark-800 pt-6 text-center text-[11px] text-gray-700">
            &copy; 2026 NexTrade AI Ltd.
          </div>
        </div>
      </footer>
    </div>
  );
}
