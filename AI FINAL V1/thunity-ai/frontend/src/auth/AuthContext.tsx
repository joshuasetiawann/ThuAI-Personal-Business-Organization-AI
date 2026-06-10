import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore } from "../api/client";
import type { User } from "../types";

interface AuthCtx {
  user: User | null; loading: boolean;
  login: (u: string, p: string) => Promise<void>; logout: () => void;
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return; }
    api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauth = () => setUser(null);
    window.addEventListener("thunity:unauthorized", onUnauth);
    return () => window.removeEventListener("thunity:unauthorized", onUnauth);
  }, []);

  const login = async (u: string, p: string) => {
    const r = await api.login(u, p);
    tokenStore.set(r.access_token);
    setUser({ username: r.username, role: r.role, permissions: r.permissions });
  };
  const logout = () => { tokenStore.clear(); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
