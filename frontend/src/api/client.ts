const BASE_URL = import.meta.env.VITE_API_URL || "https://mexc-trading-bot-production-c215.up.railway.app";

let _token: string | null = localStorage.getItem("token");

export function setToken(token: string | null) {
  _token = token;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export function getToken(): string | null {
  return _token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  if (res.status === 429) {
    window.dispatchEvent(new CustomEvent("rate-limited", { detail: "Rate limit exceeded. Please wait a moment." }));
    throw new Error("Rate limit exceeded");
  }
  if (res.status === 401) {
    setToken(null);
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  status: () => request<import("../types").BotStatus>("/api/status"),
  signals: (limit = 50) => request<import("../types").Signal[]>(`/api/signals?limit=${limit}`),
  positions: () => request<import("../types").Position[]>("/api/positions"),
  trades: () => request<import("../types").Trade[]>("/api/trades"),
  performance: () => request<import("../types").PerformanceData>("/api/performance"),
  botLogs: () => request<import("../types").BotLogEntry[]>("/api/logs"),
  settings: () => request<Record<string, unknown>>("/api/settings"),
  stats: () => request<import("../types").SiteStats>("/api/stats"),

  // Auth
  register: (email: string, password: string, plan = "basic") =>
    request<import("../types").AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, plan }),
    }),
  login: (email: string, password: string) =>
    request<import("../types").AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<import("../types").UserProfile>("/api/auth/me"),

  // User settings
  updateExchangeKeys: (api_key: string, api_secret: string, exchange: string = "mexc") =>
    request<import("../types").ExchangeKeysSaveResponse>("/api/user/exchange-keys", {
      method: "PUT",
      body: JSON.stringify({ api_key, api_secret, exchange }),
    }),

  updateSettings: (data: import("../types").UserSettings) =>
    request<{ success: boolean; mode: string; trade_type: string }>("/api/user/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  controlBot: (action: "start" | "stop") =>
    request<{ success: boolean; bot_active: boolean }>("/api/user/bot", {
      method: "POST",
      body: JSON.stringify({ action }),
    }),
  resetDemo: () =>
    request<{ success: boolean; trades_deleted: number; positions_deleted: number; signals_deleted: number }>(
      "/api/user/reset-demo",
      { method: "POST" }
    ),
  liveBalance: () =>
    request<{ connected: boolean; exchange: string; market?: string; free?: number; total?: number; balance: number; currency: string; detail?: string }>(
      "/api/user/balance"
    ),
  botStatus: () => request<import("../types").BotControlStatus>("/api/user/bot/status"),

  // Email
  verifyEmail: (token: string) =>
    request<{ detail: string }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`),
  forgotPassword: (email: string) =>
    request<{ detail: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, new_password: string) =>
    request<{ detail: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password }),
    }),

  // Wallet
  walletNonce: (address: string, wallet_type: string) =>
    request<{ nonce: string; message: string }>("/api/auth/wallet-nonce", {
      method: "POST",
      body: JSON.stringify({ address, wallet_type }),
    }),
  walletLogin: (address: string, signature: string, message: string, wallet_type: string) =>
    request<import("../types").AuthResponse>("/api/auth/wallet-login", {
      method: "POST",
      body: JSON.stringify({ address, signature, message, wallet_type }),
    }),
  walletLink: (email: string, password: string, address: string, signature: string, message: string, wallet_type: string) =>
    request<import("../types").AuthResponse>("/api/auth/wallet-link", {
      method: "POST",
      body: JSON.stringify({ email, password, address, signature, message, wallet_type }),
    }),
  saveWallet: (data: { address: string; signature: string; message: string; wallet_type: string }) =>
    request<{ success: boolean; wallet_address: string; wallet_type: string }>("/api/user/wallet", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getWallet: () => request<import("../types").WalletInfo>("/api/user/wallet"),
  deleteWallet: () => request<{ success: boolean }>("/api/user/wallet", { method: "DELETE" }),

  // Withdrawal Protection
  getWhitelist: () => request<import("../types").WhitelistEntry[]>("/api/withdrawal/whitelist"),
  addWhitelist: (data: { address: string; network: string; label: string }) =>
    request<import("../types").WhitelistEntry>("/api/withdrawal/whitelist", { method: "POST", body: JSON.stringify(data) }),
  deleteWhitelist: (id: number) =>
    request<{ success: boolean }>(`/api/withdrawal/whitelist/${id}`, { method: "DELETE" }),
  getWithdrawalSettings: () =>
    request<{ withdrawal_delay_hours: number }>("/api/withdrawal/settings"),
  updateWithdrawalSettings: (data: { withdrawal_delay_hours: number }) =>
    request<{ success: boolean }>("/api/withdrawal/settings", { method: "PUT", body: JSON.stringify(data) }),
  adminPendingApprovals: () =>
    request<import("../types").AdminPendingApproval[]>("/api/withdrawal/admin/pending-approvals"),
  adminApproveWhitelist: (id: number) =>
    request<{ success: boolean }>(`/api/withdrawal/admin/approve/${id}`, { method: "POST" }),

  // Admin
  adminUsers: () => request<import("../types").AdminUser[]>("/api/user/admin/users"),
  adminAnalytics: () => request<{
    total_users: number; monthly_users: number; active_bots: number;
    total_trades: number; total_pnl: number;
    plan_breakdown: { basic: number; pro: number; enterprise: number };
    user_growth: { month: string; new_users: number }[];
  }>("/api/admin/analytics"),

  // Strategy performance
  strategyPerformance: () => request<Record<string, { signals: number; wins: number; losses: number; total_pnl: number; win_rate: number; avg_confidence: number }>>("/api/strategy-performance"),

  // Portfolio
  portfolio: () => request<import("../types").PortfolioStats>("/api/portfolio"),

  // CSV export
  exportTradesCsv: async () => {
    const res = await fetch(`${BASE_URL}/api/trades/export?token=${getToken()}`);
    return res.blob();
  },
  exportPositionsCsv: async () => {
    const res = await fetch(`${BASE_URL}/api/positions/export?token=${getToken()}`);
    return res.blob();
  },

  // Backtesting
  runBacktest: (params: { pair: string; strategy: string; days: number }) =>
    request<import("../types").BacktestResult>("/api/backtest", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  // GDPR
  exportUserData: () => request<unknown>("/api/user/data-export"),
  deleteUserData: () => request<{ detail: string }>("/api/user/data-delete", { method: "DELETE" }),

  // Strategy config
  getStrategyConfig: () => request<{ strategy_settings: Record<string, unknown> }>("/api/user/strategy-config"),
  updateStrategyConfig: (data: { strategy_settings: Record<string, unknown> }) =>
    request<{ success: boolean }>("/api/user/strategy-config", { method: "PUT", body: JSON.stringify(data) }),

  // Notification prefs
  getNotificationPrefs: () => request<{ notification_prefs: import("../types").NotificationPrefs }>("/api/user/notification-prefs"),
  updateNotificationPrefs: (data: { notification_prefs: import("../types").NotificationPrefs }) =>
    request<{ success: boolean }>("/api/user/notification-prefs", { method: "PUT", body: JSON.stringify(data) }),

  // Custom pairs
  getSelectedPairs: () => request<{ selected_pairs: string[] }>("/api/user/selected-pairs"),
  updateSelectedPairs: (data: { selected_pairs: string[] }) =>
    request<{ success: boolean; selected_pairs: string[] }>("/api/user/selected-pairs", { method: "PUT", body: JSON.stringify(data) }),

  // User API keys
  createApiKey: (name: string) =>
    request<{ success: boolean; api_key: string; key_prefix: string; name: string }>("/api/user/api-keys", { method: "POST", body: JSON.stringify({ name }) }),
  listApiKeys: () => request<{ api_keys: import("../types").UserApiKey[] }>("/api/user/api-keys"),
  revokeApiKey: (keyId: number) =>
    request<{ success: boolean }>(`/api/user/api-keys/${keyId}`, { method: "DELETE" }),

  // Strategy scores
  strategyScores: () => request<import("../types").StrategyScores>("/api/user/strategy-scores"),

  // Trial
  trialStatus: () => request<{ trial_end: string | null; is_expired: boolean; remaining_days: number; plan: string }>("/api/user/trial-status"),

  // Usage
  usageStats: () => request<{ api_calls: number; bot_hours: number; trade_volume: number }>("/api/user/usage"),

  // Stripe
  createCheckoutSession: (plan: string) =>
    request<{ url: string; session_id: string }>("/api/subscribe/create-checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
  getPortalUrl: () => request<{ url: string }>("/api/subscribe/portal"),
  currentSubscription: () => request<{ plan: string; has_stripe_id: boolean }>("/api/subscribe/current"),
};
