'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import {
  type SubscriptionTier,
  type BillingPeriod,
  TIER_INFO,
  TIER_PRICING,
} from '@/types/subscription';

// =============================================================================
// Icons
// =============================================================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// =============================================================================
// Feature Matrix
// =============================================================================

interface FeatureRow {
  name: string;
  free: boolean | string;
  enthusiast: boolean | string;
}

const FEATURE_MATRIX: FeatureRow[] = [
  { name: 'Browse all listings', free: '72h delay', enthusiast: 'Real-time' },
  { name: 'Basic filters & search', free: true, enthusiast: true },
  { name: 'Unlimited favorites', free: true, enthusiast: true },
  { name: 'Currency conversion', free: true, enthusiast: true },
  { name: 'NBTHK Zufu translations', free: false, enthusiast: true },
  { name: 'AI inquiry email drafts', free: false, enthusiast: true },
  { name: 'Saved searches with alerts', free: false, enthusiast: true },
  { name: 'Data exports', free: false, enthusiast: true },
];

// =============================================================================
// Pricing Card Component
// =============================================================================

interface PricingCardProps {
  tier: SubscriptionTier;
  billingPeriod: BillingPeriod;
  isCurrentTier: boolean;
  onSelect: () => void;
  isLoading: boolean;
}

function PricingCard({ tier, billingPeriod, isCurrentTier, onSelect, isLoading }: PricingCardProps) {
  const info = TIER_INFO[tier];
  const pricing = tier !== 'free' ? TIER_PRICING[tier] : null;
  const isHighlighted = info.highlighted;

  const price = pricing
    ? billingPeriod === 'annual'
      ? Math.round(pricing.annual / 12)
      : pricing.monthly
    : 0;

  const annualTotal = pricing?.annual || 0;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-6 lg:p-8 transition-all ${
        isHighlighted
          ? 'border-gold bg-gradient-to-b from-gold/5 to-transparent shadow-lg scale-[1.02]'
          : 'border-border bg-surface hover:border-gold/50'
      }`}
    >
      {/* Popular badge */}
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white bg-gold rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Tier name & description */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-ink">{info.name}</h3>
        <p className="text-sm text-muted mt-1">{info.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-ink">${price}</span>
          <span className="text-muted">/mo</span>
        </div>
        {pricing && billingPeriod === 'annual' && (
          <p className="text-xs text-muted mt-1">
            Billed ${annualTotal}/year (save {pricing.annualSavings}%)
          </p>
        )}
        {tier === 'free' && (
          <p className="text-xs text-muted mt-1">Forever free</p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {info.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-secondary">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {tier === 'free' ? (
        <Link
          href="/"
          className="w-full py-3 px-4 text-center text-sm font-medium rounded-lg border border-border text-secondary hover:bg-surface transition-colors"
        >
          Continue Browsing
        </Link>
      ) : isCurrentTier ? (
        <button
          disabled
          className="w-full py-3 px-4 text-sm font-medium rounded-lg bg-surface text-muted cursor-not-allowed"
        >
          Current Plan
        </button>
      ) : (
        <button
          onClick={onSelect}
          disabled={isLoading}
          className={`w-full py-3 px-4 text-sm font-medium rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            isHighlighted
              ? 'bg-gold text-white hover:bg-gold-light'
              : 'bg-ink text-cream hover:bg-ink/90'
          }`}
        >
          {isLoading ? 'Redirecting...' : `Get ${info.name}`}
        </button>
      )}

    </div>
  );
}

// =============================================================================
// Feature Comparison Table
// =============================================================================

function FeatureComparisonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-4 px-4 text-sm font-medium text-muted">Feature</th>
            <th className="text-center py-4 px-4 text-sm font-medium text-ink">Free</th>
            <th className="text-center py-4 px-4 text-sm font-medium text-gold">Enthusiast</th>
          </tr>
        </thead>
        <tbody>
          {FEATURE_MATRIX.map((row, index) => (
            <tr key={index} className="border-b border-border/50">
              <td className="py-3 px-4 text-sm text-secondary">{row.name}</td>
              <td className="py-3 px-4 text-center">
                <FeatureCell value={row.free} />
              </td>
              <td className="py-3 px-4 text-center bg-gold/5">
                <FeatureCell value={row.enthusiast} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-muted">{value}</span>;
  }
  if (value) {
    return <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />;
  }
  return <XIcon className="w-5 h-5 text-muted/50 mx-auto" />;
}

// =============================================================================
// Main Pricing Page
// =============================================================================

export default function PricingPage() {
  const { tier: currentTier, checkout } = useSubscription();
  const { user } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [isLoading, setIsLoading] = useState<SubscriptionTier | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingTier, setPendingTier] = useState<Exclude<SubscriptionTier, 'free'> | null>(null);

  const handleSelectTier = async (tier: Exclude<SubscriptionTier, 'free'>) => {
    if (!user) {
      setPendingTier(tier);
      setShowLoginModal(true);
      return;
    }

    setIsLoading(tier);
    try {
      await checkout(tier, billingPeriod);
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setIsLoading(null);
    }
  };

  const handleLoginSuccess = async () => {
    setShowLoginModal(false);
    if (pendingTier) {
      await handleSelectTier(pendingTier);
      setPendingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-surface">
      {/* Header */}
      <header className="border-b border-border bg-linen/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl text-ink">
            Nihontowatch
          </Link>
          <Link
            href="/"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            Back to Browse
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="font-serif text-3xl lg:text-4xl text-ink mb-4">
            Choose Your Plan
          </h1>
          <p className="text-secondary max-w-2xl mx-auto">
            Get ahead of other collectors with real-time listings, AI-powered tools,
            and exclusive access to the best Japanese swords and fittings.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1 bg-surface rounded-lg border border-border">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-ink text-cream'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingPeriod === 'annual'
                  ? 'bg-ink text-cream'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">
                Save 25%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-3xl mx-auto mb-20">
          <PricingCard
            tier="free"
            billingPeriod={billingPeriod}
            isCurrentTier={currentTier === 'free'}
            onSelect={() => {}}
            isLoading={false}
          />
          <PricingCard
            tier="enthusiast"
            billingPeriod={billingPeriod}
            isCurrentTier={currentTier === 'enthusiast'}
            onSelect={() => handleSelectTier('enthusiast')}
            isLoading={isLoading === 'enthusiast'}
          />
        </div>

        {/* Feature Comparison */}
        <div className="mb-20">
          <h2 className="font-serif text-2xl text-ink text-center mb-8">
            Compare Features
          </h2>
          <div className="bg-surface rounded-xl border border-border p-4 lg:p-6">
            <FeatureComparisonTable />
          </div>
        </div>

        {/* FAQ / Trust */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-serif text-2xl text-ink mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6 text-left">
            <div>
              <h3 className="font-medium text-ink mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-secondary">
                Yes, you can cancel your subscription at any time. You&apos;ll continue to have access until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-ink mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-secondary">
                We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-ink mb-2">Is there a free trial?</h3>
              <p className="text-sm text-secondary">
                The Free tier lets you explore the platform with 72-hour delayed listings. Upgrade anytime to unlock real-time access and premium features.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-linen/50 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted">
          <p>Questions? Contact us at support@nihontowatch.com</p>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setPendingTier(null);
        }}
      />
    </div>
  );
}
