'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  type SubscriptionTier,
  type SubscriptionStatus,
  type Feature,
  type SubscriptionState,
  type BillingPeriod,
  createSubscriptionState,
  FEATURE_PAYWALL_MESSAGES,
} from '@/types/subscription';
import { startCheckout, openBillingPortal } from '@/lib/stripe/client';

// =============================================================================
// Types
// =============================================================================

interface PaywallInfo {
  feature: Feature;
  title: string;
  message: string;
  requiredTier: SubscriptionTier;
}

interface SubscriptionContextValue extends SubscriptionState {
  /** Whether subscription data is loading */
  isLoading: boolean;
  /** Show paywall modal for a feature */
  showPaywall: (feature: Feature) => void;
  /** Hide paywall modal */
  hidePaywall: () => void;
  /** Current paywall info (if showing) */
  paywallInfo: PaywallInfo | null;
  /** Start checkout for a tier */
  checkout: (tier: Exclude<SubscriptionTier, 'free'>, billingPeriod: BillingPeriod) => Promise<void>;
  /** Open billing portal */
  openPortal: () => Promise<void>;
  /** Check if user can access a feature, showing paywall if not */
  requireFeature: (feature: Feature) => boolean;
  /** Refresh subscription data from profile */
  refresh: () => Promise<void>;
}

// =============================================================================
// Context
// =============================================================================

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { profile, isLoading: authLoading, refreshProfile, isAdmin } = useAuth();

  const [paywallInfo, setPaywallInfo] = useState<PaywallInfo | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Derive subscription state from profile
  // Admins get full access (connoisseur tier) regardless of actual subscription
  const subscriptionState = useMemo(() => {
    // Admins always have full access
    if (isAdmin) {
      return {
        tier: 'connoisseur' as SubscriptionTier,
        status: 'active' as SubscriptionStatus,
        isActive: true,
        expiresAt: null,
        isFree: false,
        isEnthusiast: true,
        isConnoisseur: true,
        isDealer: false,
        canAccess: () => true, // Admins can access everything
      };
    }

    if (!profile) {
      return createSubscriptionState(null);
    }
    return createSubscriptionState({
      subscription_tier: profile.subscription_tier,
      subscription_status: profile.subscription_status,
      subscription_started_at: profile.subscription_started_at,
      subscription_expires_at: profile.subscription_expires_at,
      stripe_customer_id: profile.stripe_customer_id,
      stripe_subscription_id: profile.stripe_subscription_id,
    });
  }, [profile, isAdmin]);

  // Show paywall for a feature
  const showPaywall = useCallback((feature: Feature) => {
    const paywallMessage = FEATURE_PAYWALL_MESSAGES[feature];
    setPaywallInfo({
      feature,
      title: paywallMessage.title,
      message: paywallMessage.message,
      requiredTier: paywallMessage.requiredTier,
    });
  }, []);

  // Hide paywall
  const hidePaywall = useCallback(() => {
    setPaywallInfo(null);
  }, []);

  // Start checkout for a tier
  const checkout = useCallback(async (
    tier: Exclude<SubscriptionTier, 'free'>,
    billingPeriod: BillingPeriod
  ) => {
    if (isCheckingOut) return;

    try {
      setIsCheckingOut(true);
      await startCheckout({ tier, billingPeriod });
    } catch (error) {
      console.error('Checkout error:', error);
      throw error;
    } finally {
      setIsCheckingOut(false);
    }
  }, [isCheckingOut]);

  // Open billing portal
  const openPortal = useCallback(async () => {
    try {
      await openBillingPortal();
    } catch (error) {
      console.error('Portal error:', error);
      throw error;
    }
  }, []);

  // Check if user can access a feature, showing paywall if not
  const requireFeature = useCallback((feature: Feature): boolean => {
    const canAccess = subscriptionState.canAccess(feature);
    if (!canAccess) {
      showPaywall(feature);
    }
    return canAccess;
  }, [subscriptionState, showPaywall]);

  // Refresh subscription data
  const refresh = useCallback(async () => {
    await refreshProfile();
  }, [refreshProfile]);

  // Memoize context value
  const value: SubscriptionContextValue = useMemo(
    () => ({
      ...subscriptionState,
      isLoading: authLoading,
      paywallInfo,
      showPaywall,
      hidePaywall,
      checkout,
      openPortal,
      requireFeature,
      refresh,
    }),
    [
      subscriptionState,
      authLoading,
      paywallInfo,
      showPaywall,
      hidePaywall,
      checkout,
      openPortal,
      requireFeature,
      refresh,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// =============================================================================
// Feature Gate Component
// =============================================================================

interface FeatureGateProps {
  feature: Feature;
  children: ReactNode;
  /** What to render when feature is not accessible (defaults to nothing) */
  fallback?: ReactNode;
  /** If true, don't show paywall, just hide content */
  silent?: boolean;
}

/**
 * Conditionally render content based on feature access
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
  silent = false,
}: FeatureGateProps) {
  const { canAccess, showPaywall } = useSubscription();

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  // If not silent and user tries to interact, show paywall
  if (!silent && fallback) {
    return (
      <div onClick={() => showPaywall(feature)} role="button" tabIndex={0}>
        {fallback}
      </div>
    );
  }

  return <>{fallback}</>;
}
