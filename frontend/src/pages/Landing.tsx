import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { HeroIllustration } from "../components/HeroIllustration";
import { LightningIcon, ChartIcon, ShieldIcon, KeyIcon, BrainIcon, BotIcon, EyeIcon, FlaskIcon, ClockIcon } from "../components/Icons";

const plans = [
  {
    name: "Basic",
    price: "$29",
    period: "/mo",
    desc: "Perfect for getting started with automated trading",
    features: ["1 bot instance", "3 trading pairs", "Spot only", "Max $500 position", "Email support"],
    cta: "Start Free",
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
    desc: "Maximum power for professional trading operations",
    features: ["Unlimited bots", "All trading pairs", "Spot + Futures", "Unlimited position size", "24/7 dedicated support", "API access", "Custom strategies"],
    cta: "Contact Sales",
    popular: false,
  },
];

const faqs = [
  { q: "How does NexTrade AI work?", a: "NexTrade AI runs two bots — an Analyst that scans markets using 8 strategies (RSI, MACD, EMA, etc.) and a Trader that executes signals on your MEXC account. You just connect your API keys and click start." },
  { q: "Is my money safe?", a: "We never custody your funds. You connect your own MEXC API keys with restricted permissions. We can only trade — no withdrawals. All keys are encrypted at rest with AES-256." },
  { q: "Can I test before going live?", a: "Yes. Every account gets paper trading mode. The bot simulates trades with virtual balance so you can see performance before risking real capital." },
  { q: "What exchanges do you support?", a: "Currently we support MEXC spot and perpetual futures. More exchanges coming soon." },
  { q: "Can I cancel anytime?", a: "Yes. No lock-in contracts. You can stop your bot or cancel your subscription at any time." },
  { q: "What kind of returns can I expect?", a: "Returns vary by market conditions. Our 8 strategies are designed for different market regimes. Paper trade first to evaluate performance with your settings." },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#07070d] text-white overflow-hidden">

      {/* ===== NAV ===== */}
      <nav className="border-b border-white/[0.05] backdrop-blur-xl bg-[#07070d]/80 fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-blue-accent flex items-center justify-center shadow-lg shadow-accent/20">
              <span className="text-[#07070d] font-heading font-bold text-sm">N</span>
            </div>
            <span className="font-heading font-bold text-base tracking-[0.15em]">NEXTRADE</span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#how" className="text-sm text-gray-400 hover:text-white transition-colors">How it Works</a>
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</a>
            {user ? (
              <button onClick={() => navigate("/dashboard")} className="text-sm bg-accent hover:bg-accent-dark text-[#07070d] px-5 py-2 rounded-lg font-bold transition-all shadow-lg shadow-accent/20">
                Dashboard
              </button>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Sign In</Link>
                <Link to="/signup" className="text-sm bg-accent hover:bg-accent-dark text-[#07070d] px-5 py-2 rounded-lg font-bold transition-all shadow-lg shadow-accent/20">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-accent/5 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMjBtMCAwIC4wMS0uMDEiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-50" />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/20 bg-accent/[0.04] text-accent text-xs font-semibold tracking-wider uppercase animate-slide-up">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Now Live on MEXC Exchange
              </div>

              <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight animate-slide-up delay-100">
                Trade Crypto
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-accent via-[#00f5d4] to-blue-accent mt-2">
                  on Autopilot
                </span>
              </h1>

              <p className="text-lg text-gray-400 leading-relaxed max-w-lg animate-slide-up delay-200">
                Institutional-grade AI that analyzes markets, manages risk, and executes trades 24/7 on your MEXC account. Set it. Forget it. Watch it grow.
              </p>

              <div className="flex flex-wrap items-center gap-4 animate-slide-up delay-300">
                <Link to="/signup" className="bg-accent hover:bg-accent-dark text-[#07070d] px-8 py-3.5 rounded-xl font-bold text-base transition-all shadow-xl shadow-accent/25 hover:shadow-accent/40 inline-flex items-center gap-2">
                  Start Free Trial
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <a href="#how" className="border border-white/10 hover:border-white/20 text-gray-300 px-8 py-3.5 rounded-xl font-semibold text-base transition-all inline-flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  See How It Works
                </a>
              </div>

              {/* Trusted By Bar */}
              <div className="flex items-center gap-6 pt-4 animate-slide-up delay-400">
                <div className="flex -space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#07070d] bg-gradient-to-br from-gray-600 to-gray-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500">
                  <span className="text-white font-bold">2,400+</span> traders active
                </div>
              </div>
            </div>

            {/* Right — Visual */}
            <div className="hidden lg:flex items-center justify-center animate-slide-up delay-300">
              <HeroIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-3">How It Works</div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold">Three Steps to <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-accent">Automated Trading</span></h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01", Icon: KeyIcon,
                title: "Connect Your Exchange",
                desc: "Link your MEXC account with restricted API keys. Your funds stay on the exchange — we only execute trades you authorize.",
              },
              {
                step: "02", Icon: LightningIcon,
                title: "Activate the AI",
                desc: "Choose spot or futures, set your risk parameters, and start the bot. The analyst scans 8 strategies, the trader executes with precision.",
              },
              {
                step: "03", Icon: ChartIcon,
                title: "Watch & Withdraw",
                desc: "Monitor performance on your live dashboard. Track P&L, open positions, and trade history. Withdraw profits anytime.",
              },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.03] to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-dark-800/40 border border-white/[0.06] rounded-3xl p-8 backdrop-blur-sm hover:border-accent/20 transition-all">
                  <div className="w-14 h-14 mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <item.Icon className="w-7 h-7 text-accent" />
                  </div>
                  <div className="text-accent/40 font-heading text-sm tracking-[0.15em] mb-2">{item.step}</div>
                  <h3 className="font-heading text-lg font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-5 w-10 h-px bg-gradient-to-r from-accent/40 to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-3">Why NexTrade</div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4">Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-accent">Serious Traders</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto">8 institutional-grade strategies, real-time risk management, and full transparency — all in one platform.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { Icon: BrainIcon, title: "8 AI Strategies", desc: "RSI, MACD, EMA, Bollinger, Volume, Supertrend, ADX, Ichimoku — diversified across timeframes", color: "from-accent/20 to-transparent" },
              { Icon: BotIcon, title: "Auto-Pilot 24/7", desc: "Analyst + Trader communicate via Redis. Click start and they work around the clock", color: "from-blue-accent/20 to-transparent" },
              { Icon: ShieldIcon, title: "Risk-First Design", desc: "Circuit breaker, daily drawdown limits, trailing stop-loss, and cooldown protection", color: "from-green-500/20 to-transparent" },
              { Icon: ChartIcon, title: "Live Dashboard", desc: "Real-time P&L, equity curve chart, open positions, signal history, and bot logs", color: "from-accent/20 to-transparent" },
              { Icon: LightningIcon, title: "Spot & Futures", desc: "Trade both markets with full leverage control. Set leverage per symbol", color: "from-blue-accent/20 to-transparent" },
              { Icon: KeyIcon, title: "Self-Custody", desc: "Your keys, your coins. We never hold your funds. All API keys encrypted with AES-256", color: "from-purple-500/20 to-transparent" },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
                className="group relative bg-dark-800/30 border border-white/[0.06] rounded-2xl p-6 hover:border-accent/20 transition-all overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-b ${f.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="relative">
                  <div className="w-10 h-10 mb-4 rounded-xl bg-accent/10 flex items-center justify-center">
                    <f.Icon className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="font-heading font-bold text-base mb-2">{f.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY TRUST ===== */}
      <section className="py-28 px-6 border-t border-white/[0.04] bg-gradient-to-b from-transparent via-accent/[0.01] to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-3">Trust & Security</div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4">Built With <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-accent">Integrity</span></h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { Icon: ShieldIcon, title: "Encrypted by Default", desc: "All MEXC API keys are encrypted at rest using Fernet AES-256. We never log or expose your credentials." },
              { Icon: KeyIcon, title: "No Custody", desc: "We never hold your funds. You connect with restricted API keys that can trade but cannot withdraw." },
              { Icon: EyeIcon, title: "Fully Transparent", desc: "Every trade, signal, and position is visible in real-time on your dashboard. No black boxes." },
              { Icon: FlaskIcon, title: "Paper Trading First", desc: "Test every strategy risk-free with paper mode. Only go live when you're confident in the performance." },
              { Icon: ClockIcon, title: "Real-Time Monitoring", desc: "Analyst and trader heartbeats monitored via Redis every 15 seconds. Downtime alerts are instant." },
              { Icon: ShieldIcon, title: "Risk Safeguards", desc: "Circuit breaker stops trading at 10% drawdown. Daily loss limits and cooldown periods prevent cascade failures." },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-dark-800/30 border border-white/[0.06] rounded-2xl p-6 hover:border-accent/20 transition-all"
              >
                <div className="w-10 h-10 mb-3 rounded-xl bg-accent/10 flex items-center justify-center">
                  <item.Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-heading font-bold text-sm mb-2">{item.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-3">Pricing</div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold mb-4">Simple, <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-accent">Transparent</span></h2>
            <p className="text-gray-400 max-w-xl mx-auto">No hidden fees. No lock-in contracts. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-3xl p-8 border transition-all ${
                plan.popular
                  ? "bg-gradient-to-b from-accent/[0.06] to-dark-800 border-accent/30 shadow-xl shadow-accent/5 scale-[1.02]"
                  : "bg-dark-800/40 border-white/[0.06] hover:border-white/20"
              }`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent to-blue-accent text-[#07070d] text-[11px] font-bold px-4 py-1.5 rounded-full tracking-wider whitespace-nowrap">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-heading text-lg font-bold mb-1">{plan.name}</h3>
                  <p className="text-gray-400 text-sm">{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="font-heading text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                      <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                        <span className="text-accent text-[10px]">✓</span>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                  plan.popular
                    ? "bg-accent hover:bg-accent-dark text-[#07070d] shadow-lg shadow-accent/20"
                    : "border border-white/10 hover:border-white/20 text-white"
                }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-accent text-sm font-semibold tracking-[0.2em] uppercase mb-3">FAQ</div>
            <h2 className="font-heading text-3xl md:text-5xl font-bold">Got <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-accent">Questions?</span></h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-dark-800/30 border border-white/[0.06] rounded-2xl overflow-hidden transition-all">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="font-medium text-sm pr-4">{faq.q}</span>
                  <svg className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${openFaq === i ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className={`overflow-hidden transition-all ${openFaq === i ? "max-h-60" : "max-h-0"}`}>
                  <p className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-28 px-6 border-t border-white/[0.04] bg-gradient-to-b from-transparent via-accent/[0.02] to-transparent">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-3xl md:text-5xl font-bold mb-6">
            Ready to Trade <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-accent">Smarter?</span>
          </h2>
          <p className="text-gray-400 mb-10 max-w-xl mx-auto">Join 2,400+ traders who already automated their MEXC trading with NexTrade AI. Start risk-free with paper trading.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-[#07070d] px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-xl shadow-accent/25 hover:shadow-accent/40">
            Start Free Trial
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.04] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-accent to-blue-accent flex items-center justify-center">
              <span className="text-[#07070d] font-heading font-bold text-[10px]">N</span>
            </div>
            <span className="font-heading font-bold text-sm tracking-[0.15em]">NEXTRADE</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <span>© 2026 NexTrade AI</span>
            <span className="hidden sm:inline">·</span>
            <span>Terms</span>
            <span className="hidden sm:inline">·</span>
            <span>Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
