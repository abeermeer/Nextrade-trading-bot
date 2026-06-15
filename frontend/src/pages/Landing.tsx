import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const plans = [
  {
    name: "Basic",
    price: "$29",
    period: "/mo",
    desc: "Perfect for getting started with automated trading",
    features: ["1 bot instance", "3 trading pairs", "Spot only", "Max $500 position", "Email support"],
    cta: "Get Started",
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

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Nav */}
      <nav className="border-b border-white/5 backdrop-blur-xl bg-dark-900/80 fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-dark-900 font-heading font-bold text-sm">N</span>
            </div>
            <span className="font-heading font-bold text-lg tracking-wider">NexTrade AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            {user ? (
              <button onClick={() => navigate("/dashboard")} className="text-sm bg-accent hover:bg-accent-dark text-dark-900 px-4 py-2 rounded-lg font-semibold transition-all">
                Dashboard
              </button>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Login</Link>
                <Link to="/signup" className="text-sm bg-accent hover:bg-accent-dark text-dark-900 px-4 py-2 rounded-lg font-semibold transition-all">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent-glow via-transparent to-transparent opacity-30" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-accent/10 rounded-full blur-3xl" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/20 bg-accent/5 text-accent text-sm mb-8">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            AI-Powered Trading — Live on MEXC
          </div>
          <h1 className="font-heading text-5xl md:text-7xl font-bold leading-tight mb-6">
            Trade Crypto
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-accent">
              24/7 Automatically
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Let our AI market analyst and professional trader bot work around the clock.
            Connect your MEXC account, set your strategy, and watch your portfolio grow.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/signup" className="bg-accent hover:bg-accent-dark text-dark-900 px-8 py-3.5 rounded-xl font-bold text-lg transition-all shadow-lg shadow-accent/20">
              Start Free Trial
            </Link>
            <a href="#features" className="border border-gray-600 hover:border-gray-400 text-white px-8 py-3.5 rounded-xl font-semibold text-lg transition-all">
              Learn More
            </a>
          </div>
          <div className="mt-16 flex items-center justify-center gap-8 text-sm text-gray-500">
            <span>✦ No coding required</span>
            <span>✦ MEXC integrated</span>
            <span>✦ Paper trading included</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">Built for <span className="text-accent">Performance</span></h2>
            <p className="text-gray-400 max-w-xl mx-auto">Everything you need to automate your crypto trading strategy</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "🧠", title: "8 AI Strategies", desc: "RSI, MACD, EMA, Bollinger, Volume, Supertrend, ADX, Ichimoku working together" },
              { icon: "🤖", title: "Auto-Pilot 24/7", desc: "Analyst + Trader bots communicate in real-time. Click start and let them work" },
              { icon: "🛡️", title: "Risk Management", desc: "Circuit breaker, daily drawdown limits, stop-loss, and cooldown protection" },
              { icon: "📊", title: "Live Dashboard", desc: "Real-time P&L, open positions, signal history, and performance analytics" },
              { icon: "🔄", title: "Spot + Futures", desc: "Trade both spot and perpetual futures on MEXC with full leverage control" },
              { icon: "🔐", title: "Your Keys, Your Coins", desc: "Connect your own MEXC API keys. We never custody your funds" },
            ].map((f, i) => (
              <div key={i} className="bg-dark-700/50 border border-white/5 rounded-2xl p-6 hover:border-accent/20 transition-all group">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-heading font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">Simple <span className="text-accent">Pricing</span></h2>
            <p className="text-gray-400 max-w-xl mx-auto">Choose the plan that matches your trading volume</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl p-8 border transition-all ${
                plan.popular
                  ? "bg-dark-700 border-accent/30 shadow-lg shadow-accent/5"
                  : "bg-dark-700/50 border-white/5 hover:border-white/10"
              }`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-dark-900 text-xs font-bold px-4 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-heading text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-gray-400 text-sm">{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="font-heading text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <span className="text-accent">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`block text-center py-3 rounded-xl font-semibold transition-all ${
                  plan.popular
                    ? "bg-accent hover:bg-accent-dark text-dark-900"
                    : "border border-gray-600 hover:border-gray-400 text-white"
                }`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
              <span className="text-dark-900 font-heading font-bold text-xs">N</span>
            </div>
            <span className="font-heading font-semibold tracking-wider">NexTrade AI</span>
          </div>
          <p>© 2026 NexTrade AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
