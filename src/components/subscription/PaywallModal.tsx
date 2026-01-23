'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import {
  type SubscriptionTier,
  type BillingPeriod,
  TIER_INFO,
  TIER_PRICING,
} from '@/types/subscription';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

// Animation timing in ms
const ANIMATION_TIMING = {
  modalEnter: 200,
  modalExit: 150,
};

// ============================================================================
// Icons
// ============================================================================

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  );
}

// ============================================================================
// Modal Content Component
// ============================================================================

interface PaywallModalContentProps {
  title: string;
  message: string;
  requiredTier: SubscriptionTier;
  onDismiss: () => void;
  onCheckout: (tier: Exclude<SubscriptionTier, 'free'>, billingPeriod: BillingPeriod) => Promise<void>;
  isLoggedIn: boolean;
  onSignIn: () => void;
}

function PaywallModalContent({
  title,
  message,
  requiredTier,
  onDismiss,
  onCheckout,
  isLoggedIn,
  onSignIn,
}: PaywallModalContentProps) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [isLoading, setIsLoading] = useState(false);

  // Ensure we have a valid paid tier (free -> enthusiast fallback)
  const tier: Exclude<SubscriptionTier, 'free'> =
    requiredTier === 'free' ? 'enthusiast' : requiredTier;
  const tierInfo = TIER_INFO[tier];
  const pricing = TIER_PRICING[tier];

  const handleUpgrade = async () => {
    if (isLoading) return;

    // If not logged in, show sign-in modal
    if (!isLoggedIn) {
      onSignIn();
      return;
    }

    setIsLoading(true);
    try {
      await onCheckout(tier, billingPeriod);
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const price = billingPeriod === 'annual' ? pricing.annual : pricing.monthly;
  const monthlyEquivalent =
    billingPeriod === 'annual'
      ? Math.round(pricing.annual / 12)
      : pricing.monthly;

  return (
    <div className="flex flex-col items-center text-center px-6 py-8 lg:px-10 lg:py-10">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 flex items-center justify-center mb-6">
        <SparkleIcon className="w-7 h-7 text-amber-600 dark:text-amber-400" />
      </div>

      {/* Feature Title */}
      <h2 className="font-serif text-2xl lg:text-3xl text-ink mb-3">
        {title}
      </h2>

      {/* Feature Message */}
      <p className="text-secondary text-sm lg:text-base leading-relaxed max-w-sm mb-6">
        {message}
      </p>

      {/* Required Tier Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border mb-6">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">
          Requires
        </span>
        <span className="text-sm font-semibold text-ink">
          {tierInfo.name}
        </span>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-ink text-cream'
                : 'bg-surface text-secondary hover:bg-border'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-ink text-cream'
                : 'bg-surface text-secondary hover:bg-border'
            }`}
          >
            Annual
            <span className="ml-1.5 text-xs opacity-75">
              (Save {pricing.annualSavings}%)
            </span>
          </button>
      </div>

      {/* Price Display */}
      <div className="mb-6">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-3xl font-bold text-ink">
            ${monthlyEquivalent}
          </span>
          <span className="text-secondary text-sm">/mo</span>
        </div>
        {billingPeriod === 'annual' && (
          <p className="text-xs text-muted mt-1">
            Billed ${price}/year
          </p>
        )}
      </div>

      {/* Features List */}
      <div className="w-full max-w-xs mb-8">
        <ul className="space-y-2 text-left">
          {tierInfo.features.slice(0, 4).map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-secondary">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA Button */}
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={isLoading}
        className="w-full max-w-xs px-6 py-3 rounded-lg bg-ink text-cream font-medium tracking-wide hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
      >
        {isLoading
          ? 'Redirecting...'
          : isLoggedIn
          ? `Upgrade to ${tierInfo.name}`
          : 'Sign in to upgrade'}
      </button>

      {/* Dismiss link */}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-6 text-muted text-sm hover:text-secondary transition-colors focus:outline-none focus:underline"
      >
        Maybe later
      </button>

      {/* Trust signals */}
      <p className="mt-4 text-muted text-xs">
        Cancel anytime. No hidden fees.
      </p>
    </div>
  );
}

// ============================================================================
// Desktop Modal
// ============================================================================

interface DesktopModalProps {
  title: string;
  message: string;
  requiredTier: SubscriptionTier;
  onDismiss: () => void;
  onCheckout: (tier: Exclude<SubscriptionTier, 'free'>, billingPeriod: BillingPeriod) => Promise<void>;
  isClosing: boolean;
  isLoggedIn: boolean;
  onSignIn: () => void;
}

function DesktopModal({
  title,
  message,
  requiredTier,
  onDismiss,
  onCheckout,
  isClosing,
  isLoggedIn,
  onSignIn,
}: DesktopModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-modal-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        onClick={onDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md bg-cream dark:bg-surface rounded-2xl shadow-xl ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        style={{
          animationDuration: isClosing
            ? `${ANIMATION_TIMING.modalExit}ms`
            : `${ANIMATION_TIMING.modalEnter}ms`,
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 text-muted hover:text-ink transition-colors rounded-full hover:bg-surface dark:hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Close"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <PaywallModalContent
          title={title}
          message={message}
          requiredTier={requiredTier}
          onDismiss={onDismiss}
          onCheckout={onCheckout}
          isLoggedIn={isLoggedIn}
          onSignIn={onSignIn}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Mobile Sheet
// ============================================================================

interface MobileSheetProps {
  title: string;
  message: string;
  requiredTier: SubscriptionTier;
  onDismiss: () => void;
  onCheckout: (tier: Exclude<SubscriptionTier, 'free'>, billingPeriod: BillingPeriod) => Promise<void>;
  isClosing: boolean;
  isLoggedIn: boolean;
  onSignIn: () => void;
}

function MobileSheet({
  title,
  message,
  requiredTier,
  onDismiss,
  onCheckout,
  isClosing,
  isLoggedIn,
  onSignIn,
}: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    const diff = currentY.current - startY.current;

    if (diff > 100) {
      onDismiss();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }

    startY.current = 0;
    currentY.current = 0;
  };

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-modal-title"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}
        onClick={onDismiss}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-cream dark:bg-surface rounded-t-2xl max-h-[90vh] flex flex-col safe-area-bottom ${isClosing ? 'animate-slideDown' : 'animate-slideUp'}`}
        style={{
          animationDuration: isClosing
            ? `${ANIMATION_TIMING.modalExit}ms`
            : `${ANIMATION_TIMING.modalEnter}ms`,
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 p-2 text-muted hover:text-ink transition-colors rounded-full"
          aria-label="Close"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <PaywallModalContent
            title={title}
            message={message}
            requiredTier={requiredTier}
            onDismiss={onDismiss}
            onCheckout={onCheckout}
            isLoggedIn={isLoggedIn}
            onSignIn={onSignIn}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main PaywallModal Component
// ============================================================================

export function PaywallModal() {
  const { paywallInfo, hidePaywall, checkout } = useSubscription();
  const { user } = useAuth();
  const [isClosing, setIsClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const isLoggedIn = !!user;

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle sign in click
  const handleSignIn = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  // Lock body scroll when modal is open
  useBodyScrollLock(!!paywallInfo);

  // Handle escape key
  useEffect(() => {
    if (!paywallInfo) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [paywallInfo]);

  // Dismiss with animation
  const handleDismiss = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      hidePaywall();
      setIsClosing(false);
    }, ANIMATION_TIMING.modalExit);
  }, [hidePaywall]);

  // Handle checkout
  const handleCheckout = useCallback(async (
    tier: Exclude<SubscriptionTier, 'free'>,
    billingPeriod: BillingPeriod
  ) => {
    await checkout(tier, billingPeriod);
  }, [checkout]);

  // Don't render until mounted (SSR safety)
  if (!mounted) return null;

  // Don't render if not open and not in closing animation
  if (!paywallInfo && !isClosing) return null;

  // Use paywallInfo or empty values during closing
  const title = paywallInfo?.title || '';
  const message = paywallInfo?.message || '';
  const requiredTier = paywallInfo?.requiredTier || 'enthusiast';

  // Detect mobile vs desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  const modal = isMobile ? (
    <MobileSheet
      title={title}
      message={message}
      requiredTier={requiredTier}
      onDismiss={handleDismiss}
      onCheckout={handleCheckout}
      isClosing={isClosing}
      isLoggedIn={isLoggedIn}
      onSignIn={handleSignIn}
    />
  ) : (
    <DesktopModal
      title={title}
      message={message}
      requiredTier={requiredTier}
      onDismiss={handleDismiss}
      onCheckout={handleCheckout}
      isClosing={isClosing}
      isLoggedIn={isLoggedIn}
      onSignIn={handleSignIn}
    />
  );

  return (
    <>
      {createPortal(modal, document.body)}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
