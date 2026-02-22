import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type {
  ActivityBatchPayload,
  ActivityBatchResponse,
  ActivityEvent,
} from '@/lib/activity/types';

export const dynamic = 'force-dynamic';

// =============================================================================
// Validation
// =============================================================================

function isValidEventType(type: string): boolean {
  const validTypes = [
    'page_view',
    'listing_view',
    'listing_detail_view',
    'listing_impression',
    'search',
    'search_click',
    'filter_change',
    'favorite_add',
    'favorite_remove',
    'alert_create',
    'alert_delete',
    'external_link_click',
    'dealer_click',
    'viewport_dwell',
    'quickview_panel_toggle',
    'quickview_open',
    'image_pinch_zoom',
    'inquiry_copy',
    'inquiry_mailto_click',
  ];
  return validTypes.includes(type);
}

/**
 * Extract client IP address from request headers
 */
function getClientIp(request: NextRequest): string | null {
  // Check various headers in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Vercel-specific header
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim();
  }

  return null;
}

function validateEvent(event: unknown): event is ActivityEvent {
  if (!event || typeof event !== 'object') return false;

  const e = event as Record<string, unknown>;

  // Required fields
  if (!e.type || !e.timestamp || !e.sessionId) return false;

  // Valid event type
  if (!isValidEventType(e.type as string)) return false;

  // Valid timestamp
  const timestamp = new Date(e.timestamp as string);
  if (isNaN(timestamp.getTime())) return false;

  return true;
}

function validatePayload(body: unknown): body is ActivityBatchPayload {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  // Session ID required
  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    return false;
  }

  // Events must be an array
  if (!Array.isArray(payload.events)) {
    return false;
  }

  return true;
}

