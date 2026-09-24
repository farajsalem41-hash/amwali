import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  isAdmin: boolean;
  adminRole?: string;
  isOwner?: boolean;
  role?: string;
}

export interface SessionMerchant {
  id: string;
  businessName: string;
  accountType: 'store' | 'company' | 'freelancer' | 'online_seller';
  logoFileId?: string | null;
  features: string[];
}

interface AuthState {
  user: SessionUser | null;
  merchant: SessionMerchant | null;
  permissions: string[];
  loading: boolean;
  login: (token: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: (...perms: string[]) => boolean;
  hasFeature: (feature: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [merchant, setMerchant] = useState<SessionMerchant | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setMerchant(null);
      setPermissions([]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(
        data.user
          ? { ...data.user, isOwner: data.isOwner ?? data.user.isOwner, adminRole: data.adminRole ?? data.user.adminRole }
          : null
      );
      setMerchant(data.merchant || null);
      setPermissions(data.permissions || []);
    } catch {
      setToken(null);
      setUser(null);
      setMerchant(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      merchant,
      permissions,
      loading,
      login: async (token: string, remember = true) => {
        setToken(token, remember);
        setLoading(true);
        await load();
      },
      logout: () => {
        setToken(null);
        setUser(null);
        setMerchant(null);
        setPermissions([]);
      },
      refresh: load,
      can: (...perms: string[]) => {
        if (!user) return false;
        if (user.isAdmin || user.isOwner) return true;
        return perms.some((p) => permissions.includes(p));
      },
      hasFeature: (feature: string) => !!merchant?.features?.includes(feature),
    }),
    [user, merchant, permissions, loading, load]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
