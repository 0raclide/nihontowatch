/**
 * Stripe Client-Side Utilities
 *
 * Browser-safe Stripe operations using @stripe/stripe-js.
 */

import type { Stripe } from '@stripe/stripe-js';

// =============================================================================
// STRIPE CLIENT
// =============================================================================

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get the Stripe.js instance (singleton pattern)
 * Lazy-loads @stripe/stripe-js on first call — avoids 153KB in initial bundle.
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
      return Promise.resolve(null);
    }
    stripePromise = import('@stripe/stripe-js').then(m => m.loadStripe(publishableKey));
  }
  return stripePromise;
}

// =============================================================================
// API HELPERS
// =============================================================================

import type { SubscriptionTier, BillingPeriod } from '@/types/subscription';

export interface CheckoutOptions {
  tier: Exclude<SubscriptionTier, 'free'>;
  billingPeriod: BillingPeriod;
}

/**
 * Start a checkout session
 * Redirects the user to Stripe Checkout
 */
export async function startCheckout(options: CheckoutOptions): Promise<void> {
  const response = await fetch('/api/subscription/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  const { url } = await response.json();
  if (!url) {
    throw new Error('No checkout URL returned');
  }

  // Redirect to Stripe Checkout
  window.location.href = url;
}

/**
 * Open the Stripe billing portal
 */
export async function openBillingPortal(): Promise<void> {
  const response = await fetch('/api/subscription/portal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create portal session');
  }

  const { url } = await response.json();
  window.location.href = url;
}
