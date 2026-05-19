import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  setAuthTokenGetter,
  login as apiLogin,
  logout as apiLogout,
  getMe,
} from "@workspace/api-client-react";
import { AuthContext, type AuthUser } from "./auth-context";

export { useAuth, type AuthUser, type AuthContextValue } from "./auth-context";

const TOKEN_KEY = "cw_token";

let currentToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;

setAuthTokenGetter(() => currentToken);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentToken) {
        setLoading(false);
        return;
      }
      try {
        const me = (await getMe()) as AuthUser;
        if (!cancelled) setUser(me);
      } catch {
        currentToken = null;
        window.localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = (await apiLogin({ email, password })) as { token: string; user: AuthUser };
    if (res.user.role !== "company") {
      throw new Error("Esta aplicación es solo para empresas.");
    }
    currentToken = res.token;
    window.localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    currentToken = null;
    window.localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
