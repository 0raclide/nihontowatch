import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import {
  stripe,
  constructWebhookEvent,
  extractSubscriptionDetails,
} from '@/lib/stripe/server';
import type { SubscriptionTier, SubscriptionStatus } from '@/types/subscription';

export const dynamic = 'force-dynamic';

// Disable body parsing - we need the raw body for webhook signature verification
export const runtime = 'nodejs';

/**
 * POST /api/subscription/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Webhook error: No signature');
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      );
    }

    // Verify and construct the event
    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * This fires when a customer completes checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('[Stripe Webhook] Checkout completed:', session.id);

  const userId = session.metadata?.user_id;
  if (!userId) {
    console.error('Checkout session missing user_id in metadata');
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Get the subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const { tier, status, currentPeriodEnd } = extractSubscriptionDetails(subscription);

  // Update the user's profile
  const supabase = createServiceClient();
  // @ts-expect-error Subscription columns added via migration 039
  const { error } = await supabase.from('profiles').update({
    subscription_tier: tier,
    subscription_status: status,
    subscription_started_at: new Date().toISOString(),
    subscription_expires_at: currentPeriodEnd.toISOString(),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  }).eq('id', userId);

  if (error) {
    console.error('Failed to update profile after checkout:', error);
  } else {
    console.log(`[Stripe Webhook] User ${userId} subscribed to ${tier}`);
  }
}

/**
 * Handle customer.subscription.created/updated
 * This fires when a subscription is created or updated (including renewals)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Subscription updated:', subscription.id);

  const userId = subscription.metadata?.user_id;
  const customerId = subscription.customer as string;

  if (!userId && !customerId) {
    console.error('Subscription missing user_id and customer_id');
    return;
  }

  const { tier, status, currentPeriodEnd, cancelAtPeriodEnd } = extractSubscriptionDetails(subscription);

  // Determine the effective status
  let effectiveStatus: SubscriptionStatus = status;
  if (cancelAtPeriodEnd && status === 'active') {
    // Subscription is active but will cancel at period end
    effectiveStatus = 'cancelled';
  }

  const supabase = createServiceClient();

  // Find user by userId or customerId
  let targetUserId: string | undefined = userId;
  if (!targetUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single() as { data: { id: string } | null };
    targetUserId = profile?.id;
  }

  if (!targetUserId) {
    console.error('Could not find user for subscription:', subscription.id);
    return;
  }

  // Update the user's profile
  // @ts-expect-error Subscription columns added via migration 039
  const { error } = await supabase.from('profiles').update({
    subscription_tier: tier,
    subscription_status: effectiveStatus,
    subscription_expires_at: currentPeriodEnd.toISOString(),
    stripe_subscription_id: subscription.id,
  }).eq('id', targetUserId);

  if (error) {
    console.error('Failed to update profile on subscription update:', error);
  } else {
    console.log(`[Stripe Webhook] User ${targetUserId} subscription updated: ${tier} (${effectiveStatus})`);
  }
}

/**
 * Handle customer.subscription.deleted
 * This fires when a subscription is fully cancelled (after period ends)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhook] Subscription deleted:', subscription.id);

  const userId = subscription.metadata?.user_id;
  const customerId = subscription.customer as string;

  const supabase = createServiceClient();

  // Find user by userId or customerId
  let targetUserId: string | undefined = userId;
  if (!targetUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single() as { data: { id: string } | null };
    targetUserId = profile?.id;
  }

  if (!targetUserId) {
    console.error('Could not find user for deleted subscription:', subscription.id);
    return;
  }

  // Downgrade to free tier
  // @ts-expect-error Subscription columns added via migration 039
  const { error } = await supabase.from('profiles').update({
    subscription_tier: 'free' as SubscriptionTier,
    subscription_status: 'inactive' as SubscriptionStatus,
    subscription_expires_at: null,
    stripe_subscription_id: null,
  }).eq('id', targetUserId);

  if (error) {
    console.error('Failed to downgrade user on subscription deletion:', error);
  } else {
    console.log(`[Stripe Webhook] User ${targetUserId} downgraded to free`);
  }
}

/**
 * Handle invoice.payment_failed
 * This fires when a payment fails (e.g., card declined)
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Stripe Webhook] Payment failed for invoice:', invoice.id);

  const customerId = invoice.customer as string;
  if (!customerId) return;

  const supabase = createServiceClient();

  // Find user by customerId
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single() as { data: { id: string } | null };

  if (!profile) {
    console.error('Could not find user for failed payment:', invoice.id);
    return;
  }

  // Mark subscription as past_due
  // @ts-expect-error Subscription columns added via migration 039
  const { error } = await supabase.from('profiles').update({
    subscription_status: 'past_due' as SubscriptionStatus,
  }).eq('id', profile.id);

  if (error) {
    console.error('Failed to update profile on payment failure:', error);
  } else {
    console.log(`[Stripe Webhook] User ${profile.id} marked as past_due`);
  }

  // TODO: Send email notification about payment failure
}

/**
 * Handle invoice.payment_succeeded
 * This fires when a payment succeeds (e.g., renewal)
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('[Stripe Webhook] Payment succeeded for invoice:', invoice.id);

  const customerId = invoice.customer as string;
  // In newer Stripe API, subscription is under parent.subscription_details
  const subscriptionDetails = invoice.parent?.subscription_details;
  const subscriptionData = subscriptionDetails?.subscription;
  const subscriptionId = typeof subscriptionData === 'string'
    ? subscriptionData
    : (subscriptionData as Stripe.Subscription | undefined)?.id;

  if (!customerId || !subscriptionId) return;

  const supabase = createServiceClient();

  // Find user by customerId
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, subscription_status')
    .eq('stripe_customer_id', customerId)
    .single() as { data: { id: string; subscription_status: string } | null };

  if (!profile) {
    return; // Not an error - might be a new customer
  }

  // If they were past_due, restore to active
  if (profile.subscription_status === 'past_due') {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const { tier, currentPeriodEnd } = extractSubscriptionDetails(subscription);

    // @ts-expect-error Subscription columns added via migration 039
    const { error } = await supabase.from('profiles').update({
      subscription_tier: tier,
      subscription_status: 'active' as SubscriptionStatus,
      subscription_expires_at: currentPeriodEnd.toISOString(),
    }).eq('id', profile.id);

    if (error) {
      console.error('Failed to restore subscription after payment:', error);
    } else {
      console.log(`[Stripe Webhook] User ${profile.id} subscription restored to active`);
    }
  }
}
