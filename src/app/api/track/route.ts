/**
 * Activity Tracking API
 *
 * Receives batched activity events from the client and stores them
 * in the user_sessions and activity_events tables.
 *
 * Features:
 * - Validates incoming event data
 * - Rate limiting per session
 * - Handles both authenticated and anonymous users
 * - Graceful failure (best-effort tracking)
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type {
  ActivityBatchPayload,
  ActivityBatchResponse,
  ActivityEvent,
} from '@/lib/activity/types';

export const dynamic = 'force-dynamic';

// =============================================================================
// Rate Limiting (in-memory for simplicity)
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per session

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(sessionId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// =============================================================================
// Validation
// =============================================================================

const VALID_EVENT_TYPES = [
  'page_view',
  'listing_view',
  'search',
  'filter_change',
  'favorite_add',
  'favorite_remove',
  'alert_create',
  'alert_delete',
  'external_link_click',
  'viewport_dwell',
  'quickview_open',
] as const;

function isValidEventType(type: string): boolean {
  return VALID_EVENT_TYPES.includes(type as typeof VALID_EVENT_TYPES[number]);
}

function validateEvent(event: unknown): event is ActivityEvent {
  if (!event || typeof event !== 'object') return false;

  const e = event as Record<string, unknown>;

  // Required fields
  if (!e.type || !e.timestamp || !e.sessionId) return false;

  // Valid event type
  if (!isValidEventType(e.type as string)) return false;

  // Valid timestamp (must be within last 24 hours)
  const timestamp = new Date(e.timestamp as string);
  if (isNaN(timestamp.getTime())) return false;

  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  if (timestamp.getTime() < twentyFourHoursAgo || timestamp.getTime() > now + 60000) {
    return false; // Allow 1 minute clock skew
  }

  // Type-specific validation
  switch (e.type) {
    case 'page_view':
      if (!e.path || typeof e.path !== 'string') return false;
      break;
    case 'listing_view':
      if (!e.listingId || typeof e.listingId !== 'number') return false;
      if (typeof e.durationMs !== 'number') return false;
      break;
    case 'search':
      if (typeof e.query !== 'string') return false;
      break;
    case 'filter_change':
      if (!e.changedFilter || typeof e.changedFilter !== 'string') return false;
      break;
    case 'favorite_add':
    case 'favorite_remove':
      if (!e.listingId || typeof e.listingId !== 'number') return false;
      break;
    case 'external_link_click':
      if (!e.url || typeof e.url !== 'string') return false;
      break;
    case 'viewport_dwell':
      if (!e.listingId || typeof e.listingId !== 'number') return false;
      if (typeof e.dwellMs !== 'number') return false;
      break;
    case 'quickview_open':
      if (!e.listingId || typeof e.listingId !== 'number') return false;
      break;
  }

  return true;
}

function validatePayload(body: unknown): body is ActivityBatchPayload {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  // Session ID required
  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    return false;
  }

  // Session ID must match expected format
  if (!payload.sessionId.startsWith('sess_')) {
    return false;
  }

  // Events must be an array
  if (!Array.isArray(payload.events)) {
    return false;
  }

  // Limit batch size
  if (payload.events.length > 100) {
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

    const { sessionId, userId, events } = body;

    // Check rate limit
    if (!checkRateLimit(sessionId)) {
      return NextResponse.json(
        { success: false, eventsReceived: 0, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

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
      event_type: event.type,
      event_data: extractEventData(event),
      created_at: event.timestamp,
    }));

    // Insert into database
    const supabase = await createClient();

    // Use type assertion since activity_events table may not be in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('activity_events').insert(records);

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

    // Update user_activity table for admin dashboard compatibility
    // This populates the existing admin dashboard's expected data format
    await updateUserActivity(supabase, validEvents, userId);

    return NextResponse.json({
      success: true,
      eventsReceived: validEvents.length,
    } as ActivityBatchResponse);
  } catch (error) {
    logger.logError('Activity tracking API error', error);
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
  const { type, timestamp, sessionId, userId, ...data } = event;
  return data;
}

/**
 * Update user_activity table for compatibility with admin dashboard
 * The admin dashboard queries user_activity, so we need to populate it
 */
async function updateUserActivity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  events: ActivityEvent[],
  userId?: string
): Promise<void> {
  // Only record activity for authenticated users in user_activity table
  if (!userId) return;

  const activityRecords = events.map((event) => {
    const record: Record<string, unknown> = {
      user_id: userId,
      action_type: mapEventTypeToActionType(event.type),
      created_at: event.timestamp,
    };

    // Add event-specific fields
    switch (event.type) {
      case 'page_view':
        record.page_path = (event as { path: string }).path;
        break;
      case 'listing_view':
        record.listing_id = (event as { listingId: number }).listingId;
        record.duration_seconds = Math.round(
          (event as { durationMs: number }).durationMs / 1000
        );
        break;
      case 'search':
        record.search_query = (event as { query: string }).query;
        break;
      case 'favorite_add':
      case 'favorite_remove':
        record.listing_id = (event as { listingId: number }).listingId;
        break;
    }

    return record;
  });

  try {
    await supabase.from('user_activity').insert(activityRecords);
  } catch (error) {
    // Silently fail - this is best-effort compatibility
    logger.error('Failed to update user_activity', { error });
  }
}

/**
 * Map activity event types to user_activity action types
 */
function mapEventTypeToActionType(eventType: string): string {
  const mapping: Record<string, string> = {
    page_view: 'view',
    listing_view: 'view',
    search: 'search',
    filter_change: 'view',
    favorite_add: 'favorite',
    favorite_remove: 'favorite',
    alert_create: 'alert_create',
    alert_delete: 'alert_delete',
    external_link_click: 'view',
  };

  return mapping[eventType] || 'view';
}
