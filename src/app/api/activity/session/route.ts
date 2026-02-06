import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type {
  CreateSessionPayload,
  EndSessionPayload,
  SessionPayload,
} from '@/lib/activity/types';

export const dynamic = 'force-dynamic';

// =============================================================================
// Validation
// =============================================================================

function isCreatePayload(body: SessionPayload): body is CreateSessionPayload {
  return body.action === 'create';
}

function isEndPayload(body: SessionPayload): body is EndSessionPayload {
  return body.action === 'end';
}

function validatePayload(body: unknown): body is SessionPayload {
  if (!body || typeof body !== 'object') return false;

  const payload = body as Record<string, unknown>;

  // Action required
  if (!payload.action || !['create', 'end'].includes(payload.action as string)) {
    return false;
  }

  // Session ID required
  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    return false;
  }

  return true;
}

// =============================================================================
// POST - Create a new session
// =============================================================================

export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { success: false, error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Handle 'create' action - create new session
    if (isCreatePayload(body)) {
      const {
        sessionId,
        userAgent,
        screenWidth,
        screenHeight,
        timezone,
        language,
      } = body;

      // Insert session into database using service client to bypass RLS
      // Note: id is auto-generated UUID, session_id is the TEXT identifier we track
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('user_sessions').insert({
        session_id: sessionId,
        // user_id left null for anonymous sessions (requires migration to allow NULL)
        started_at: new Date().toISOString(),
        page_views: 0,
        user_agent: userAgent || null,
        screen_width: screenWidth || null,
        screen_height: screenHeight || null,
        timezone: timezone || null,
        language: language || null,
      });

      if (error) {
        // Log error but don't fail - session tracking is best-effort
        logger.error('Failed to create session', { error, sessionId });

        // Check if table doesn't exist
        if (error.code === '42P01') {
          return NextResponse.json({
            success: true,
            sessionId,
            warning: 'Sessions table not configured',
          });
        }

        // Check for duplicate session (ignore - might be refresh)
        if (error.code === '23505') {
          return NextResponse.json({
            success: true,
            sessionId,
            existing: true,
          });
        }
      }

      return NextResponse.json({
        success: true,
        sessionId,
      });
    }

    // Handle 'end' action - update session with duration
    // Note: sendBeacon (used on page unload) can only send POST requests,
    // so we must handle session ending here as well as in PATCH
    if (isEndPayload(body)) {
      const {
        sessionId,
        endedAt,
        totalDurationMs,
        pageViews,
      } = body;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('user_sessions')
        .update({
          ended_at: endedAt,
          total_duration_ms: totalDurationMs,
          page_views: pageViews,
        })
        .eq('session_id', sessionId);

      if (error) {
        // Log error but don't fail - session tracking is best-effort
        logger.error('Failed to end session', { error, sessionId });

        // Check if table doesn't exist
        if (error.code === '42P01') {
          return NextResponse.json({
            success: true,
            sessionId,
            warning: 'Sessions table not configured',
          });
        }
      }

      return NextResponse.json({
        success: true,
        sessionId,
      });
    }

    // Should not reach here due to validatePayload, but handle gracefully
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    logger.logError('Session API error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - End/update a session
// =============================================================================

export async function PATCH(request: NextRequest) {
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
      return NextResponse.json(
        { success: false, error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    if (!isEndPayload(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action for PATCH' },
        { status: 400 }
      );
    }

    const {
      sessionId,
      endedAt,
      totalDurationMs,
      pageViews,
    } = body;

    // Update session in database using service client to bypass RLS
    const supabase = createServiceClient();

    // Use type assertion since user_sessions table may not be in generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('user_sessions')
      .update({
        ended_at: endedAt,
        total_duration_ms: totalDurationMs,
        page_views: pageViews,
      })
      .eq('session_id', sessionId);

    if (error) {
      // Log error but don't fail - session tracking is best-effort
      logger.error('Failed to end session', { error, sessionId });

      // Check if table doesn't exist
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          sessionId,
          warning: 'Sessions table not configured',
        });
      }
    }

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error) {
    logger.logError('Session end API error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
