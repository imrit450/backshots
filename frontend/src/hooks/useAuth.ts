import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

interface Host {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  canCreateEvents: boolean;
  plan: string;
}

export function useAuth() {
  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  // Track which token the initial getMe() was issued for, so a stale
  // response can't wipe a newer token that arrived via login/signup.
  const checkedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const token = api.getHostToken();
    checkedTokenRef.current = token;

    if (token) {
      api
        .getMe()
        .then((data) => {
          if (mountedRef.current) setHost(data.host);
        })
        .catch(() => {
          // Only clear auth if the token hasn't changed since we fired getMe().
          // This prevents the race condition where:
          //   1. stale token → getMe() fires
          //   2. user logs in → new token is set
          //   3. stale getMe() fails → must NOT clear the new token
          if (mountedRef.current && api.getHostToken() === checkedTokenRef.current) {
            api.logout();
            setHost(null);
          }
        })
        .finally(() => {
          if (mountedRef.current) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    setHost(data.host);
    return data;
  }, []);

  const signup = useCallback(
    async (email: string, password: string, displayName: string) => {
      const data = await api.signup(email, password, displayName);
      setHost(data.host);
      return data;
    },
    []
  );

  const logout = useCallback(() => {
    api.logout();
    setHost(null);
  }, []);

  const isAdmin = host?.role === 'admin';
  const canCreateEvents = isAdmin || !!host?.canCreateEvents;

  return { host, loading, login, signup, logout, isAuthenticated: !!host, isAdmin, canCreateEvents };
}
