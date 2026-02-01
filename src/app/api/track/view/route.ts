/**
 * Listing View Tracking API
 *
 * POST /api/track/view
 * Records when a user views a listing for engagement analytics.
 *
 * Features:
 * - Deduplication via ON CONFLICT (one view per listing/session/day)
 * - Silent failure (never break UX)
 * - Service role bypass for RLS
 */

import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// =============================================================================
// Types
// =============================================================================

interface ViewTrackingPayload {
  listingId: number;
  sessionId: string;
  userId?: string;
  referrer?: 'browse' | 'search' | 'direct' | 'external' | 'alert';
}

interface ViewTrackingResponse {
  success: boolean;
  error?: string;
}

// =============================================================================
// Validation
// =============================================================================

function validatePayload(body: unknown): body is ViewTrackingPayload {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  // listingId is required and must be a positive integer
  if (
    typeof payload.listingId !== 'number' ||
    !Number.isInteger(payload.listingId) ||
    payload.listingId <= 0
  ) {
    return false;
  }

  // sessionId is required and must be a non-empty string
  if (typeof payload.sessionId !== 'string' || payload.sessionId.trim() === '') {
    return false;
  }

  // userId is optional but must be a string if provided
  if (payload.userId !== undefined && typeof payload.userId !== 'string') {
    return false;
  }

  // referrer is optional but must be one of the allowed values if provided
  const validReferrers = ['browse', 'search', 'direct', 'external', 'alert'];
  if (
    payload.referrer !== undefined &&
    (typeof payload.referrer !== 'string' || !validReferrers.includes(payload.referrer))
  ) {
    return false;
  }

  return true;
}

// =============================================================================
// POST - Track a listing view
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<ViewTrackingResponse>> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    // Validate payload
    if (!validatePayload(body)) {
      // Determine which field is missing/invalid for better error message
      const payload = body as Record<string, unknown>;
      if (
        typeof payload.listingId !== 'number' ||
        !Number.isInteger(payload.listingId) ||
        payload.listingId <= 0
      ) {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid listingId' },
          { status: 400 }
        );
      }
      if (typeof payload.sessionId !== 'string' || payload.sessionId.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid sessionId' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const { listingId, sessionId, userId, referrer } = body;

    // Use service client to bypass RLS for insert
    const supabase = createServiceClient();

    // Insert with ON CONFLICT DO NOTHING for deduplication
    // The unique index on (listing_id, session_id, view_date) handles deduplication
    const now = new Date();
    const viewDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('listing_views')
      .insert({
        listing_id: listingId,
        session_id: sessionId,
        user_id: userId || null,
        referrer: referrer || null,
        viewed_at: now.toISOString(),
        view_date: viewDate,
      });

    if (error) {
      // Check for unique constraint violation (duplicate view - this is expected)
      if (error.code === '23505') {
        // Duplicate is fine - return success
        return NextResponse.json({ success: true });
      }

      // Check if table doesn't exist
      if (error.code === '42P01') {
        logger.warn('listing_views table not found - migration may be pending');
        return NextResponse.json({ success: true });
      }

      // Log other errors but still return success (best-effort tracking)
      logger.error('Failed to insert listing view', { error, listingId, sessionId });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Log the error but return success (never break UX for tracking)
    logger.logError('View tracking API error', error);
    return NextResponse.json({ success: true });
  }
}
