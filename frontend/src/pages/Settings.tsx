import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { BotMode, TradeType } from "../types";

export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [keysSaved, setKeysSaved] = useState(false);
  const [maxPos, setMaxPos] = useState(user?.max_position_usdt || 500);

  const { data: existingKeys } = useQuery({
    queryKey: ["mexcKeys"],
    queryFn: api.getMexcKeys,
  });

  useEffect(() => {
    if (existingKeys?.has_keys) {
      setApiKey(existingKeys.api_key);
      setApiSecret(existingKeys.api_secret);
    }
  }, [existingKeys]);

  const saveKeys = useMutation({
    mutationFn: () => api.updateMexcKeys(apiKey, apiSecret),
    onSuccess: () => { setKeysSaved(true); updateUser({ has_mexc_keys: true }); setTimeout(() => setKeysSaved(false), 3000); },
  });

  const switchMode = useMutation({
    mutationFn: (mode: BotMode) => api.updateSettings({ mode, trade_type: user?.trade_type || "spot", max_position_usdt: maxPos }),
    onSuccess: (data) => updateUser({ mode: data.mode as BotMode }),
  });

  const switchTradeType = useMutation({
    mutationFn: (trade_type: TradeType) => api.updateSettings({ mode: user?.mode || "paper", trade_type, max_position_usdt: maxPos }),
    onSuccess: (data) => updateUser({ trade_type: data.trade_type as TradeType }),
  });

  const saveMaxPos = useMutation({
    mutationFn: () => api.updateSettings({ mode: user?.mode || "paper", trade_type: user?.trade_type || "spot", max_position_usdt: maxPos }),
    onSuccess: () => {},
  });

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-dark-900/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-dark-900 font-heading font-bold text-sm">N</span>
            </div>
            <span className="font-heading font-bold text-lg tracking-wider hidden sm:block">NexTrade AI</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Dashboard</button>
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-400 px-3 py-1.5 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold">Settings</h1>
          <p className="text-gray-400 text-sm">Configure your bot and MEXC connection</p>
        </div>

        {/* MEXC API Keys */}
        <section className="bg-dark-700/50 border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-lg">MEXC API Keys</h2>
              <p className="text-gray-400 text-sm">Connect your MEXC exchange account</p>
            </div>
            {user?.has_mexc_keys && <span className="text-accent text-sm font-semibold">✓ Connected</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">API Key</label>
            <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-all font-mono text-sm"
              placeholder="mx0vgl..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">API Secret</label>
            <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-all font-mono text-sm"
              placeholder="••••••••" />
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>🔒 Keys are encrypted at rest using AES-256</p>
            <p>📋 Enable <strong>Spot & Margin Trading</strong> and <strong>Read-only</strong> permissions on MEXC</p>
          </div>

          <button onClick={() => saveKeys.mutate()} disabled={!apiKey || !apiSecret || saveKeys.isPending}
            className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40"
          >
            {saveKeys.isPending ? "Saving..." : keysSaved ? "✓ Keys Saved!" : "Save Keys"}
          </button>
        </section>

        {/* Trading Mode */}
        <section className="bg-dark-700/50 border border-white/5 rounded-2xl p-6 space-y-4">
          <h2 className="font-heading font-bold text-lg">Trading Mode</h2>
          <div className="flex gap-2">
            {(["paper", "live"] as const).map((m) => (
              <button key={m} onClick={() => switchMode.mutate(m)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all border ${
                  (user?.mode || "paper") === m
                    ? m === "live" ? "bg-green-500/20 border-green-500 text-green-400" : "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                    : "bg-dark-800 border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                {m === "live" ? "🔴 Live" : "🟡 Paper"}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {user?.mode === "live" ? "⚠️ Live mode places REAL orders on MEXC. Tread carefully." : "Paper mode simulates trades with virtual balance. Safe to test."}
          </p>
        </section>

        {/* Trade Type */}
        <section className="bg-dark-700/50 border border-white/5 rounded-2xl p-6 space-y-4">
          <h2 className="font-heading font-bold text-lg">Trade Type</h2>
          <div className="flex gap-2">
            {(["spot", "futures"] as const).map((t) => (
              <button key={t} onClick={() => switchTradeType.mutate(t)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all border ${
                  (user?.trade_type || "spot") === t
                    ? "bg-blue-accent/20 border-blue-accent text-blue-400"
                    : "bg-dark-800 border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                {t === "spot" ? "💱 Spot" : "📈 Futures"}
              </button>
            ))}
          </div>
        </section>

        {/* Max Position Size */}
        <section className="bg-dark-700/50 border border-white/5 rounded-2xl p-6 space-y-4">
          <h2 className="font-heading font-bold text-lg">Risk Management</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Max Position Size (USDT)</label>
            <div className="flex gap-3">
              <input type="number" value={maxPos} onChange={(e) => setMaxPos(Number(e.target.value))}
                className="flex-1 bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent/50 transition-all"
                min={10} step={10} />
              <button onClick={() => saveMaxPos.mutate()} disabled={saveMaxPos.isPending}
                className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40"
              >
                {saveMaxPos.isPending ? "..." : "Save"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">Maximum USDT value per single trade position. Plan limit: ${user?.max_position_usdt?.toFixed(0) || "500"}</p>
        </section>

        {/* Account Info */}
        <section className="bg-dark-700/50 border border-white/5 rounded-2xl p-6">
          <h2 className="font-heading font-bold text-lg mb-4">Account</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Email</span><span>{user?.email}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Plan</span><span className="font-semibold capitalize text-accent">{user?.plan}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Bot Active</span><span>{user?.bot_active ? "🟢 Yes" : "🔴 No"}</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
