import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AppNavbar } from "../components/Navbar";
import { PageTransition } from "../components/PageTransition";

const team = [
  { name: "Abeer Meer", role: "Founder & Lead Engineer", desc: "Full-stack developer and algorithmic trading systems architect. Built NexTrade AI from the ground up." },
];

const milestones = [
  { year: "2025 Q3", event: "Project started — analyst + trader bots for MEXC" },
  { year: "2025 Q4", event: "Full SaaS platform: JWT auth, plan enforcement, encrypted keys" },
  { year: "2026 Q1", event: "Wallet auth (EVM + Solana), withdrawal protection, WebSocket real-time" },
  { year: "2026 Q2", event: "15 strategies, multi-tenant trader, 64 tests, production deployment" },
];

export default function About() {
  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-4xl mx-auto px-6 py-16">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent/40 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-accent/20">
              <span className="text-dark-900 font-heading font-bold text-2xl">N</span>
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">About <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent/40">NexTrade AI</span></h1>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
              We build institutional-grade algorithmic trading tools for retail traders. No VCs. No gimmicks. Just working software.
            </p>
          </div>

          {/* Mission */}
          <motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-8 mb-8"
          >
            <h2 className="font-heading text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-gray-400 leading-relaxed">
              Crypto trading should not require a computer science degree or a hedge fund budget. We built NexTrade AI to give retail traders access to the same kind of automated trading infrastructure that institutions use — without the six-figure licensing fees or requiring you to trust us with your funds.
            </p>
            <p className="text-gray-400 leading-relaxed mt-4">
              Our platform combines 8 market analysis strategies with a real-time execution engine, all connected to your own MEXC account. You retain full custody of your funds at all times.
            </p>
          </motion.section>

          {/* Timeline */}
          <motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-8 mb-8"
          >
            <h2 className="font-heading text-2xl font-bold mb-6">Development Timeline</h2>
            <div className="space-y-0">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-4 pb-6 last:pb-0 relative">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-accent shrink-0 mt-1.5" />
                    {i < milestones.length - 1 && <div className="w-px flex-1 bg-dark-700/40 mt-1" />}
                  </div>
                  <div>
                    <div className="text-accent text-xs font-semibold tracking-wider uppercase mb-1">{m.year}</div>
                    <p className="text-gray-400 text-sm">{m.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Architecture */}
          <motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-8 mb-8"
          >
            <h2 className="font-heading text-2xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 leading-relaxed mb-4">
              NexTrade AI operates as two independent services that communicate through Redis:
            </p>
            <div className="grid md:grid-cols-2 gap-6 mb-4">
              <div className="bg-dark-900/50 rounded-xl p-5 border border-white/[0.04]">
                <h3 className="font-heading text-sm font-bold text-accent mb-2">Analyst Bot</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Scans markets every 15 minutes across 4 timeframes using 15 strategies. Generates signals with confidence scores and publishes them to Redis.
                </p>
              </div>
              <div className="bg-dark-900/50 rounded-xl p-5 border border-white/[0.04]">
                <h3 className="font-heading text-sm font-bold text-accent mb-2">Trader Bot</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Listens for signals via Redis pub/sub. Creates per-user sessions, executes trades on MEXC, manages risk, and tracks positions.
                </p>
              </div>
            </div>
          </motion.section>

          {/* Team */}
          <motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-8 mb-8"
          >
            <h2 className="font-heading text-2xl font-bold mb-6">Team</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {team.map((t, i) => (
                <div key={i} className="bg-dark-900/50 rounded-xl p-5 border border-white/[0.04]">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/30 to-blue-accent/30 flex items-center justify-center mb-3">
                    <span className="font-heading font-bold text-lg text-accent">{t.name.split(" ").map(n => n[0]).join("")}</span>
                  </div>
                  <h3 className="font-heading font-bold text-sm">{t.name}</h3>
                  <div className="text-accent text-xs font-semibold mb-2">{t.role}</div>
                  <p className="text-gray-400 text-xs leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Company info */}
          <motion.section initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="bg-dark-800/40 border border-white/[0.06] rounded-2xl p-8"
          >
            <h2 className="font-heading text-2xl font-bold mb-4">Company</h2>
            <div className="space-y-2 text-sm text-gray-400">
              <p><span className="text-gray-400 font-medium">Registered Name:</span> NexTrade AI Ltd.</p>
              <p><span className="text-gray-400 font-medium">Jurisdiction:</span> Larnaca, Cyprus</p>
              <p><span className="text-gray-400 font-medium">Contact:</span> support@nextrade.ai</p>
              <p className="mt-4 text-xs text-gray-500">NexTrade AI is a self-funded, independent software company. We do not accept venture capital funding. We do not custody user funds. We build trading tools — we do not give financial advice.</p>
            </div>
          </motion.section>

          {/* Bottom nav */}
          <div className="mt-12 text-center">
            <Link to="/whitepaper" className="text-accent hover:text-accent-dark text-sm font-semibold transition-colors">
              Read the Whitepaper →
            </Link>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
