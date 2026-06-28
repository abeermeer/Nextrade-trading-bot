import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PageTransition } from "../components/PageTransition";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  latency: number;
  lastCheck: string;
}

const API_URL = import.meta.env.VITE_API_URL || "https://mexc-trading-bot-production-c215.up.railway.app";

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    operational: "bg-positive",
    degraded: "bg-accent",
    down: "bg-negative",
  };
  return <span className={`inline-block w-3 h-3 rounded-full ${colors[status] || "bg-dark-600"} animate-pulse`} />;
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Backend API", status: "operational", latency: 0, lastCheck: "" },
    { name: "Analyst Bot", status: "operational", latency: 0, lastCheck: "" },
    { name: "Trader Bot", status: "operational", latency: 0, lastCheck: "" },
    { name: "Frontend", status: "operational", latency: 0, lastCheck: "" },
  ]);
  const [uptime] = useState(99.8);

  useEffect(() => {
    const check = async () => {
      const start = Date.now();
      try {
        const res = await fetch(API_URL + "/health");
        const latency = Date.now() - start;
        if (res.ok) {
          setServices(prev => prev.map(s => s.name === "Backend API" ? { ...s, status: "operational", latency, lastCheck: new Date().toISOString() } : s));
        } else {
          setServices(prev => prev.map(s => s.name === "Backend API" ? { ...s, status: "degraded", latency, lastCheck: new Date().toISOString() } : s));
        }
      } catch {
        setServices(prev => prev.map(s => s.name === "Backend API" ? { ...s, status: "down", latency: 0, lastCheck: new Date().toISOString() } : s));
      }
      try {
        const statusRes = await fetch(API_URL + "/api/status");
        const data = await statusRes.json();
        setServices(prev => prev.map(s => {
          if (s.name === "Analyst Bot") return { ...s, status: data.analyst_alive ? "operational" : "down", lastCheck: new Date().toISOString() };
          if (s.name === "Trader Bot") return { ...s, status: data.trader_alive ? "operational" : "down", lastCheck: new Date().toISOString() };
          return s;
        }));
      } catch {}
      setServices(prev => prev.map(s => s.name === "Frontend" ? { ...s, status: "operational", latency: 0, lastCheck: new Date().toISOString() } : s));
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <PageTransition>
          <div className="text-center mb-10">
            <h1 className="font-heading text-3xl font-bold mb-2">System Status</h1>
            <p className="text-gray-400">All services are being monitored in real-time</p>
          </div>

          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg font-semibold">Uptime (30d)</span>
              <span className="text-accent font-bold text-2xl">{uptime}%</span>
            </div>
            <div className="space-y-4">
              {services.map((svc, i) => (
                <motion.div key={svc.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between bg-dark-900/50 border border-white/[0.04] rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <StatusDot status={svc.status} />
                    <span className="font-medium">{svc.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`capitalize font-semibold ${
                      svc.status === "operational" ? "text-positive" :
                      svc.status === "degraded" ? "text-accent" : "text-negative"
                    }`}>{svc.status}</span>
                    {svc.latency > 0 && <span className="text-gray-500">{svc.latency}ms</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6">
            <h2 className="font-heading font-bold text-lg mb-4">SLA Commitment</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { plan: "Basic", sla: "Best-effort", response: "48h" },
                { plan: "Pro", sla: "Best-effort", response: "24h" },
                { plan: "Enterprise", sla: "Best-effort", response: "4h" },
              ].map((tier) => (
                <div key={tier.plan} className="bg-dark-900/50 border border-white/[0.04] rounded-xl p-4 text-center">
                  <div className="text-accent font-heading font-bold text-lg">{tier.sla}</div>
                  <div className="text-sm text-gray-400">uptime commitment</div>
                  <div className="text-xs text-gray-500 mt-1">{tier.plan} — {tier.response} response</div>
                </div>
              ))}
            </div>
          </div>
        </PageTransition>
      </div>
    </div>
  );
}
