import React from 'react';
import { apiRequest } from '@/lib/queryClient';

type User = { 
  username: string; 
  displayName?: string | null; 
  email?: string | null;
  role?: string;
  permissions?: string[];
} | null;

type AuthContextValue = {
  user: User;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<User>;
  hasPermission: (permission: string) => boolean;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async (): Promise<User> => {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (!res.ok) {
        setUser(null);
        setLoading(false);
        return null;
      }
      const json = await res.json();
      setUser(json.user ?? null);
      setLoading(false);
      return json.user ?? null;
    } catch (e) {
      setUser(null);
      setLoading(false);
      return null;
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const login = React.useCallback(async (username: string, password: string) => {
    try {
      const res = await apiRequest('POST', '/api/login', { username, password });
      const data = await res.json();
      const userData = data.user ?? null;
      setUser(userData);
      setLoading(false);
      // Force a refresh to ensure permissions are loaded
      if (userData) {
        await refresh();
      }
      return userData;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  }, [refresh]);

  const logout = React.useCallback(async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {}
    setUser(null);
  }, []);

  const hasPermission = React.useCallback((permission: string) => {
    if (!user) return false;
    // Admin role should have all permissions
    if (user.role === 'admin') return true;
    return user.permissions?.includes(permission) || false;
  }, [user]);

  const value: AuthContextValue = React.useMemo(() => ({ user, loading, login, logout, refresh, hasPermission }), [user, loading, login, logout, refresh, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = React.useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}

export default AuthContext;
