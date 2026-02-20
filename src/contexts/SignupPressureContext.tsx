'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';

import type {
  SignupPressureContextValue,
  SignupPressurePersistedState,
  SignupTriggerContext,
} from '@/lib/signup/types';
import { SIGNUP_PRESSURE_CONFIG } from '@/lib/signup/config';
import {
  loadPersistedState,
  savePersistedState,
  getDefaultPersistedState,
  isOnCooldown,
  hasExceededMaxDismissals,
  checkThresholds,
  calculateTimeOnSite,
} from '@/lib/signup/storage';

// ============================================================================
// Context
// ============================================================================

const SignupPressureContext = createContext<SignupPressureContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface SignupPressureProviderProps {
  children: ReactNode;
  /** Override authenticated state (for testing or when auth state is known) */
  isAuthenticated?: boolean;
  /** Dynamic active dealer count from the database */
  dealerCount?: number;
}

export function SignupPressureProvider({
  children,
  isAuthenticated = false,
  dealerCount = 40,
}: SignupPressureProviderProps) {
  // Persisted state (survives page refreshes)
  const [persistedState, setPersistedState] = useState<SignupPressurePersistedState>(
    getDefaultPersistedState
  );

  // Runtime state (resets on page refresh)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [triggerContext, setTriggerContext] = useState<SignupTriggerContext | null>(null);
  const [timeOnSite, setTimeOnSite] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs for tracking
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const loaded = loadPersistedState();
    setPersistedState(loaded);
    setTimeOnSite(calculateTimeOnSite(loaded.sessionStartTime));
    setIsInitialized(true);
  }, []);

  // Save persisted state whenever it changes
  useEffect(() => {
    if (isInitialized) {
      savePersistedState(persistedState);
    }
  }, [persistedState, isInitialized]);

  // Time tracking interval
  useEffect(() => {
    if (isAuthenticated || persistedState.hasSignedUp) {
      return;
    }

    timeIntervalRef.current = setInterval(() => {
      setTimeOnSite(calculateTimeOnSite(persistedState.sessionStartTime));
    }, 1000);

    return () => {
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, [isAuthenticated, persistedState.hasSignedUp, persistedState.sessionStartTime]);

  // Check if we should auto-trigger based on engagement thresholds
  useEffect(() => {
    // Don't auto-trigger if:
    // - User is authenticated
    // - User has signed up
    // - Modal is already open
    // - On cooldown
    // - Max dismissals exceeded
    // - Not initialized yet
    if (
      isAuthenticated ||
      persistedState.hasSignedUp ||
      isModalOpen ||
      !isInitialized ||
      isOnCooldown(persistedState.lastDismissedAt) ||
      hasExceededMaxDismissals(persistedState.dismissCount)
    ) {
      return;
    }

    // Check if thresholds are met
    if (checkThresholds(persistedState.quickViewCount, timeOnSite)) {
      setTriggerContext('engagement');
      setIsModalOpen(true);
    }
  }, [
    isAuthenticated,
    persistedState.hasSignedUp,
    persistedState.quickViewCount,
    persistedState.lastDismissedAt,
    persistedState.dismissCount,
    timeOnSite,
    isModalOpen,
    isInitialized,
  ]);

  // Track quick view open
  const trackQuickView = useCallback(() => {
    if (isAuthenticated || persistedState.hasSignedUp) {
      return;
    }

    setPersistedState((prev) => ({
      ...prev,
      quickViewCount: prev.quickViewCount + 1,
    }));
  }, [isAuthenticated, persistedState.hasSignedUp]);

  // Trigger modal for specific action (favorite, alert, etc.)
  const triggerForAction = useCallback(
    (context: SignupTriggerContext): boolean => {
      // Don't trigger if authenticated or already signed up
      if (isAuthenticated || persistedState.hasSignedUp) {
        return false;
      }

      // Don't trigger if on cooldown or max dismissals exceeded
      if (
        isOnCooldown(persistedState.lastDismissedAt) ||
        hasExceededMaxDismissals(persistedState.dismissCount)
      ) {
        return false;
      }

      // Don't trigger if modal already open
      if (isModalOpen) {
        return false;
      }

      setTriggerContext(context);
      setIsModalOpen(true);
      return true;
    },
    [
      isAuthenticated,
      persistedState.hasSignedUp,
      persistedState.lastDismissedAt,
      persistedState.dismissCount,
      isModalOpen,
    ]
  );

  // Dismiss modal (starts cooldown)
  const dismissModal = useCallback(() => {
    setIsModalOpen(false);
    setTriggerContext(null);

    setPersistedState((prev) => ({
      ...prev,
      lastDismissedAt: Date.now(),
      dismissCount: prev.dismissCount + 1,
    }));
  }, []);

  // Close modal without cooldown (e.g., successful signup)
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setTriggerContext(null);
  }, []);

  // Mark user as signed up
  const markAsSignedUp = useCallback(() => {
    setIsModalOpen(false);
    setTriggerContext(null);

    setPersistedState((prev) => ({
      ...prev,
      hasSignedUp: true,
    }));
  }, []);

  // Add local favorite (pre-signup state preservation)
  const addLocalFavorite = useCallback((listingId: string) => {
    setPersistedState((prev) => {
      if (prev.localFavorites.includes(listingId)) {
        return prev;
      }
      return {
        ...prev,
        localFavorites: [...prev.localFavorites, listingId],
      };
    });
  }, []);

  // Get local favorites
  const getLocalFavorites = useCallback(() => {
    return persistedState.localFavorites;
  }, [persistedState.localFavorites]);

  // Reset session (for testing)
  const resetSession = useCallback(() => {
    const fresh = getDefaultPersistedState();
    setPersistedState(fresh);
    setTimeOnSite(0);
    setIsModalOpen(false);
    setTriggerContext(null);
  }, []);

  // Computed values
  const thresholdsMet = checkThresholds(persistedState.quickViewCount, timeOnSite);
  const onCooldown = isOnCooldown(persistedState.lastDismissedAt);

  // Memoize context value
  const value: SignupPressureContextValue = useMemo(
    () => ({
      // State
      isModalOpen,
      triggerContext,
      quickViewCount: persistedState.quickViewCount,
      timeOnSite,
      thresholdsMet,
      isOnCooldown: onCooldown,
      isAuthenticated,
      dealerCount,

      // Actions
      trackQuickView,
      triggerForAction,
      dismissModal,
      closeModal,
      markAsSignedUp,
      addLocalFavorite,
      getLocalFavorites,
      resetSession,
    }),
    [
      isModalOpen,
      triggerContext,
      persistedState.quickViewCount,
      timeOnSite,
      thresholdsMet,
      onCooldown,
      isAuthenticated,
      dealerCount,
      trackQuickView,
      triggerForAction,
      dismissModal,
      closeModal,
      markAsSignedUp,
      addLocalFavorite,
      getLocalFavorites,
      resetSession,
    ]
  );

  return (
    <SignupPressureContext.Provider value={value}>
      {children}
    </SignupPressureContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access the SignupPressure context.
 * Throws an error if used outside of SignupPressureProvider.
 */
export function useSignupPressure(): SignupPressureContextValue {
  const context = useContext(SignupPressureContext);
  if (!context) {
    throw new Error('useSignupPressure must be used within a SignupPressureProvider');
  }
  return context;
}

/**
 * Hook to access the SignupPressure context optionally.
 * Returns null if used outside of SignupPressureProvider.
 */
export function useSignupPressureOptional(): SignupPressureContextValue | null {
  return useContext(SignupPressureContext);
}
