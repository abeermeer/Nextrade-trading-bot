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
  settings: () => request<Record<string, unknown>>("/api/settings"),

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
  updateMexcKeys: (api_key: string, api_secret: string) =>
    request<{ success: boolean }>("/api/user/mexc-keys", {
      method: "PUT",
      body: JSON.stringify({ api_key, api_secret }),
    }),
  getMexcKeys: () => request<import("../types").MexcKeys>("/api/user/mexc-keys"),
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
  botStatus: () => request<import("../types").BotControlStatus>("/api/user/bot/status"),

  // Admin
  adminUsers: () => request<import("../types").AdminUser[]>("/api/user/admin/users"),
};