// =============================================================================
// POST - Batch insert activity events
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, eventsReceived: 0, error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // Validate payload structure
    if (!validatePayload(body)) {
      return NextResponse.json(
        { success: false, eventsReceived: 0, error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    const { sessionId, userId, visitorId, events } = body;

    // Get client IP address
    const clientIp = getClientIp(request);

    // Filter and validate events
    const validEvents = events.filter(validateEvent);

    if (validEvents.length === 0) {
      return NextResponse.json(
        { success: true, eventsReceived: 0 },
        { status: 200 }
      );
    }

    // Prepare records for insertion
    const records = validEvents.map((event) => ({
      session_id: sessionId,
      user_id: userId || null,
      visitor_id: visitorId || event.visitorId || null,
      ip_address: clientIp,
      event_type: event.type,
      event_data: extractEventData(event),
      created_at: event.timestamp,
    }));

    // Use service client for all inserts (bypasses RLS, consistent across main + fan-out)
    const serviceClient = createServiceClient();

    // Insert into activity_events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (serviceClient as any).from('activity_events').insert(records);

    if (error) {
      // Log error but don't fail the request - activity tracking is best-effort
      logger.error('Failed to insert activity events', { error });

      // Check if table doesn't exist
      if (error.code === '42P01') {
        // Return success anyway - table might not be set up yet
        return NextResponse.json({
          success: true,
          eventsReceived: validEvents.length,
          warning: 'Activity events table not configured',
        } as ActivityBatchResponse);
      }
    }

    // Fan-out: write to dedicated tables (best-effort)
    // Search clicks must run AFTER searches (need the row to exist for CTR update)
    await Promise.allSettled([
      fanOutDealerClicks(serviceClient, validEvents, sessionId, userId, visitorId),
      fanOutListingViews(serviceClient, validEvents, sessionId, userId),
      fanOutSearches(serviceClient, validEvents, sessionId, userId)
        .then(() => fanOutSearchClicks(serviceClient, validEvents)),
    ]);

    return NextResponse.json({
      success: true,
      eventsReceived: validEvents.length,
    } as ActivityBatchResponse);
  } catch (error) {
    logger.logError('Activity batch API error', error);
    return NextResponse.json(
      { success: false, eventsReceived: 0, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract event-specific data for storage
 * Removes base fields that are stored in separate columns
 */
function extractEventData(event: ActivityEvent): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { type, timestamp, sessionId, userId, visitorId, ...data } = event;
  return data;
}

// =============================================================================
// Fan-out: dealer_click → dealer_clicks table
// =============================================================================

async function fanOutDealerClicks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  events: ActivityEvent[],
  sessionId: string,
  userId?: string,
  visitorId?: string,
): Promise<void> {
  const clicks = events.filter(e => e.type === 'dealer_click');
  if (clicks.length === 0) return;

  const rows = clicks.map(e => {
    const data = extractEventData(e);
    return {
      listing_id: data.listingId,
      dealer_id: data.dealerId,
      session_id: sessionId,
      visitor_id: visitorId || null,
      url: data.url || '',
      source: data.source || 'quickview',
      price_at_click: data.priceAtClick || null,
      currency_at_click: data.currencyAtClick || null,
    };
  });

  const { error } = await supabase.from('dealer_clicks').insert(rows);
  if (error && error.code !== '42P01') {
    logger.error('Fan-out dealer_clicks failed', { error });
  }
}

// =============================================================================
// Fan-out: listing_detail_view + quickview_open → listing_views table
// =============================================================================

async function fanOutListingViews(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  events: ActivityEvent[],
  sessionId: string,
  userId?: string,
): Promise<void> {
  const views = events.filter(e => e.type === 'listing_detail_view' || e.type === 'quickview_open');
  if (views.length === 0) return;

  for (const event of views) {
    const data = extractEventData(event);
    const now = new Date(event.timestamp);
    const viewDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

    const { error } = await supabase
      .from('listing_views')
      .insert({
        listing_id: data.listingId,
        session_id: sessionId,
        user_id: userId || null,
        referrer: event.type === 'quickview_open' ? 'quickview' : (data.referrer || null),
        viewed_at: event.timestamp,
        view_date: viewDate,
      });

    // Ignore unique constraint violations (dedup: one per listing/session/day)
    if (error && error.code !== '23505' && error.code !== '42P01') {
      logger.error('Fan-out listing_views failed', { error });
    }
  }
}

// =============================================================================
// Fan-out: search → user_searches table
// =============================================================================

async function fanOutSearches(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  events: ActivityEvent[],
  sessionId: string,
  userId?: string,
): Promise<void> {
  const searches = events.filter(e => e.type === 'search');
  if (searches.length === 0) return;

  const rows = searches.map(e => {
    const data = extractEventData(e);
    const query = (data.query as string) || '';
    return {
      query,
      query_normalized: query.toLowerCase().trim().replace(/\s+/g, ' '),
      filters: data.filters || null,
      result_count: data.resultCount ?? 0,
      session_id: sessionId,
      user_id: userId || null,
      searched_at: e.timestamp,
      correlation_id: data.correlationId || null,
    };
  });

  const { error } = await supabase.from('user_searches').insert(rows);
  if (error && error.code !== '42P01') {
    logger.error('Fan-out user_searches failed', { error });
  }
}

// =============================================================================
// Fan-out: search_click → user_searches table (CTR update)
// =============================================================================

async function fanOutSearchClicks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  events: ActivityEvent[],
): Promise<void> {
  const clicks = events.filter(e => e.type === 'search_click');
  if (clicks.length === 0) return;

  for (const event of clicks) {
    const data = extractEventData(event);
    const correlationId = data.correlationId as string | undefined;
    if (!correlationId) continue;

    const { error } = await supabase
      .from('user_searches')
      .update({
        clicked_listing_id: data.listingId,
        clicked_at: event.timestamp,
      })
      .eq('correlation_id', correlationId);

    if (error && error.code !== '42P01') {
      logger.error('Fan-out search_click update failed', { error, correlationId });
    }
  }
}
