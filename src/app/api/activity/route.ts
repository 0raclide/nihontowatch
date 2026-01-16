import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
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
    'search',
    'filter_change',
    'favorite_add',
    'favorite_remove',
    'alert_create',
    'alert_delete',
    'external_link_click',
  ];
  return validTypes.includes(type);
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

    const { sessionId, userId, events } = body;

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

    const { error } = await supabase.from('activity_events').insert(records);

    if (error) {
      // Log error but don't fail the request - activity tracking is best-effort
      console.error('Failed to insert activity events:', error);

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

    return NextResponse.json({
      success: true,
      eventsReceived: validEvents.length,
    } as ActivityBatchResponse);
  } catch (error) {
    console.error('Activity batch API error:', error);
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
