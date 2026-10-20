import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api, setUnauthorizedHandler } from './api';
import type { DashboardUser } from './types';
import { stopAlert } from './sound';
import { AppState } from 'react-native';

interface AuthValue {
  user: DashboardUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const expire = useCallback(() => {
    setUser(null);
    client.clear();
    void stopAlert();
  }, [client]);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUser(await api.me());
    } catch (cause) {
      expire();
      if (!(cause instanceof ApiError && cause.status === 401)) {
        setError(cause instanceof Error ? cause.message : 'تعذر التحقق من الجلسة');
      }
    } finally {
      setLoading(false);
    }
  }, [expire]);

  useEffect(() => {
    setUnauthorizedHandler(expire);
    void refreshSession();
    return () => setUnauthorizedHandler(null);
  }, [expire, refreshSession]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const revalidate = async () => {
      try {
        const actor = await api.me();
        if (active) {
          setUser(actor);
          setError(null);
        }
      } catch (cause) {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) expire();
        else setError(cause instanceof Error ? cause.message : 'تعذر تجديد الجلسة');
      }
    };
    const interval = setInterval(() => { void revalidate(); }, 60000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void revalidate();
    });
    return () => { active = false; clearInterval(interval); subscription.remove(); };
  }, [user?.id, expire]);

  const login = async (username: string, password: string) => {
    if (!username.trim() || !password) throw new Error('أدخل اسم المستخدم وكلمة المرور');
    setError(null);
    try {
      const actor = await api.login(username.trim(), password);
      // Do not copy the password or httpOnly cookie into AsyncStorage.
      client.clear();
      setUser(actor);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'تعذر تسجيل الدخول';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    // A failed logout must not falsely claim to have revoked the server cookie.
    await api.logout();
    expire();
  };

  return <AuthContext.Provider value={{ user, loading, error, login, logout, refreshSession }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider غير متاح');
  return value;
}
