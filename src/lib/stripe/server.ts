/**
 * Stripe Server-Side Utilities
 *
 * Server-only Stripe operations. Do not import in client components.
 */

import Stripe from 'stripe';
import type { SubscriptionTier, BillingPeriod } from '@/types/subscription';

// =============================================================================
// STRIPE CLIENT
// =============================================================================

// Lazy initialization to avoid build-time errors when env vars are not set
let _stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    const client = getStripeClient();
    return (client as unknown as Record<string, unknown>)[prop as string];
  },
});

// =============================================================================
// PRICE IDS
// =============================================================================

/**
 * Stripe Price IDs for each tier and billing period
 * These must be created in the Stripe Dashboard first
 */
export const STRIPE_PRICES: Record<
  Exclude<SubscriptionTier, 'free'>,
  Record<BillingPeriod, string>
> = {
  enthusiast: {
    monthly: process.env.STRIPE_PRICE_ENTHUSIAST_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_ENTHUSIAST_ANNUAL || '',
  },
  connoisseur: {
    monthly: process.env.STRIPE_PRICE_CONNOISSEUR_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_CONNOISSEUR_ANNUAL || '',
  },
  dealer: {
    monthly: process.env.STRIPE_PRICE_DEALER_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_DEALER_ANNUAL || '',
  },
};

/**
 * Get price ID for a tier and billing period
 */
export function getPriceId(
  tier: Exclude<SubscriptionTier, 'free'>,
  billingPeriod: BillingPeriod
): string {
  const priceId = STRIPE_PRICES[tier][billingPeriod];
  if (!priceId) {
    throw new Error(`No price ID configured for ${tier} ${billingPeriod}`);
  }
  return priceId;
}

/**
 * Get tier from Stripe price ID
 */
export function getTierFromPriceId(priceId: string): SubscriptionTier | null {
  for (const [tier, prices] of Object.entries(STRIPE_PRICES)) {
    if (prices.monthly === priceId || prices.annual === priceId) {
      return tier as SubscriptionTier;
    }
  }
  return null;
}

// =============================================================================
// CHECKOUT
// =============================================================================

export interface CreateCheckoutParams {
  userId: string;
  userEmail: string;
  tier: Exclude<SubscriptionTier, 'free'>;
  billingPeriod: BillingPeriod;
  successUrl: string;
  cancelUrl: string;
  customerId?: string; // Existing Stripe customer ID if available
}

/**
 * Create a Stripe Checkout Session for subscription
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const { userId, userEmail, tier, billingPeriod, successUrl, cancelUrl, customerId } = params;

  const priceId = getPriceId(tier, billingPeriod);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      tier,
      billing_period: billingPeriod,
    },
    subscription_data: {
      metadata: {
        user_id: userId,
        tier,
      },
    },
    allow_promotion_codes: true,
  };

  // Use existing customer or create new
  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    sessionParams.customer_email = userEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

// =============================================================================
// CUSTOMER PORTAL
// =============================================================================

/**
 * Create a Stripe Billing Portal Session
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * Get customer's active subscription
 */
export async function getCustomerSubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });

  return subscriptions.data[0] || null;
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Reactivate a cancelled subscription
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

// =============================================================================
// WEBHOOK HELPERS
// =============================================================================

/**
 * Construct and verify webhook event
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Extract subscription details from Stripe subscription
 */
export function extractSubscriptionDetails(subscription: Stripe.Subscription): {
  tier: SubscriptionTier;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
} {
  // Get tier from subscription metadata or price ID
  let tier: SubscriptionTier = 'free';

  if (subscription.metadata?.tier) {
    tier = subscription.metadata.tier as SubscriptionTier;
  } else if (subscription.items.data[0]?.price?.id) {
    tier = getTierFromPriceId(subscription.items.data[0].price.id) || 'free';
  }

  // Map Stripe status to our status
  let status: 'active' | 'inactive' | 'cancelled' | 'past_due' = 'inactive';
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      status = 'active';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      status = 'cancelled';
      break;
    default:
      status = 'inactive';
  }

  // Get current period end from the first item
  const firstItem = subscription.items.data[0];
  const periodEnd = firstItem?.current_period_end ?? Math.floor(Date.now() / 1000);

  return {
    tier,
    status,
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}
