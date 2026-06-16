import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AppNavbar } from "../components/Navbar";
import { Card } from "../components/ui/Card";
import { WalletIcon, KeyIcon, ShieldIcon, SettingsIcon, ChartIcon, CheckIcon } from "../components/Icons";
import { PageTransition } from "../components/PageTransition";
import WalletConnect from "../components/WalletConnect";
import type { BotMode, TradeType, WhitelistEntry } from "../types";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [keysSaved, setKeysSaved] = useState(false);
  const [maxPos, setMaxPos] = useState(user?.max_position_usdt || 500);
  const [withdrawalDelay, setWithdrawalDelay] = useState(24);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newNetwork, setNewNetwork] = useState("ERC20");
  const [newLabel, setNewLabel] = useState("");

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
            <p className="text-gray-400 text-sm">Configure your bot and MEXC connection</p>
          </div>

          {/* MEXC API Keys */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <KeyIcon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-lg">MEXC API Keys</h2>
                    <p className="text-gray-400 text-sm">Connect your MEXC exchange account</p>
                  </div>
                </div>
                {user?.has_mexc_keys && <span className="flex items-center gap-1 text-accent text-sm font-semibold"><CheckIcon className="w-4 h-4" /> Connected</span>}
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
                <p>Keys are encrypted at rest using AES-256</p>
                <p>Enable <strong>Spot & Margin Trading</strong> and <strong>Read-only</strong> permissions on MEXC</p>
              </div>

              <button onClick={() => saveKeys.mutate()} disabled={!apiKey || !apiSecret || saveKeys.isPending}
                className="bg-accent hover:bg-accent-dark text-dark-900 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-40"
              >
                {saveKeys.isPending ? "Saving..." : keysSaved ? "Keys Saved!" : "Save Keys"}
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
                <label className="block text-sm font-medium text-gray-300 mb-1.5">New Address Withdrawal Delay (hours)</label>
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
                  <span className="text-sm font-medium text-gray-300">Whitelisted Addresses</span>
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
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-300">{entry.address.slice(0, 10)}...{entry.address.slice(-6)}</td>
                            <td className="px-3 py-2.5 text-gray-300">{entry.network}</td>
                            <td className="px-3 py-2.5 text-gray-300">{entry.label || "—"}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-semibold ${entry.is_approved ? "text-green-400" : "text-yellow-400"}`}>
                                {entry.is_approved ? "Approved" : "Pending"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button onClick={() => deleteWhitelistMutation.mutate(entry.id)} disabled={deleteWhitelistMutation.isPending}
                                className="text-xs text-red-400 hover:text-red-300"
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
                        ? m === "live" ? "bg-green-500/20 border-green-500 text-green-400" : "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                        : "bg-dark-800 border-white/10 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {m === "live" ? "Live" : "Paper"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                {user?.mode === "live" ? "Live mode places REAL orders on MEXC. Tread carefully." : "Paper mode simulates trades with virtual balance. Safe to test."}
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
                        ? "bg-blue-accent/20 border-blue-accent text-blue-400"
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
            </Card>
          </motion.div>

          {/* Account Info */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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
