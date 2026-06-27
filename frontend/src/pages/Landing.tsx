import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { HeroIllustration } from "../components/HeroIllustration";
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.0, 1.0] as [number, number, number, number] } },
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden selection:bg-accent/30 selection:text-white">
      {/* Persistent noise overlay */}
      <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* ===== NAV ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 mix-blend-difference">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-white text-[#0a0a0f] flex items-center justify-center font-heading font-bold text-sm group-hover:scale-105 transition-transform">
              N
            </div>
            <span className="font-heading font-bold text-sm tracking-[0.2em] text-white/80 group-hover:text-white transition-colors">NEXTRADE</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#how" className="text-sm text-white/50 hover:text-white transition-colors">How it Works</a>
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-white/50 hover:text-white transition-colors">FAQ</a>
            {user ? (
              <button onClick={() => navigate("/dashboard")} className="text-sm bg-white text-[#0a0a0f] px-5 py-2.5 rounded-lg font-bold hover:bg-white/90 transition-all">
                Dashboard
              </button>
            ) : (
              <>
                <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors">Sign In</Link>
                <Link to="/signup" className="text-sm bg-white text-[#0a0a0f] px-5 py-2.5 rounded-lg font-bold hover:bg-white/90 transition-all">
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-white/50 p-2.5 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
              )}
            </svg>
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/5">
              <div className="px-6 py-6 space-y-1">
                {[
                  { label: "How it Works", href: "#how" },
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "FAQ", href: "#faq" },
                ].map((item) => (
                  <a key={item.label} href={item.href} onClick={() => setMobileOpen(false)}
                    className="block text-sm text-white/50 hover:text-white px-3 py-3 rounded-lg transition-colors"
                  >{item.label}</a>
                ))}
                {user ? (
                  <button onClick={() => { navigate("/dashboard"); setMobileOpen(false); }}
                    className="w-full text-sm bg-white text-[#0a0a0f] px-5 py-3 rounded-lg font-bold mt-3"
                  >Dashboard</button>
                ) : (
                  <div className="pt-3 space-y-2">
                    <Link to="/login" onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center w-full text-sm text-white/50 hover:text-white px-3 py-3 rounded-lg border border-white/10"
                    >Sign In</Link>
                    <Link to="/signup" onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center w-full text-sm bg-white text-[#0a0a0f] px-5 py-3 rounded-lg font-bold"
                    >Get Started</Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center pt-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-accent/3 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-accent/3 rounded-full blur-[150px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            {/* Left — Typography heavy */}
            <div className="lg:col-span-7 space-y-10">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.25, 0.1, 0.0, 1.0] }}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/40 text-[11px] font-mono tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  v2.0 — Now live on 3 exchanges
                </div>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.1, 0.0, 1.0] }}
                className="font-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight"
              >
                Trade
                <br />
                <span className="text-accent">on Autopilot</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.0, 1.0] }}
                className="text-lg text-white/40 leading-relaxed max-w-lg"
              >
                Institutional-grade AI that scans markets across 15 strategies, manages risk in real time, and executes trades 24/7 on your exchange account.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45, ease: [0.25, 0.1, 0.0, 1.0] }}
                className="flex flex-wrap items-center gap-4"
              >
                <Link to="/signup" className="bg-white hover:bg-white/90 text-[#0a0a0f] px-8 py-3.5 rounded-xl font-bold text-sm transition-all inline-flex items-center gap-2 group">
                  Start Free Trial
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <a href="#how" className="border border-white/10 hover:border-white/20 text-white/60 hover:text-white px-8 py-3.5 rounded-xl font-semibold text-sm transition-all inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Watch Demo
                </a>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.6 }}
                className="flex items-center gap-8"
              >
                <div className="flex -space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0a0a0f] bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-6 text-xs text-white/30 font-mono">
                  <span><span className="text-white font-heading text-sm">{stats ? `${stats.total_users}+` : "—"}</span> traders</span>
                  <span className="w-px h-4 bg-white/10" />
                  <span><span className="text-white font-heading text-sm">{stats ? `${stats.total_trades > 1000 ? (stats.total_trades / 1000).toFixed(0) + "K" : stats.total_trades}+` : "—"}</span> trades</span>
                </div>
              </motion.div>
            </div>

            {/* Right — Visual */}
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.1, 0.0, 1.0] }}
              className="lg:col-span-5 hidden lg:flex items-center justify-center"
            >
              <HeroIllustration />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS — Vertical Timeline ===== */}
      <section id="how" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-16">
            <div className="lg:col-span-4">
              <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                <span className="font-mono text-accent text-xs tracking-widest uppercase">Process</span>
                <h2 className="font-heading text-4xl md:text-5xl font-bold leading-[1.1] mt-4">
                  Three Moves<br />
                  <span className="text-white/30">to automate</span>
                </h2>
                <div className="w-12 h-px bg-accent/50 mt-6" />
                <p className="text-white/30 text-sm leading-relaxed mt-6 max-w-xs">
                  From zero to automated in under 5 minutes. No coding required.
                </p>
              </motion.div>
            </div>

            <div className="lg:col-span-7 lg:col-start-6">
              <div className="space-y-0">
                {[
                  {
                    step: "01", Icon: KeyIcon,
                    title: "Connect Your Exchange",
                    desc: "Link your MEXC, Binance, or Bybit account with read-only + trade API keys. Your funds stay on the exchange. We only execute what you authorize.",
                  },
                  {
                    step: "02", Icon: LightningIcon,
                    title: "Configure & Launch",
                    desc: "Choose spot or futures, set risk parameters (max position, drawdown limit), pick your strategies, and start the bot. The analyst scans 15 strategies across timeframes.",
                  },
                  {
                    step: "03", Icon: ChartIcon,
                    title: "Monitor & Optimize",
                    desc: "Track P&L, open positions, signal history, and equity curve on your live dashboard. Paper trade first, then go live when you're confident.",
                  },
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.15 }}
                    className="relative pl-12 pb-12 last:pb-0 group"
                  >
                    {/* Timeline line */}
                    <div className="absolute left-[11px] top-0 bottom-0 w-px bg-white/[0.06] last:hidden" />
                    <div className={`absolute left-[11px] top-0 w-px bg-accent/30 ${i === 0 ? "h-0" : i === 1 ? "h-1/2" : "h-full"} group-hover:bg-accent/50 transition-colors`} />

                    {/* Dot */}
                    <div className="absolute left-0 top-0.5 w-[23px] h-[23px] rounded-full bg-[#0a0a0f] border border-white/10 flex items-center justify-center group-hover:border-accent/50 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-accent/60 group-hover:bg-accent transition-colors" />
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 group-hover:border-white/10 transition-all">
                      <div className="flex items-center gap-4 mb-3">
                        <span className="font-mono text-xs text-white/20">{item.step}</span>
                        <item.Icon className="w-4 h-4 text-accent" />
                      </div>
                      <h3 className="font-heading text-base font-bold text-white/90">{item.title}</h3>
                      <p className="text-white/30 text-sm leading-relaxed mt-2">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LIVE STATS BANNER ===== */}
      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        className="py-20 px-6 border-t border-white/[0.04]"
      >
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.04]">
            {[
              { label: "Active Traders", value: stats ? `${stats.total_users}+` : "—", desc: "and growing" },
              { label: "Trades Executed", value: stats ? `${stats.total_trades.toLocaleString()}+` : "—", desc: "all automated" },
              { label: "Strategies", value: "15", desc: "institutional-grade" },
              { label: "Win Rate", value: stats ? `${stats.win_rate}%` : "—", desc: "average" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="bg-white/[0.02] p-8 text-center"
              >
                <div className="font-heading text-3xl md:text-4xl font-bold text-white">{s.value}</div>
                <div className="text-white/40 text-xs uppercase tracking-wider mt-2 font-mono">{s.label}</div>
                <div className="text-white/20 text-xs mt-1">{s.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ===== FEATURES — Magazine Grid ===== */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-16">
            <span className="font-mono text-accent text-xs tracking-widest uppercase">Capabilities</span>
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-[1.1] mt-4 max-w-xl">
              Everything you need to <span className="text-accent">trade smarter</span>
            </h2>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {[
              { Icon: BrainIcon, title: "15 AI Strategies", desc: "RSI, MACD, EMA, Bollinger, Supertrend, ADX, Ichimoku, CounterTrend, StochRSI, PSAR, MFI, VWAP & more — diversified across timeframes", size: "normal" },
              { Icon: BotIcon, title: "Auto-Pilot 24/7", desc: "Analyst + Trader communicate via Redis pub/sub. Click start and they work around the clock", size: "normal" },
              { Icon: ShieldIcon, title: "Risk-First Design", desc: "Circuit breaker at 10% drawdown. Daily loss limits. Trailing stop-loss. Cooldown protection.", size: "normal" },
              { Icon: ChartIcon, title: "Live Dashboard", desc: "Real-time P&L, equity curve, open positions, signal history, and bot logs. Every trade you can see.", size: "tall" },
              { Icon: LightningIcon, title: "Spot & Futures", desc: "Trade both markets. Set leverage per symbol. Full position mode control.", size: "normal" },
              { Icon: KeyIcon, title: "Self-Custody", desc: "Your keys, your coins. Restricted API keys — can trade, cannot withdraw. All encrypted.", size: "normal" },
              { Icon: FlaskIcon, title: "Paper Trading", desc: "Test every strategy risk-free with virtual balance before going live.", size: "normal" },
              { Icon: EyeIcon, title: "Full Transparency", desc: "Every signal, trade, and position visible on your dashboard. No black boxes.", size: "normal" },
            ].map((f, i) => (
              <motion.div key={i} variants={itemVariants}
                className={`group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-white/10 transition-all ${f.size === "tall" ? "md:row-span-2 flex flex-col justify-center" : ""}`}
              >
                <div className="w-9 h-9 mb-4 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                  <f.Icon className="w-4 h-4 text-white/40 group-hover:text-accent transition-colors" />
                </div>
                <h3 className="font-heading text-sm font-bold text-white/80 mb-2">{f.title}</h3>
                <p className="text-white/30 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-32 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-16 text-center">
            <span className="font-mono text-accent text-xs tracking-widest uppercase">Pricing</span>
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-[1.1] mt-4">
              Simple. <span className="text-white/30">Transparent.</span>
            </h2>
            <p className="text-white/30 text-sm mt-4 max-w-md mx-auto">No hidden fees. No lock-in. Cancel anytime. <span className="text-accent">99.5% uptime SLA</span> on all plans.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
                className={`relative rounded-2xl p-8 border transition-all ${
                  plan.popular
                    ? "bg-white/[0.04] border-white/20"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-[#0a0a0f] text-[10px] font-bold px-4 py-1.5 rounded-full tracking-widest font-mono">
                    BEST VALUE
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-heading text-sm font-bold tracking-wider uppercase text-white/40">{plan.name}</h3>
                  <p className="text-white/30 text-xs mt-1">{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="font-heading text-4xl font-bold">{plan.price}</span>
                  <span className="text-white/20 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/50">
                      <span className="text-accent text-xs">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                  plan.popular
                    ? "bg-accent text-[#0a0a0f] hover:bg-accent/90"
                    : "border border-white/10 hover:border-white/20 text-white/80 hover:text-white"
                }`}>
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-32 px-6 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-16">
            <span className="font-mono text-accent text-xs tracking-widest uppercase">Questions</span>
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-[1.1] mt-4">
              Frequently asked
            </h2>
          </motion.div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="border border-white/[0.06] rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm text-white/70 font-medium pr-4">{faq.q}</span>
                  <svg className={`w-3 h-3 shrink-0 text-white/30 transition-transform ${openFaq === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-60" : "max-h-0"}`}>
                  <p className="px-5 pb-5 text-sm text-white/30 leading-relaxed">{faq.a}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-32 px-6 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="font-mono text-accent text-xs tracking-widest uppercase">Get Started</span>
            <h2 className="font-heading text-4xl md:text-5xl font-bold leading-[1.1] mt-4 mb-6">
              Ready to trade<br />
              <span className="text-accent">on autopilot?</span>
            </h2>
            <p className="text-white/30 text-sm mb-10 max-w-md mx-auto">
              Join {stats ? `${stats.total_users}+ ` : ""}traders who already automated their trading. Start risk-free with paper mode.
            </p>
            <Link to="/signup" className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#0a0a0f] px-10 py-4 rounded-xl font-bold text-sm transition-all group">
              Start Free Trial
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.04] py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-12 gap-8 mb-8">
            <div className="md:col-span-4">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-white text-[#0a0a0f] flex items-center justify-center font-heading font-bold text-xs">N</div>
                <span className="font-heading font-bold text-xs tracking-[0.2em] text-white/60">NEXTRADE</span>
              </div>
              <p className="text-white/20 text-xs leading-relaxed max-w-xs">
                Institutional-grade AI trading bots for MEXC, Binance, and Bybit. Automated, self-custodial, transparent.
              </p>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-mono text-[10px] font-bold tracking-widest text-white/30 mb-4 uppercase">Company</h4>
              <ul className="space-y-2 text-xs text-white/20">
                <li><Link to="/about" className="hover:text-white/60 transition-colors">About</Link></li>
                <li><Link to="/changelog" className="hover:text-white/60 transition-colors">Changelog</Link></li>
                <li><Link to="/security" className="hover:text-white/60 transition-colors">Security</Link></li>
                <li><Link to="/status" className="hover:text-white/60 transition-colors">System Status</Link></li>
                <li><Link to="/docs" className="hover:text-white/60 transition-colors">Documentation</Link></li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-mono text-[10px] font-bold tracking-widest text-white/30 mb-4 uppercase">Legal</h4>
              <ul className="space-y-2 text-xs text-white/20">
                <li><Link to="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/whitepaper" className="hover:text-white/60 transition-colors">Whitepaper</Link></li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-mono text-[10px] font-bold tracking-widest text-white/30 mb-4 uppercase">Contact</h4>
              <ul className="space-y-2 text-xs text-white/20">
                <li>support@nextrade.ai</li>
                <li>NexTrade AI Ltd.</li>
                <li>Larnaca, Cyprus</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.04] pt-8 text-center text-[11px] text-white/10 font-mono">
            &copy; 2026 NexTrade AI Ltd. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
