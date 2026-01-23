import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createPortalSession } from '@/lib/stripe/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subscription/portal
 * Create a Stripe Billing Portal Session
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

    // Get user's Stripe customer ID
    const serviceClient = createServiceClient();
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single() as { data: { stripe_customer_id: string | null } | null; error: unknown };

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No subscription found. Please subscribe first.' },
        { status: 400 }
      );
    }

    // Build return URL
    const origin = request.headers.get('origin') || 'https://nihontowatch.com';
    const returnUrl = `${origin}/profile`;

    // Create portal session
    const session = await createPortalSession(
      profile.stripe_customer_id,
      returnUrl
    );

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error('Portal API error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
