'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
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
  /** Sign in with email and password (for test accounts) */
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
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
  // IMPORTANT: Always use the same initial state on server and client to avoid hydration mismatch
  // Cached state will be restored in useEffect after mount
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    isAdmin: false,
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
  // Track when we last signed in to ignore spurious SIGNED_OUT events
  const lastSignInTimeRef = useRef<number>(0);

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
  // Uses onAuthStateChange's INITIAL_SESSION event as the primary init mechanism
  useEffect(() => {
    let isMounted = true;

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event);

      // Handle INITIAL_SESSION - this fires immediately with cached session
      // This is the most reliable event for initial auth state
      if (event === 'INITIAL_SESSION') {
        hasReceivedInitialSessionRef.current = true;

        // Skip if already initialized (happens in React 18 Strict Mode)
        if (hasInitializedRef.current) {
          console.log('[Auth] INITIAL_SESSION skipped - already initialized');
          return;
        }

        if (session?.user) {
          console.log('[Auth] INITIAL_SESSION with user, fetching profile...');
          const profile = await fetchProfileWithTimeout(supabase, session.user.id);
          // Double-check we haven't been initialized while fetching
          if (isMounted && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            lastSignInTimeRef.current = Date.now(); // Set AFTER successful init
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
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // If INITIAL_SESSION hasn't fired yet, wait for it instead
        // SIGNED_IN before INITIAL_SESSION means cookies might not be ready
        if (!hasReceivedInitialSessionRef.current) {
          console.log('[Auth] SIGNED_IN received before INITIAL_SESSION, deferring to INITIAL_SESSION');
          return;
        }

        // Only skip if we already initialized WITH A USER (avoid duplicate on initial load)
        // But DO process if we initialized with no user (user just signed in fresh)
        // lastSignInTimeRef > 0 means we've successfully set up a user session before
        if (hasInitializedRef.current && lastSignInTimeRef.current > 0) {
          console.log('[Auth] Already initialized with a user, skipping duplicate SIGNED_IN');
          return;
        }

        console.log('[Auth] SIGNED_IN event, fetching profile...');
        const profile = await fetchProfileWithTimeout(supabase, session.user.id);
        if (isMounted) {
          hasInitializedRef.current = true;
          lastSignInTimeRef.current = Date.now(); // Set AFTER successful init
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
        // Ignore SIGNED_OUT if we already have a valid session initialized
        // This handles race conditions where session validation triggers spurious sign-outs
        const timeSinceSignIn = Date.now() - lastSignInTimeRef.current;
        console.log('[Auth] SIGNED_OUT event, timeSinceSignIn:', timeSinceSignIn, 'hasInitialized:', hasInitializedRef.current);

        // If we've initialized with a user session within the last 30 seconds, ignore this
        // The profile fetch can take up to 10s to timeout, so we need a longer window
        if (timeSinceSignIn < 30000 && lastSignInTimeRef.current > 0 && hasInitializedRef.current) {
          console.log('[Auth] Ignoring spurious SIGNED_OUT event (within 30s of sign-in with active session)');
          return;
        }

        if (isMounted) {
          console.log('[Auth] Processing SIGNED_OUT event - clearing state');
          hasInitializedRef.current = false;
          lastSignInTimeRef.current = 0;
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

  // Sign in with password (for test accounts)
  const signInWithPassword = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ error: AuthError | null }> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        return { error };
      } catch (err) {
        return {
          error: {
            message: err instanceof Error ? err.message : 'Sign in failed',
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

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const value: AuthContextValue = useMemo(
    () => ({
      ...state,
      signInWithEmail,
      verifyOtp,
      signInWithPassword,
      signOut,
      refreshProfile,
    }),
    [state, signInWithEmail, verifyOtp, signInWithPassword, signOut, refreshProfile]
  );

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
