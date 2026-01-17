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

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    isAdmin: false,
  });

  const supabase = createClient();

  // Fetch profile from database
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data;
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
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({
            user: session.user,
            profile,
            session,
            isLoading: false,
            isAdmin: profile?.role === 'admin',
          });
        } else {
          setState({
            user: null,
            profile: null,
            session: null,
            isLoading: false,
            isAdmin: false,
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: session.user,
          profile,
          session,
          isLoading: false,
          isAdmin: profile?.role === 'admin',
        });
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          isAdmin: false,
        });
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setState((prev) => ({
          ...prev,
          session,
          user: session.user,
        }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Sign in with email (sends magic code)
  const signInWithEmail = useCallback(
    async (email: string): Promise<{ error: AuthError | null }> => {
      console.log('[Auth] signInWithEmail called with:', email);
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
          },
        });
        console.log('[Auth] signInWithOtp returned, error:', error);
        return { error };
      } catch (err) {
        console.error('[Auth] signInWithEmail caught error:', err);
        throw err;
      }
    },
    [supabase]
  );

  // Verify OTP - uses direct API call to avoid Supabase client library issues
  const verifyOtp = useCallback(
    async (
      email: string,
      token: string
    ): Promise<{ error: AuthError | null }> => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanToken = token.trim();

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      console.log('[Auth] verifyOtp called with email:', cleanEmail, 'token length:', cleanToken.length);

      try {
        console.log('[Auth] Making fetch request to:', `${supabaseUrl}/auth/v1/verify`);
        const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey || '',
          },
          body: JSON.stringify({
            email: cleanEmail,
            token: cleanToken,
            type: 'email',
          }),
        });

        console.log('[Auth] Fetch response status:', response.status);
        const data = await response.json();
        console.log('[Auth] Response data:', { hasAccessToken: !!data.access_token, error: data.error || data.error_description });

        if (!response.ok) {
          console.log('[Auth] Response not OK, returning error');
          return {
            error: {
              message: data.error_description || data.msg || data.error || 'Verification failed',
              status: response.status,
            } as AuthError,
          };
        }

        // If successful, we need to set the session
        if (data.access_token) {
          console.log('[Auth] Setting session with access token');
          await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          console.log('[Auth] Session set successfully');
        } else {
          console.log('[Auth] No access_token in response');
        }

        console.log('[Auth] verifyOtp returning success');
        return { error: null };
      } catch (err) {
        console.error('[Auth] verifyOtp caught error:', err);
        return {
          error: {
            message: err instanceof Error ? err.message : 'Network error',
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
