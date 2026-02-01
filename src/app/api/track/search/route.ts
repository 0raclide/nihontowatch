/**
 * Search Tracking API
 *
 * POST /api/track/search
 * Records user search queries for engagement analytics and CTR tracking.
 *
 * Features:
 * - Query normalization (lowercase, trimmed)
 * - Stores filters as JSONB
 * - Returns searchId for later CTR tracking
 * - Service role bypass for RLS
 */

import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// =============================================================================
// Types
// =============================================================================

interface SearchFilters {
  itemType?: string | string[];
  dealer?: string | string[];
  certification?: string | string[];
  priceMin?: number;
  priceMax?: number;
  [key: string]: unknown; // Allow additional filters
}

interface SearchTrackingPayload {
  query: string;
  filters?: SearchFilters;
  resultCount: number;
  sessionId: string;
  userId?: string;
}

interface SearchTrackingResponse {
  success: boolean;
  searchId?: number;
  error?: string;
}

// =============================================================================
// Validation
// =============================================================================

function validatePayload(body: unknown): body is SearchTrackingPayload {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  // query is required and must be a string
  if (typeof payload.query !== 'string') {
    return false;
  }

  // resultCount is required and must be a non-negative integer
  if (
    typeof payload.resultCount !== 'number' ||
    !Number.isInteger(payload.resultCount) ||
    payload.resultCount < 0
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

  // filters is optional but must be an object if provided
  if (payload.filters !== undefined && typeof payload.filters !== 'object') {
    return false;
  }

  return true;
}

/**
 * Normalize search query for aggregation
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

// =============================================================================
// POST - Track a search
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<SearchTrackingResponse>> {
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
      if (typeof payload.query !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid query' },
          { status: 400 }
        );
      }
      if (typeof payload.sessionId !== 'string' || payload.sessionId.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid sessionId' },
          { status: 400 }
        );
      }
      if (
        typeof payload.resultCount !== 'number' ||
        !Number.isInteger(payload.resultCount) ||
        payload.resultCount < 0
      ) {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid resultCount' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const { query, filters, resultCount, sessionId, userId } = body;

    // Normalize the query
    const queryNormalized = normalizeQuery(query);

    // Use service client to bypass RLS for insert
    const supabase = createServiceClient();

    // Insert the search record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('user_searches')
      .insert({
        query,
        query_normalized: queryNormalized,
        filters: filters || null,
        result_count: resultCount,
        session_id: sessionId,
        user_id: userId || null,
        searched_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // Check if table doesn't exist
      if (error.code === '42P01') {
        logger.warn('user_searches table not found - migration may be pending');
        return NextResponse.json({ success: true });
      }

      // Log other errors but still return success (best-effort tracking)
      logger.error('Failed to insert search record', { error, query, sessionId });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({
      success: true,
      searchId: data?.id,
    });
  } catch (error) {
    // Log the error but return success (never break UX for tracking)
    logger.logError('Search tracking API error', error);
    return NextResponse.json({ success: true });
  }
}

// =============================================================================
// PATCH - Update search with click (for CTR tracking)
// =============================================================================

interface ClickTrackingPayload {
  searchId: number;
  listingId: number;
}

function validateClickPayload(body: unknown): body is ClickTrackingPayload {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  if (
    typeof payload.searchId !== 'number' ||
    !Number.isInteger(payload.searchId) ||
    payload.searchId <= 0
  ) {
    return false;
  }

  if (
    typeof payload.listingId !== 'number' ||
    !Number.isInteger(payload.listingId) ||
    payload.listingId <= 0
  ) {
    return false;
  }

  return true;
}

export async function PATCH(request: NextRequest): Promise<NextResponse<SearchTrackingResponse>> {
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
    if (!validateClickPayload(body)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid searchId or listingId' },
        { status: 400 }
      );
    }

    const { searchId, listingId } = body;

    // Use service client to bypass RLS for update
    const supabase = createServiceClient();

    // Update the search record with the clicked listing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_searches')
      .update({
        clicked_listing_id: listingId,
        clicked_at: new Date().toISOString(),
      })
      .eq('id', searchId);

    if (error) {
      // Log error but return success (best-effort tracking)
      logger.error('Failed to update search with click', { error, searchId, listingId });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Log the error but return success (never break UX for tracking)
    logger.logError('Search click tracking API error', error);
    return NextResponse.json({ success: true });
  }
}
