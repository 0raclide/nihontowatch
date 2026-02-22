import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Type shapes for Supabase query results (tables lack generated types)
type SavedSearchRow = { id: string; name: string | null };
type NotificationRow = {
  id: string;
  saved_search_id: string;
  matched_listing_ids: number[];
  created_at: string;
};
type ListingRow = {
  id: number;
  title: string | null;
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  images: unknown;
  dealer_id: number | null;
};
type DealerRow = { id: number; name: string };

/**
 * GET /api/notifications/recent?since=<ISO>
 *
 * Returns recent saved search notifications for the authenticated user.
 * Used by the NotificationBell header component.
 */
export async function GET(request: NextRequest) {
  const sinceParam = request.nextUrl.searchParams.get('since');

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Unauthenticated — return empty state
    if (!user) {
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
        hasSavedSearches: false,
      });
    }

    // 1. Fetch user's saved searches (ids + names)
    const { data: rawSearches, error: ssError } = await supabase
      .from('saved_searches')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (ssError) {
      console.error('Failed to fetch saved searches:', ssError);
      return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 });
    }

    const savedSearches = (rawSearches || []) as SavedSearchRow[];
    const hasSavedSearches = savedSearches.length > 0;

    if (!hasSavedSearches) {
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
        hasSavedSearches: false,
      });
    }

    const searchIds = savedSearches.map((s) => s.id);
    const searchNameMap = new Map(savedSearches.map((s) => [s.id, s.name]));

    // 2. Fetch recent notifications
    const { data: rawNotifs, error: notifError } = await supabase
      .from('saved_search_notifications')
      .select('id, saved_search_id, matched_listing_ids, created_at')
      .in('saved_search_id', searchIds)
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(10);

    if (notifError) {
      console.error('Failed to fetch notifications:', notifError);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    const notifications = (rawNotifs || []) as NotificationRow[];

    if (notifications.length === 0) {
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
        hasSavedSearches: true,
      });
    }

    // 3. Collect listing IDs (first 2 per notification, max 10 total)
    const listingIds: number[] = [];
    for (const notif of notifications) {
      const ids = (notif.matched_listing_ids || []).slice(0, 2);
      for (const id of ids) {
        if (listingIds.length < 10 && !listingIds.includes(id)) {
          listingIds.push(id);
        }
      }
    }

    // 4. Fetch listing details + dealer names
    const listingMap = new Map<number, {
      id: number;
      title: string | null;
      item_type: string | null;
      price_value: number | null;
      price_currency: string | null;
      dealer_name: string | null;
      thumbnail: string | null;
    }>();

    if (listingIds.length > 0) {
      const { data: rawListings } = await supabase
        .from('listings')
        .select('id, title, item_type, price_value, price_currency, images, dealer_id')
        .in('id', listingIds);

      const listings = (rawListings || []) as ListingRow[];

      if (listings.length > 0) {
        // Fetch dealer names
        const dealerIds = [...new Set(listings.map((l) => l.dealer_id).filter((id): id is number => id !== null))];

        let dealerNameMap = new Map<number, string>();
        if (dealerIds.length > 0) {
          const { data: rawDealers } = await supabase
            .from('dealers')
            .select('id, name, name_ja')
            .in('id', dealerIds);

          const dealers = (rawDealers || []) as DealerRow[];
          dealerNameMap = new Map(dealers.map((d) => [d.id, d.name]));
        }

        for (const listing of listings) {
          const images = listing.images as string[] | null;
          listingMap.set(listing.id, {
            id: listing.id,
            title: listing.title,
            item_type: listing.item_type,
            price_value: listing.price_value,
            price_currency: listing.price_currency,
            dealer_name: listing.dealer_id ? (dealerNameMap.get(listing.dealer_id) || null) : null,
            thumbnail: images?.[0] || null,
          });
        }
      }
    }

    // 5. Assemble response
    const result = notifications.map((notif) => ({
      id: notif.id,
      savedSearchId: notif.saved_search_id,
      searchName: searchNameMap.get(notif.saved_search_id) || null,
      listings: (notif.matched_listing_ids || [])
        .slice(0, 2)
        .map((lid: number) => listingMap.get(lid))
        .filter(Boolean),
      matchCount: (notif.matched_listing_ids || []).length,
      created_at: notif.created_at,
    }));

    // 6. Compute unread count based on `since` param
    let unreadCount = 0;
    if (sinceParam) {
      const sinceDate = new Date(sinceParam);
      if (!isNaN(sinceDate.getTime())) {
        unreadCount = result.filter(
          (n) => new Date(n.created_at) > sinceDate
        ).length;
      }
    } else {
      // If no since param, all are "unread"
      unreadCount = result.length;
    }

    return NextResponse.json({
      notifications: result,
      unreadCount,
      hasSavedSearches: true,
    });
  } catch (err) {
    console.error('Notifications API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
