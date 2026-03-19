import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ensureMenuIdentity, getAuthApi } from '@/integration/runtime';

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

interface AuthState {
  isLoggedIn: boolean;
  user: AuthUser | null;
  actorId: string;
  displayName: string;
  login: (username: string, pin?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function readAuthState() {
  const authApi = getAuthApi();
  const isLoggedIn = !!authApi?.isLoggedIn?.();
  const user = authApi?.getUser?.() || authApi?.getCurrentUser?.() || null;
  const partyIdentity = authApi?.getPartyIdentity?.() || authApi?.getSocketIdentity?.() || authApi?.enablePublicMode?.() || null;
  return {
    isLoggedIn,
    user: user
      ? {
          id: String(user.id || user.userId || partyIdentity?.id || ''),
          username: String(user.username || user.displayName || partyIdentity?.username || ''),
          displayName: String(user.displayName || user.username || partyIdentity?.displayName || ''),
        }
      : null,
    actorId: String((partyIdentity && (partyIdentity.id || partyIdentity.userId)) || (user && user.id) || ''),
    displayName: String((partyIdentity && (partyIdentity.displayName || partyIdentity.username)) || (user && (user.displayName || user.username)) || 'GUEST'),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [snapshot, setSnapshot] = useState(readAuthState);

  const sync = useCallback(() => {
    setSnapshot(readAuthState());
  }, []);

  useEffect(() => {
    ensureMenuIdentity().finally(sync);
    window.addEventListener('mayhem-auth-changed', sync);
    return () => window.removeEventListener('mayhem-auth-changed', sync);
  }, [sync]);

  const login = useCallback(async (username: string, pin = '') => {
    const authApi = getAuthApi();
    if (!authApi?.login) return { ok: false, error: 'Login unavailable.' };
    try {
      await authApi.login(username, pin);
      sync();
      return { ok: true };
    } catch (error) {
      sync();
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Login failed.',
      };
    }
  }, [sync]);

  const logout = useCallback(async () => {
    const authApi = getAuthApi();
    if (authApi?.logout) {
      try {
        await authApi.logout();
      } catch {
        // no-op
      }
    }
    sync();
  }, [sync]);

  const value = useMemo<AuthState>(() => ({
    isLoggedIn: snapshot.isLoggedIn,
    user: snapshot.user,
    actorId: snapshot.actorId,
    displayName: snapshot.displayName,
    login,
    logout,
  }), [snapshot, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
