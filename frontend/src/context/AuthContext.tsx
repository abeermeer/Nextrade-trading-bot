import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, setToken, getToken } from "../api/client";
import type { UserProfile } from "../types";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, plan?: string) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    api.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setUser({
      id: 0, email: res.email, is_admin: res.is_admin,
      plan: res.plan, mode: res.mode, trade_type: res.trade_type,
      bot_active: res.bot_active, max_position_usdt: 500, has_mexc_keys: false,
    });
  };

  const register = async (email: string, password: string, plan = "basic") => {
    const res = await api.register(email, password, plan);
    setToken(res.token);
    setUser({
      id: 0, email: res.email, is_admin: res.is_admin,
      plan: res.plan, mode: res.mode, trade_type: res.trade_type,
      bot_active: res.bot_active, max_position_usdt: 500, has_mexc_keys: false,
    });
  };

  const logout = () => { setToken(null); setUser(null); };

  const updateUser = (partial: Partial<UserProfile>) => {
    setUser(prev => prev ? { ...prev, ...partial } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
