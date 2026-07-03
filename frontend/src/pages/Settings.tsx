import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { AppNavbar } from "../components/Navbar";
import { Card } from "../components/ui/Card";
import { WalletIcon, KeyIcon, ShieldIcon, SettingsIcon, ChartIcon, CheckIcon, CopyIcon, TrashIcon, BrainIcon } from "../components/Icons";
import { PageTransition } from "../components/PageTransition";
import WalletConnect from "../components/WalletConnect";
import type { BotMode, TradeType, WhitelistEntry, ExchangeName } from "../types";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const [exchange, setExchange] = useState<ExchangeName>("mexc");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [keysSaved, setKeysSaved] = useState(false);
  const [keysVerified, setKeysVerified] = useState(user?.keys_verified ?? false);
  const [spotOk, setSpotOk] = useState(false);
  const [futuresOk, setFuturesOk] = useState(false);
  const [maxPos, setMaxPos] = useState(user?.max_position_usdt || 500);
  const [demoBalance, setDemoBalance] = useState<number>(10000);
  const [withdrawalDelay, setWithdrawalDelay] = useState(24);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newNetwork, setNewNetwork] = useState("ERC20");
  const [newLabel, setNewLabel] = useState("");
  const [selectedPairs, setSelectedPairs] = useState<string[]>(["BTC/USDT", "ETH/USDT", "SOL/USDT"]);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifTelegram, setNotifTelegram] = useState(false);
  const [notifPush, setNotifPush] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");

  const saveKeys = useMutation({
    mutationFn: () => api.updateExchangeKeys(apiKey, apiSecret, exchange),
    onSuccess: (data) => {
      setKeysSaved(true);
      setKeysVerified(data.keys_verified);
      setSpotOk(data.spot_ok);
      setFuturesOk(data.futures_ok);
      updateUser({ has_api_keys: true, exchange });
      setTimeout(() => setKeysSaved(false), 3000);
    },
    onError: () => {
      setKeysVerified(false);
    },
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

  const saveDemoBalance = useMutation({
    mutationFn: () => api.updateSettings({ mode: user?.mode || "paper", trade_type: user?.trade_type || "spot", max_position_usdt: maxPos, paper_balance_usdt: demoBalance }),
    onSuccess: () => addToast(`Demo balance set to $${demoBalance.toLocaleString()}`, "success"),
  });

  const resetDemo = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: (d) => addToast(`Demo reset — cleared ${d.trades_deleted} trades, ${d.positions_deleted} positions`, "success"),
    onError: () => addToast("Reset failed", "error"),
  });

  const { data: whitelist, refetch: refetchWhitelist } = useQuery({
    queryKey: ["whitelist"],
    queryFn: api.getWhitelist,
  });

  const { data: withdrawalSettings } = useQuery({
    queryKey: ["withdrawalSettings"],
    queryFn: api.getWithdrawalSettings,
  });

  useEffect(() => {
    if (withdrawalSettings) {
      setWithdrawalDelay(withdrawalSettings.withdrawal_delay_hours);
    }
  }, [withdrawalSettings]);

  const { data: pairsData } = useQuery({ queryKey: ["selectedPairs"], queryFn: api.getSelectedPairs });
  const { data: notifData } = useQuery({ queryKey: ["notifPrefs"], queryFn: api.getNotificationPrefs });
  const { data: apiKeysData, refetch: refetchApiKeys } = useQuery({ queryKey: ["apiKeys"], queryFn: api.listApiKeys });

  useEffect(() => {
    if (pairsData?.selected_pairs) setSelectedPairs(pairsData.selected_pairs);
  }, [pairsData]);

  useEffect(() => {
    if (notifData?.notification_prefs) {
      setNotifEmail(notifData.notification_prefs.email ?? true);
      setNotifTelegram(notifData.notification_prefs.telegram ?? false);
      setNotifPush(notifData.notification_prefs.push ?? false);
    }
  }, [notifData]);

  const savePairs = useMutation({
    mutationFn: () => api.updateSelectedPairs({ selected_pairs: selectedPairs }),
    onSuccess: () => { addToast("Pairs updated", "success"); },
  });

  const saveNotifs = useMutation({
    mutationFn: () => api.updateNotificationPrefs({ notification_prefs: { email: notifEmail, telegram: notifTelegram, push: notifPush } }),
    onSuccess: () => addToast("Notification preferences saved", "success"),
  });

  const createKey = useMutation({
    mutationFn: () => api.createApiKey(newApiKeyName || "Default"),
    onSuccess: (data: { api_key: string }) => {
      setGeneratedKey(data.api_key);
      setNewApiKeyName("");
      refetchApiKeys();
      addToast("API key created — copy it now, it won't be shown again", "success");
    },
  });

  const revokeKey = useMutation({
    mutationFn: (id: number) => api.revokeApiKey(id),
    onSuccess: () => { refetchApiKeys(); addToast("API key revoked", "info"); },
  });

  const saveWithdrawalDelay = useMutation({
    mutationFn: () => api.updateWithdrawalSettings({ withdrawal_delay_hours: withdrawalDelay }),
    onSuccess: () => {},
  });

  const addWhitelistMutation = useMutation({
    mutationFn: () => api.addWhitelist({ address: newAddress, network: newNetwork, label: newLabel }),
    onSuccess: () => {
      setShowAddAddress(false);
      setNewAddress("");
      setNewNetwork("ERC20");
      setNewLabel("");
      refetchWhitelist();
    },
  });

  const deleteWhitelistMutation = useMutation({
    mutationFn: (id: number) => api.deleteWhitelist(id),
    onSuccess: () => refetchWhitelist(),
  });

  return (
    <div className="min-h-screen bg-dark-900">
      <AppNavbar />
      <PageTransition>
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          <div>
            <h1 className="font-heading text-2xl font-bold">Settings</h1>
            <p className="text-gray-400 text-sm">Configure your bot and exchange connection</p>
          </div>

          {/* Exchange API Keys */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <KeyIcon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-lg">Exchange API Keys</h2>
                    <p className="text-gray-400 text-sm">Connect your exchange account</p>
                  </div>
                </div>
                {user?.has_api_keys && keysVerified
                  ? <span className="flex items-center gap-1 text-accent text-sm font-semibold"><CheckIcon className="w-4 h-4" /> Verified {spotOk ? "Spot ✓" : ""} {futuresOk ? "Futures ✓" : ""}</span>
                  : user?.has_api_keys && !keysVerified
                    ? <span className="flex items-center gap-1 text-accent text-sm font-semibold">⚠️ Not Verified</span>
                    : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Exchange</label>
                <select value={exchange} onChange={(e) => setExchange(e.target.value as ExchangeName)}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent/50 transition-all text-sm"
                >
                  <option value="mexc">MEXC</option>
                  <option value="binance">Binance</option>
                  <option value="bybit">Bybit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">API Key</label>
                <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-all font-mono text-sm"
                  placeholder={exchange === "mexc" ? "mx0vgl..." : exchange === "binance" ? "Binance API key" : "Bybit API key"} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">API Secret</label>
                <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-all font-mono text-sm"
                  placeholder="••••••••" />
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>Keys are encrypted at rest using AES-256</p>
                <p>Enable <strong>Spot & Margin Trading</strong> and <strong>Read</strong> permissions on your exchange</p>
                <p className="text-amber-400/90">For your safety, create a <strong>trade-only</strong> key with <strong>withdrawals disabled</strong>. NexTrade never needs withdrawal access.</p>
              </div>

              {saveKeys.error && (
                <p className="text-negative text-sm">{(saveKeys.error as { detail?: string })?.detail || "Failed to verify keys. Check your credentials."}</p>
              )}
              <button onClick={() => saveKeys.mutate()} disabled={!apiKey || !apiSecret || saveKeys.isPending}
                className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40"
              >
                {saveKeys.isPending ? `Verifying with ${exchange.toUpperCase()}...` : keysSaved ? "Keys Verified!" : "Save & Verify Keys"}
              </button>
            </Card>
          </motion.div>

          {/* Connected Wallet */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <WalletIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg">Connected Wallet</h2>
                  <p className="text-gray-400 text-sm">Link your crypto wallet for auth, payments & payouts</p>
                </div>
              </div>
              <WalletConnect />
              <p className="text-xs text-gray-500">Supports MetaMask (EVM) and Phantom (Solana). Your wallet is used for sign-in, future plan payments, and profit withdrawals.</p>
            </Card>
          </motion.div>

          {/* Withdrawal Protection */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <ShieldIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg">Withdrawal Protection</h2>
                  <p className="text-gray-400 text-sm">Manage withdrawal address whitelist and security delays</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">New Address Withdrawal Delay (hours)</label>
                <div className="flex gap-3">
                  <input type="number" value={withdrawalDelay} onChange={(e) => setWithdrawalDelay(Number(e.target.value))}
                    className="flex-1 bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent/50 transition-all"
                    min={0} step={1} />
                  <button onClick={() => saveWithdrawalDelay.mutate()} disabled={saveWithdrawalDelay.isPending}
                    className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40"
                  >
                    {saveWithdrawalDelay.isPending ? "..." : "Save"}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-400">Whitelisted Addresses</span>
                  <button onClick={() => setShowAddAddress(!showAddAddress)}
                    className="text-xs text-accent hover:text-accent-dark font-semibold"
                  >
                    {showAddAddress ? "Cancel" : "+ Add Address"}
                  </button>
                </div>

                {showAddAddress && (
                  <div className="bg-dark-800 border border-white/10 rounded-xl p-4 space-y-3 mb-3">
                    <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)}
                      className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                      placeholder="Wallet address" />
                    <div className="flex gap-2">
                      <select value={newNetwork} onChange={(e) => setNewNetwork(e.target.value)}
                        className="bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                      >
                        <option value="ERC20">ERC20</option>
                        <option value="BEP20">BEP20</option>
                        <option value="SOL">SOL</option>
                        <option value="TRC20">TRC20</option>
                        <option value="ARBITRUM">ARBITRUM</option>
                      </select>
                      <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                        className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                        placeholder="Label (e.g. My Wallet)" />
                    </div>
                    <button onClick={() => addWhitelistMutation.mutate()} disabled={!newAddress || addWhitelistMutation.isPending}
                      className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-40"
                    >
                      {addWhitelistMutation.isPending ? "Adding..." : "Add to Whitelist"}
                    </button>
                  </div>
                )}

                {whitelist && whitelist.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                          <th className="text-left px-3 py-2 font-medium">Address</th>
                          <th className="text-left px-3 py-2 font-medium">Network</th>
                          <th className="text-left px-3 py-2 font-medium">Label</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                          <th className="text-right px-3 py-2 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {whitelist.map((entry: WhitelistEntry) => (
                          <tr key={entry.id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{entry.address.slice(0, 10)}...{entry.address.slice(-6)}</td>
                            <td className="px-3 py-2.5 text-gray-400">{entry.network}</td>
                            <td className="px-3 py-2.5 text-gray-400">{entry.label || "—"}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-semibold ${entry.is_approved ? "text-green-400" : "text-accent"}`}>
                                {entry.is_approved ? "Approved" : "Pending"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button onClick={() => deleteWhitelistMutation.mutate(entry.id)} disabled={deleteWhitelistMutation.isPending}
                                className="text-xs text-negative hover:text-red-300 px-3 py-1.5 rounded-lg"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No whitelisted addresses yet</p>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Trading Mode */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-accent" />
                </div>
                <h2 className="font-heading font-bold text-lg">Trading Mode</h2>
              </div>
              <div className="flex gap-2">
                {(["paper", "live"] as const).map((m) => (
                  <button key={m} onClick={() => switchMode.mutate(m)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all border ${
                      (user?.mode || "paper") === m
                        ? m === "live" ? "bg-positive/20 border-positive text-positive" : "bg-accent/20 border-accent text-accent"
                        : "bg-dark-800 border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {m === "live" ? "Live" : "Paper"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                {user?.mode === "live" ? "Live mode places REAL orders on your exchange. Tread carefully." : "Paper mode simulates trades with virtual balance. Safe to test."}
              </p>
            </Card>
          </motion.div>

          {/* Trade Type */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <ChartIcon className="w-5 h-5 text-accent" />
                </div>
                <h2 className="font-heading font-bold text-lg">Trade Type</h2>
              </div>
              <div className="flex gap-2">
                {(["spot", "futures"] as const).map((t) => (
                  <button key={t} onClick={() => switchTradeType.mutate(t)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all border ${
                      (user?.trade_type || "spot") === t
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-dark-800 border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {t === "spot" ? "Spot" : "Futures"}
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Max Position Size */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="p-6 space-y-4">
              <h2 className="font-heading font-bold text-lg">Risk Management</h2>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Max Position Size (USDT)</label>
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
            </Card>
          </motion.div>

          {/* Paper / Demo Trading */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="p-6 space-y-4">
              <h2 className="font-heading font-bold text-lg">Paper / Demo Trading</h2>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Demo Starting Balance (USDT)</label>
                <div className="flex gap-3">
                  <input type="number" value={demoBalance} onChange={(e) => setDemoBalance(Number(e.target.value))}
                    className="flex-1 bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent/50 transition-all"
                    min={10} step={100} />
                  <button onClick={() => saveDemoBalance.mutate()} disabled={saveDemoBalance.isPending}
                    className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40"
                  >
                    {saveDemoBalance.isPending ? "..." : "Save"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Virtual balance the paper bot trades with. Takes effect on next bot start (paper mode).</p>
              </div>
              <div className="border-t border-white/10 pt-4">
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Reset Demo Results</label>
                <button
                  onClick={() => { if (window.confirm("Clear ALL demo (paper) trades, positions and signals? Live trades are kept.")) resetDemo.mutate(); }}
                  disabled={resetDemo.isPending}
                  className="bg-negative/15 hover:bg-negative/25 text-negative font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 border border-negative/30"
                >
                  {resetDemo.isPending ? "Clearing…" : "Reset Demo Data"}
                </button>
                <p className="text-xs text-gray-500 mt-1.5">Wipes paper P&L, trades, positions and old signals. Live account is untouched.</p>
              </div>
            </Card>
          </motion.div>

          {/* Strategy Config */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <BrainIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg">Strategy Configuration</h2>
                  <p className="text-gray-400 text-sm">View which strategies are active. Tuning coming soon.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["rsi", "macd_cross", "ema_trend", "volume_breakout", "bollinger_squeeze", "supertrend", "adx", "ichimoku", "pullback", "range", "counter_trend", "stoch_rsi", "psar", "mfi", "vwap"].map((s) => (
                  <div key={s} className="bg-dark-900/50 border border-white/[0.04] rounded-xl px-4 py-3 text-sm capitalize text-gray-400">
                    {s}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Custom Pairs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <ChartIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg">Trading Pairs</h2>
                  <p className="text-gray-400 text-sm">Select which pairs to trade</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "ADA/USDT", "DOGE/USDT", "XRP/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT"].map((p) => (
                  <button key={p} onClick={() => setSelectedPairs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                      selectedPairs.includes(p)
                        ? "bg-accent/10 border-accent/30 text-accent"
                        : "bg-dark-800 border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={() => savePairs.mutate()} disabled={savePairs.isPending}
                className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 self-start"
              >
                {savePairs.isPending ? "Saving..." : "Save Pairs"}
              </button>
            </Card>
          </motion.div>

          {/* Notification Prefs */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg">Notifications</h2>
                  <p className="text-gray-400 text-sm">Choose how you receive alerts</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { key: "email", label: "Email", val: notifEmail, set: setNotifEmail, desc: "Signal alerts and weekly summaries" },
                  { key: "telegram", label: "Telegram", val: notifTelegram, set: setNotifTelegram, desc: "Real-time trade execution alerts" },
                  { key: "push", label: "Push", val: notifPush, set: setNotifPush, desc: "Browser push notifications" },
                ].map((n) => (
                  <div key={n.key} className="flex items-center justify-between bg-dark-900/50 border border-white/[0.04] rounded-xl px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{n.label}</div>
                      <div className="text-xs text-gray-500">{n.desc}</div>
                    </div>
                    <button onClick={() => n.set(!n.val)}
                      className={`w-10 h-6 rounded-full transition-all border ${
                        n.val ? "bg-accent border-accent" : "bg-dark-800 border-white/10"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-gray-300 transition-transform ${n.val ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => saveNotifs.mutate()} disabled={saveNotifs.isPending}
                className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40 self-start"
              >
                {saveNotifs.isPending ? "Saving..." : "Save Preferences"}
              </button>
            </Card>
          </motion.div>

          {/* API Keys */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <KeyIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg">API Keys (Programmatic Access)</h2>
                  <p className="text-gray-400 text-sm">Create keys for API access to your trading data</p>
                </div>
              </div>

              {generatedKey && (
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-4">
                  <p className="text-accent text-sm font-semibold mb-2">Key generated — copy it now!</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-dark-900 px-3 py-2 rounded-lg text-xs font-mono text-accent break-all">{generatedKey}</code>
                    <button onClick={() => { navigator.clipboard.writeText(generatedKey); addToast("Copied!", "success"); }}
                      className="text-accent hover:text-accent-dark p-2"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <button onClick={() => setGeneratedKey("")} className="text-xs text-gray-500 mt-2 hover:text-white">Dismiss</button>
                </div>
              )}

              <div className="flex gap-2">
                <input type="text" value={newApiKeyName} onChange={e => setNewApiKeyName(e.target.value)}
                  className="flex-1 bg-dark-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent/50"
                  placeholder="Key name (e.g. My Script)" />
                <button onClick={() => createKey.mutate()} disabled={createKey.isPending}
                  className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-5 py-2.5 rounded-xl transition-all disabled:opacity-40"
                >
                  {createKey.isPending ? "..." : "Generate"}
                </button>
              </div>

              {apiKeysData?.api_keys && apiKeysData.api_keys.length > 0 && (
                <div className="space-y-2">
                  {apiKeysData.api_keys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between bg-dark-900/50 border border-white/[0.04] rounded-xl px-4 py-3">
                      <div>
                        <span className="text-sm font-mono text-gray-400">{k.key_prefix}...</span>
                        <span className="text-xs text-gray-500 ml-2">{k.name}</span>
                      </div>
                      <button onClick={() => revokeKey.mutate(k.id)}
                        className="text-negative hover:text-red-300 p-1"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Account Info */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Card className="p-6">
              <h2 className="font-heading font-bold text-lg mb-4">Account</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Email</span><span>{user?.email}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Plan</span><span className="font-semibold capitalize text-accent">{user?.plan}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Bot Active</span><span>{user?.bot_active ? "Yes" : "No"}</span></div>
              </div>
            </Card>
          </motion.div>
        </div>
      </PageTransition>
    </div>
  );
}
