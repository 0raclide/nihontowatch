import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { SubscriptionTier, BillingPeriod } from '@/types/subscription';

export const dynamic = 'force-dynamic';

interface CheckoutRequestBody {
  tier: Exclude<SubscriptionTier, 'free'>;
  billingPeriod: BillingPeriod;
}

/**
 * POST /api/subscription/checkout
 * Create a Stripe Checkout Session for subscription
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CheckoutRequestBody = await request.json();
    const { tier, billingPeriod } = body;

    // Validate tier
    if (!['enthusiast', 'connoisseur', 'dealer'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      );
    }

    // Validate billing period
    if (!['monthly', 'annual'].includes(billingPeriod)) {
      return NextResponse.json(
        { error: 'Invalid billing period' },
        { status: 400 }
      );
    }

    // Get user's profile to check for existing Stripe customer
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single() as { data: { stripe_customer_id: string | null; email: string } | null };

    // Build success and cancel URLs
    const origin = request.headers.get('origin') || 'https://nihontowatch.com';
    const successUrl = `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/pricing?cancelled=true`;

    // Create checkout session
    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email || profile?.email || '',
      tier,
      billingPeriod,
      successUrl,
      cancelUrl,
      customerId: profile?.stripe_customer_id || undefined,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.logError('Checkout API error', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
