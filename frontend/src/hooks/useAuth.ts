import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser, useClerk, useSession } from '@clerk/react';
import { api } from '../api/client';

interface Host {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  canCreateEvents: boolean;
  plan: string;
}

/**
 * Unified auth hook.
 *
 * Clerk owns sign-in / sign-up / sign-out.
 * Once Clerk confirms a signed-in session we exchange the Clerk JWT for a
 * Lumora backend JWT via POST /v1/auth/host/clerk, then load the full
 * Host profile.  All host-API calls keep using the existing bearer-token
 * system in ApiClient — the only difference is the token now comes from
 * Clerk instead of a local password flow.
 */
export function useAuth() {
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();
  const clerk = useClerk();

  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionId = session?.id;
  // Keep a ref so the async effect can always call getToken() on the latest
  // session object without including `session` in the dependency array.
  // Including `session` would cause the effect to re-run on every internal
  // Clerk token refresh (Clerk mutates the session reference each time),
  // flooding the backend with repeated /v1/auth/host/clerk exchange calls.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!userLoaded) return;

    if (!isSignedIn || !sessionId) {
      // Clerk says "not signed in" — clear any stale backend token.
      api.setHostToken(null);
      setHost(null);
      setLoading(false);
      return;
    }

    // We have a live Clerk session — exchange it for a Lumora JWT.
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // getToken() returns a short-lived JWT signed by Clerk.
        const clerkToken = await sessionRef.current?.getToken();
        if (!clerkToken) throw new Error('No Clerk token');

        // Exchange for a Lumora backend JWT.
        const data = await api.clerkExchange(clerkToken);
        if (!cancelled) {
          api.setHostToken(data.token);
          setHost(data.host);
        }
      } catch {
        if (!cancelled) {
          api.setHostToken(null);
          setHost(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoaded, isSignedIn, sessionId]);

  /** Programmatic sign-out — clears Clerk session and backend token. */
  const logout = useCallback(async () => {
    api.setHostToken(null);
    setHost(null);
    await clerk.signOut();
  }, [clerk]);

  /** Legacy stubs — login/signup are now handled by Clerk UI components. */
  const login = useCallback(async (_email: string, _password: string) => {
    throw new Error('Use the Clerk <SignIn> component to log in.');
  }, []);

  const signup = useCallback(
    async (_email: string, _password: string, _displayName: string) => {
      throw new Error('Use the Clerk <SignUp> component to sign up.');
    },
    []
  );

  const isAdmin = host?.role === 'admin';
  const canCreateEvents = isAdmin || !!host?.canCreateEvents;

  // Optimistic host derived from Clerk user while the backend profile loads.
  const clerkDisplayName =
    user?.fullName ??
    user?.firstName ??
    user?.emailAddresses[0]?.emailAddress ??
    '';

  const effectiveHost: Host | null = host ?? (isSignedIn && user
    ? {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? '',
      displayName: clerkDisplayName,
      role: 'user',
      canCreateEvents: false,
      plan: 'free',
    }
    : null);

  return {
    host: effectiveHost,
    loading: !userLoaded || loading,
    login,
    signup,
    logout,
    isAuthenticated: !!isSignedIn,
    isAdmin,
    canCreateEvents,
  };
}
