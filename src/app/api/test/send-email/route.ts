/**
 * Test endpoint to send a real email notification
 *
 * Usage: POST /api/test/send-email
 * Body: { type: 'saved-search' | 'price-drop' | 'back-in-stock', email?: string }
 *
 * Requires: Admin user or CRON_SECRET header
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/client';
import { sendSavedSearchNotification, sendPriceDropNotification, sendBackInStockNotification } from '@/lib/email/sendgrid';
import type { SavedSearch, Listing } from '@/types';

export const dynamic = 'force-dynamic';

// Verify authorization
async function isAuthorized(request: NextRequest): Promise<{ authorized: boolean; email?: string; isAdmin?: boolean }> {
  // Check cron secret
  const cronSecret = process.env.CRON_SECRET;
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronSecret && cronHeader === cronSecret) {
    return { authorized: true };
  }

  // Check if user is admin
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('is_admin, email')
      .eq('id', user.id)
      .single();

    if (profile?.is_admin) {
      return { authorized: true, email: profile.email, isAdmin: true };
    }
  }

  return { authorized: false };
}

export async function POST(request: NextRequest) {
  const auth = await isAuthorized(request);

  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, email: overrideEmail } = body;
    const targetEmail = overrideEmail || auth.email;

    if (!targetEmail) {
      return NextResponse.json({ error: 'No email address provided or found' }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (type === 'saved-search') {
      // Get a real saved search or create mock data
      const { data: savedSearch } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      // Get some real listings to include in the email
      const { data: listings } = await supabase
        .from('listings')
        .select(`
          id, url, title, item_type, price_value, price_currency,
          smith, school, cert_type, images, first_seen_at,
          dealers!inner(id, name, domain)
        `)
        .eq('is_available', true)
        .order('first_seen_at', { ascending: false })
        .limit(5);

      if (!listings || listings.length === 0) {
        return NextResponse.json({ error: 'No listings found to include in test email' }, { status: 400 });
      }

      const mockSavedSearch: SavedSearch = savedSearch ? {
        id: savedSearch.id,
        user_id: savedSearch.user_id,
        name: savedSearch.name || 'Test Saved Search',
        search_criteria: savedSearch.search_criteria as SavedSearch['search_criteria'],
        notification_frequency: 'instant',
        is_active: true,
        created_at: savedSearch.created_at,
        updated_at: savedSearch.updated_at,
      } : {
        id: 0,
        user_id: 'test',
        name: 'Test Saved Search',
        search_criteria: { query: 'katana' },
        notification_frequency: 'instant',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await sendSavedSearchNotification(
        targetEmail,
        mockSavedSearch,
        listings as unknown as Listing[],
        'instant'
      );

      return NextResponse.json({
        success: result.success,
        type: 'saved-search',
        email: targetEmail,
        listingsIncluded: listings.length,
        messageId: result.messageId,
        error: result.error,
      });

    } else if (type === 'price-drop') {
      // Get a real listing for the test
      const { data: listing } = await supabase
        .from('listings')
        .select(`
          id, url, title, item_type, price_value, price_currency,
          smith, school, cert_type, images,
          dealers!inner(id, name, domain)
        `)
        .eq('is_available', true)
        .not('price_value', 'is', null)
        .limit(1)
        .single();

      if (!listing) {
        return NextResponse.json({ error: 'No listing found for test email' }, { status: 400 });
      }

      const oldPrice = listing.price_value! * 1.2; // Simulate 20% drop
      const newPrice = listing.price_value!;

      const result = await sendPriceDropNotification(
        targetEmail,
        listing as unknown as Listing,
        oldPrice,
        newPrice
      );

      return NextResponse.json({
        success: result.success,
        type: 'price-drop',
        email: targetEmail,
        listing: listing.title,
        oldPrice,
        newPrice,
        messageId: result.messageId,
        error: result.error,
      });

    } else if (type === 'back-in-stock') {
      // Get a real listing for the test
      const { data: listing } = await supabase
        .from('listings')
        .select(`
          id, url, title, item_type, price_value, price_currency,
          smith, school, cert_type, images,
          dealers!inner(id, name, domain)
        `)
        .eq('is_available', true)
        .limit(1)
        .single();

      if (!listing) {
        return NextResponse.json({ error: 'No listing found for test email' }, { status: 400 });
      }

      const result = await sendBackInStockNotification(
        targetEmail,
        listing as unknown as Listing
      );

      return NextResponse.json({
        success: result.success,
        type: 'back-in-stock',
        email: targetEmail,
        listing: listing.title,
        messageId: result.messageId,
        error: result.error,
      });

    } else {
      return NextResponse.json({
        error: 'Invalid type. Must be "saved-search", "price-drop", or "back-in-stock"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
