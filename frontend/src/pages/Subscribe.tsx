import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { AppNavbar } from "../components/Navbar";
import { PageTransition } from "../components/PageTransition";
import { Card } from "../components/ui/Card";
import { CheckIcon } from "../components/Icons";

const PLANS = [
  {
    id: "basic", name: "Basic", price: "$29", period: "/month",
    features: ["1 concurrent bot", "3 trading pairs", "$500 max position", "Spot only", "API access"],
  },
  {
    id: "pro", name: "Pro", price: "$79", period: "/month", popular: true,
    features: ["3 concurrent bots", "10 trading pairs", "$5,000 max position", "Spot + Futures", "API access", "Priority support"],
  },
  {
    id: "enterprise", name: "Enterprise", price: "$199", period: "/month",
    features: ["Unlimited bots", "Unlimited pairs", "Unlimited position", "Spot + Futures", "API access", "24/7 support", "Custom strategies"],
  },
];

export default function Subscribe() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    try {
      const res = await api.createCheckoutSession(planId);
      window.location.href = res.url;
    } catch {
      addToast("Subscription unavailable. Try again later.", "error");
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading("portal");
    try {
      const res = await api.getPortalUrl();
      window.location.href = res.url;
    } catch {
      addToast("Failed to open billing portal", "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="font-heading text-4xl font-bold mb-3">Choose Your Plan</h1>
            <p className="text-gray-400 text-lg">Upgrade anytime. Cancel anytime.</p>
            {user?.plan && (
              <p className="text-sm text-gray-500 mt-2">
                Current plan: <span className="text-accent font-semibold capitalize">{user.plan}</span>
                {" — "}
                <button onClick={handlePortal} disabled={loading === "portal"}
                  className="text-accent hover:underline disabled:opacity-50"
                >
                  {loading === "portal" ? "Loading..." : "Manage billing"}
                </button>
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan, i) => (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className={`p-8 relative ${plan.popular ? "border-accent/50 ring-1 ring-accent/20" : ""}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-dark-900 text-xs font-bold px-4 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h2 className="font-heading text-xl font-bold">{plan.name}</h2>
                    <div className="mt-3">
                      <span className="font-heading text-4xl font-bold">{plan.price}</span>
                      <span className="text-gray-400 text-sm">{plan.period}</span>
                    </div>
                  </div>
                  <div className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-center gap-3 text-sm text-gray-400">
                        <CheckIcon className="w-4 h-4 text-accent shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loading === plan.id || user?.plan === plan.id}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                      user?.plan === plan.id
                        ? "bg-dark-800 text-gray-500 border border-white/10 cursor-default"
                        : plan.popular
                          ? "bg-accent hover:bg-accent-dark text-dark-900"
                          : "bg-dark-800 border border-white/10 hover:border-white/30 text-white"
                    } disabled:opacity-50`}
                  >
                    {loading === plan.id ? "Redirecting..." : user?.plan === plan.id ? "Current Plan" : `Subscribe to ${plan.name}`}
                  </button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
