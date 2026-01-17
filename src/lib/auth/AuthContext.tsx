'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { User, Session, AuthError, SupabaseClient } from '@supabase/supabase-js';
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

// Profile fetch timeout (10 seconds)
const PROFILE_FETCH_TIMEOUT = 10000;

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

// Fetch profile with timeout protection
async function fetchProfileWithTimeout(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Profile | null> {
  console.log('[Auth] Fetching profile for user:', userId);

  // Create timeout promise
  const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
    setTimeout(() => {
      console.error('[Auth] Profile fetch timed out after', PROFILE_FETCH_TIMEOUT, 'ms');
      resolve({ data: null, error: { message: 'Profile fetch timed out' } });
    }, PROFILE_FETCH_TIMEOUT);
  });

  // Race between fetch and timeout
  const fetchPromise = supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  try {
    const result = await Promise.race([fetchPromise, timeoutPromise]);

    if (result.error) {
      console.error('[Auth] Error fetching profile:', result.error);
      return null;
    }

    console.log('[Auth] Profile fetched:', result.data);
    const profile = result.data as Profile | null;
    console.log('[Auth] Profile role:', profile?.role, 'isAdmin:', profile?.role === 'admin');
    return profile;
  } catch (err) {
    console.error('[Auth] Unexpected error fetching profile:', err);
    return null;
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

  // Use ref to store supabase client to avoid recreating on each render
  const supabaseRef = useRef<SupabaseClient<Database> | null>(null);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  // Track if we've already initialized to prevent double-init from INITIAL_SESSION + initAuth
  const hasInitializedRef = useRef(false);
  // Track if INITIAL_SESSION has fired - SIGNED_IN before INITIAL_SESSION means cookies aren't ready
  const hasReceivedInitialSessionRef = useRef(false);

  // Refresh profile (for manual refresh)
  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    const profile = await fetchProfileWithTimeout(supabase, state.user.id);
    setState((prev) => ({
      ...prev,
      profile,
      isAdmin: profile?.role === 'admin',
    }));
  }, [state.user, supabase]);

  // Initialize auth state - runs ONCE on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Skip if already initialized by onAuthStateChange
      if (hasInitializedRef.current) {
        console.log('[Auth] Already initialized, skipping initAuth');
        return;
      }

      console.log('[Auth] initAuth starting...');
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log('[Auth] getSession result:', { hasSession: !!session, hasUser: !!session?.user });

        // Check again in case onAuthStateChange fired while we were waiting
        if (hasInitializedRef.current) {
          console.log('[Auth] Initialized during getSession, skipping state update');
          return;
        }

        if (session?.user) {
          const profile = await fetchProfileWithTimeout(supabase, session.user.id);
          console.log('[Auth] Setting state with profile, isAdmin:', profile?.role === 'admin');
          if (isMounted && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            const newState = {
              user: session.user,
              profile,
              session,
              isLoading: false,
              isAdmin: profile?.role === 'admin',
            };
            setState(newState);
            setAuthCache(newState);
            console.log('[Auth] State updated successfully from initAuth');
          }
        } else {
          console.log('[Auth] No session, setting logged out state');
          if (isMounted && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
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
          hasInitializedRef.current = true;
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event);

      // Handle INITIAL_SESSION - this fires immediately with cached session
      // This is the most reliable event for initial auth state
      if (event === 'INITIAL_SESSION') {
        hasReceivedInitialSessionRef.current = true;
        if (session?.user) {
          console.log('[Auth] INITIAL_SESSION with user, fetching profile...');
          const profile = await fetchProfileWithTimeout(supabase, session.user.id);
          if (isMounted) {
            hasInitializedRef.current = true;
            const newState = {
              user: session.user,
              profile,
              session,
              isLoading: false,
              isAdmin: profile?.role === 'admin',
            };
            setState(newState);
            setAuthCache(newState);
            console.log('[Auth] State updated from INITIAL_SESSION');
          }
        } else {
          console.log('[Auth] INITIAL_SESSION with no user');
          if (isMounted) {
            hasInitializedRef.current = true;
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
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // If INITIAL_SESSION hasn't fired yet, wait for it instead
        // SIGNED_IN before INITIAL_SESSION means cookies might not be ready
        if (!hasReceivedInitialSessionRef.current) {
          console.log('[Auth] SIGNED_IN received before INITIAL_SESSION, deferring to INITIAL_SESSION');
          return;
        }

        // Only process if not already initialized (avoid duplicate processing)
        if (hasInitializedRef.current) {
          console.log('[Auth] Already initialized, skipping SIGNED_IN');
          return;
        }

        console.log('[Auth] SIGNED_IN event, fetching profile...');
        const profile = await fetchProfileWithTimeout(supabase, session.user.id);
        if (isMounted) {
          hasInitializedRef.current = true;
          const newState = {
            user: session.user,
            profile,
            session,
            isLoading: false,
            isAdmin: profile?.role === 'admin',
          };
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

    // Start initialization after setting up listener
    initAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

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
