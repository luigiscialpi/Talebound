import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
  /** Supabase Session (contains access_token / refresh_token). null = unauthenticated. */
  session: Session | null;
  /** Convenience: current user extracted from session. */
  user: User | null;
  /** True while the initial session is being restored from SecureStore. */
  loading: boolean;
}

interface AuthActions {
  /**
   * Sign in with email + password.
   * Returns an AuthError when credentials are invalid; null on success.
   */
  signIn: (email: string, password: string) => Promise<AuthError | null>;
  /**
   * Sign out the current user and clear the persisted session.
   * Returns an AuthError on failure; null on success.
   */
  signOut: () => Promise<AuthError | null>;
}

export type AuthContextValue = AuthState & AuthActions;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Wrap the app root with <AuthProvider> to make useAuth() available
 * throughout the component tree (doc §7).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore persisted session from SecureStore on first mount.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Keep session in sync with Supabase auth state changes
    // (e.g. auto token refresh, sign-out from another tab).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<AuthError | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  async function signOut(): Promise<AuthError | null> {
    const { error } = await supabase.auth.signOut();
    return error;
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access auth state and actions from any component inside <AuthProvider>.
 *
 * @example
 * const { session, signIn, signOut } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

/**
 * Returns the current Supabase access token (JWT) or null when unauthenticated.
 * Pass this as the Bearer token to backend API calls.
 */
export function useAccessToken(): string | null {
  const { session } = useAuth();
  return session?.access_token ?? null;
}
