'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  type ConsentCategory,
  type ConsentPreferences,
  type ConsentRecord,
  type ConsentState,
  type ConsentMethod,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  DEFAULT_PREFERENCES,
  ACCEPT_ALL_PREFERENCES,
  REJECT_NON_ESSENTIAL_PREFERENCES,
} from '@/lib/consent/types';
import { useAuth } from '@/lib/auth/AuthContext';

// =============================================================================
// Types
// =============================================================================

interface ConsentContextValue extends ConsentState {
  /** Check if a specific category has consent */
  hasConsent: (category: ConsentCategory) => boolean;
  /** Accept all cookies */
  acceptAll: () => void;
  /** Reject non-essential cookies */
  rejectNonEssential: () => void;
  /** Update specific consent preferences */
  updateConsent: (preferences: Partial<Omit<ConsentPreferences, 'essential'>>) => void;
  /** Reset consent (for testing/debugging) */
  resetConsent: () => void;
  /** Open preferences modal */
  openPreferences: () => void;
  /** Close preferences modal */
  closePreferences: () => void;
  /** Close banner (after making a choice) */
  closeBanner: () => void;
}

// =============================================================================
// Storage Helpers
// =============================================================================

function getStoredConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as ConsentRecord;

    // Validate structure
    if (!parsed.preferences || !parsed.timestamp || !parsed.version) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setStoredConsent(consent: ConsentRecord): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch (e) {
    console.error('Failed to store consent:', e);
  }
}

function clearStoredConsent(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear consent:', e);
  }
}

// =============================================================================
// Context
// =============================================================================

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

interface ConsentProviderProps {
  children: ReactNode;
}

export function ConsentProvider({ children }: ConsentProviderProps) {
  const { user } = useAuth();

  // State
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = getStoredConsent();

    if (stored) {
      setConsent(stored);
      setShowBanner(false);

      // Check if policy version changed - if so, show banner again
      if (stored.version !== CONSENT_VERSION) {
        setShowBanner(true);
      }
    } else {
      // No consent stored - show banner
      setShowBanner(true);
    }

    setIsInitialized(true);
  }, []);

  // Sync consent to server when user is authenticated
  useEffect(() => {
    if (!user || !consent || !isInitialized) return;

    // Sync to profile in background (fire and forget)
    syncConsentToServer(consent).catch(console.error);
  }, [user, consent, isInitialized]);

  // Check if a category has consent
  const hasConsent = useCallback((category: ConsentCategory): boolean => {
    // Essential is always allowed
    if (category === 'essential') return true;

    // If no consent record, assume no consent for optional categories
    if (!consent) return false;

    return consent.preferences[category] === true;
  }, [consent]);

  // Create consent record helper
  const createConsentRecord = useCallback((
    preferences: ConsentPreferences,
    method: ConsentMethod
  ): ConsentRecord => ({
    preferences,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
    method,
  }), []);

  // Accept all cookies
  const acceptAll = useCallback(() => {
    const record = createConsentRecord(ACCEPT_ALL_PREFERENCES, 'banner');
    setConsent(record);
    setStoredConsent(record);
    setShowBanner(false);
    setShowPreferences(false);
  }, [createConsentRecord]);

  // Reject non-essential cookies
  const rejectNonEssential = useCallback(() => {
    const record = createConsentRecord(REJECT_NON_ESSENTIAL_PREFERENCES, 'banner');
    setConsent(record);
    setStoredConsent(record);
    setShowBanner(false);
    setShowPreferences(false);
  }, [createConsentRecord]);

  // Update specific preferences
  const updateConsent = useCallback((
    updates: Partial<Omit<ConsentPreferences, 'essential'>>
  ) => {
    const currentPreferences = consent?.preferences ?? DEFAULT_PREFERENCES;
    const newPreferences: ConsentPreferences = {
      ...currentPreferences,
      ...updates,
      essential: true, // Always force essential to true
    };

    const record = createConsentRecord(newPreferences, 'preferences');
    setConsent(record);
    setStoredConsent(record);
    setShowBanner(false);
    setShowPreferences(false);
  }, [consent, createConsentRecord]);

  // Reset consent (for testing)
  const resetConsent = useCallback(() => {
    setConsent(null);
    clearStoredConsent();
    setShowBanner(true);
    setShowPreferences(false);
  }, []);

  // Open/close preferences modal
  const openPreferences = useCallback(() => {
    setShowPreferences(true);
  }, []);

  const closePreferences = useCallback(() => {
    setShowPreferences(false);
  }, []);

  // Close banner
  const closeBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  // Memoize context value
  const value: ConsentContextValue = useMemo(() => ({
    hasConsented: consent !== null,
    consent,
    showBanner: isInitialized && showBanner,
    showPreferences,
    hasConsent,
    acceptAll,
    rejectNonEssential,
    updateConsent,
    resetConsent,
    openPreferences,
    closePreferences,
    closeBanner,
  }), [
    consent,
    isInitialized,
    showBanner,
    showPreferences,
    hasConsent,
    acceptAll,
    rejectNonEssential,
    updateConsent,
    resetConsent,
    openPreferences,
    closePreferences,
    closeBanner,
  ]);

  return (
    <ConsentContext.Provider value={value}>
      {children}
    </ConsentContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (context === undefined) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
}

// =============================================================================
// Server Sync Helper
// =============================================================================

async function syncConsentToServer(consent: ConsentRecord): Promise<void> {
  try {
    await fetch('/api/user/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent }),
    });
  } catch (e) {
    // Silently fail - consent is still stored locally
    console.error('Failed to sync consent to server:', e);
  }
}

// =============================================================================
// Utility Hook for Conditional Features
// =============================================================================

/**
 * Hook to check consent before enabling a feature
 * Returns a function that only executes if consent is given
 */
export function useConsentGuard<T extends (...args: unknown[]) => unknown>(
  category: ConsentCategory,
  fn: T
): T {
  const { hasConsent } = useConsent();

  return useCallback((...args: Parameters<T>) => {
    if (!hasConsent(category)) {
      return undefined;
    }
    return fn(...args);
  }, [hasConsent, category, fn]) as T;
}
