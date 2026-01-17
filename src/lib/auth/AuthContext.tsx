'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  /** Send a magic code to the user's email */
  signInWithEmail: (email: string) => Promise<{ error: AuthError | null }>;
  /** Verify the OTP code sent to email */
  verifyOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  /** Sign out the current user */
  signOut: () => Promise<void>;
  /** Refresh the user's profile from the database */
  refreshProfile: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

// Key for localStorage
const AUTH_CACHE_KEY = 'nihontowatch_auth_cache';

// Helper to safely access localStorage
function getAuthCache(): Partial<AuthState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Only use cache if it's less than 1 hour old
      if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
        return parsed.state;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

function setAuthCache(state: AuthState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
      state: {
        isAdmin: state.isAdmin,
        profile: state.profile,
        // Don't cache sensitive session data
      },
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore localStorage errors
  }
}

function clearAuthCache() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Restore cached state immediately to prevent flash
  const cachedState = getAuthCache();

  const [state, setState] = useState<AuthState>({
    user: null,
    profile: cachedState?.profile || null,
    session: null,
    isLoading: true,
    isAdmin: cachedState?.isAdmin || false,
  });

  const supabase = createClient();

  // Fetch profile from database
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      console.log('[Auth] Fetching profile for user:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Auth] Error fetching profile:', error);
        return null;
      }

      console.log('[Auth] Profile fetched:', data);
      const profile = data as Profile | null;
      console.log('[Auth] Profile role:', profile?.role, 'isAdmin:', profile?.role === 'admin');
      return profile;
    },
    [supabase]
  );

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    const profile = await fetchProfile(state.user.id);
    setState((prev) => ({
      ...prev,
      profile,
      isAdmin: profile?.role === 'admin',
    }));
  }, [state.user, fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      console.log('[Auth] initAuth starting...');
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log('[Auth] getSession result:', { hasSession: !!session, hasUser: !!session?.user });

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          console.log('[Auth] Setting state with profile, isAdmin:', profile?.role === 'admin');
          if (isMounted) {
            const newState = {
              user: session.user,
              profile,
              session,
              isLoading: false,
              isAdmin: profile?.role === 'admin',
            };
            setState(newState);
            setAuthCache(newState);
            console.log('[Auth] State updated successfully');
          }
        } else {
          console.log('[Auth] No session, setting logged out state');
          if (isMounted) {
            setState({
              user: null,
              profile: null,
              session: null,
              isLoading: false,
              isAdmin: false,
            });
            clearAuthCache();
          }
        }
      } catch (error) {
        console.error('[Auth] Error initializing auth:', error);
        if (isMounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event);
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        const newState = {
          user: session.user,
          profile,
          session,
          isLoading: false,
          isAdmin: profile?.role === 'admin',
        };
        if (isMounted) {
          setState(newState);
          setAuthCache(newState);
          console.log('[Auth] State updated from SIGNED_IN event');
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            isAdmin: false,
          });
          clearAuthCache();
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            session,
            user: session.user,
          }));
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Sign in with email (sends magic code)
  const signInWithEmail = useCallback(
    async (email: string): Promise<{ error: AuthError | null }> => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });
      return { error };
    },
    [supabase]
  );

  // Verify OTP code sent to email
  const verifyOtp = useCallback(
    async (
      email: string,
      token: string
    ): Promise<{ error: AuthError | null }> => {
      try {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: token.trim(),
          type: 'email',
        });
        return { error };
      } catch (err) {
        return {
          error: {
            message: err instanceof Error ? err.message : 'Verification failed',
            status: 500,
          } as AuthError,
        };
      }
    },
    [supabase]
  );

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isAdmin: false,
    });
    clearAuthCache();
  }, [supabase]);

  const value: AuthContextValue = {
    ...state,
    signInWithEmail,
    verifyOtp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
