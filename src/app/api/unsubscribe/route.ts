import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Secret for signing unsubscribe tokens — MUST be configured in production
function getUnsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    logger.error('UNSUBSCRIBE_SECRET and CRON_SECRET not configured - unsubscribe tokens will be rejected');
  }
  return secret || '';
}
const UNSUBSCRIBE_SECRET = getUnsubscribeSecret();

/**
 * Generate an unsubscribe token
 * Token format: base64(JSON({user_id, type, saved_search_id?, timestamp})).signature
 */
export function generateUnsubscribeToken(params: {
  userId: string;
  email: string;
  type: 'all' | 'marketing' | 'saved_search';
  savedSearchId?: string;
}): string {
  const payload = {
    u: params.userId,
    e: params.email,
    t: params.type,
    s: params.savedSearchId,
    ts: Date.now(),
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Verify and decode an unsubscribe token
 */
function verifyUnsubscribeToken(token: string): {
  valid: boolean;
  payload?: {
    userId: string;
    email: string;
    type: 'all' | 'marketing' | 'saved_search';
    savedSearchId?: string;
    timestamp: number;
  };
  error?: string;
} {
  try {
    if (!UNSUBSCRIBE_SECRET) {
      return { valid: false, error: 'Token verification unavailable' };
    }

    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Invalid token format' };
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', UNSUBSCRIBE_SECRET)
      .update(payloadStr)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid token signature' };
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));

    // Check token age (valid for 30 days)
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    if (Date.now() - payload.ts > maxAge) {
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      payload: {
        userId: payload.u,
        email: payload.e,
        type: payload.t,
        savedSearchId: payload.s,
        timestamp: payload.ts,
      },
    };
  } catch {
    return { valid: false, error: 'Failed to decode token' };
  }
}

/**
 * Generate unsubscribe URL for email templates
 */
export function getUnsubscribeUrl(params: {
  userId: string;
  email: string;
  type: 'all' | 'marketing' | 'saved_search';
  savedSearchId?: string;
}): string {
  const token = generateUnsubscribeToken(params);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nihontowatch.com';
  return `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * GET /api/unsubscribe
 * One-click unsubscribe (RFC 8058 compliant)
 * Processes the unsubscribe request and redirects to confirmation page
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return redirectToPage('error', 'Missing unsubscribe token');
  }

  const verification = verifyUnsubscribeToken(token);
  if (!verification.valid || !verification.payload) {
    return redirectToPage('error', verification.error || 'Invalid token');
  }

  const { userId, email, type, savedSearchId } = verification.payload;

  try {
    const supabase = createServiceClient();

    // Verify user exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (!profile) {
      return redirectToPage('error', 'User not found');
    }

    // Process unsubscribe based on type
    switch (type) {
      case 'all':
        // Unsubscribe from all notifications
        await supabase
          .from('profiles')
          .update({ marketing_opt_out: true } as never)
          .eq('id', userId);

        // Disable all saved search notifications
        await supabase
          .from('saved_searches')
          .update({ notification_frequency: 'none' } as never)
          .eq('user_id', userId);

        return redirectToPage('success', 'all');

      case 'marketing':
        // Unsubscribe from marketing only
        await supabase
          .from('profiles')
          .update({ marketing_opt_out: true } as never)
          .eq('id', userId);

        return redirectToPage('success', 'marketing');

      case 'saved_search':
        if (!savedSearchId) {
          return redirectToPage('error', 'Missing saved search ID');
        }

        // Disable notifications for specific saved search
        const { error: updateError } = await supabase
          .from('saved_searches')
          .update({ notification_frequency: 'none' } as never)
          .eq('id', savedSearchId)
          .eq('user_id', userId);

        if (updateError) {
          logger.error('Error updating saved search', { error: updateError });
          return redirectToPage('error', 'Failed to update subscription');
        }

        return redirectToPage('success', 'saved_search');

      default:
        return redirectToPage('error', 'Invalid unsubscribe type');
    }
  } catch (error) {
    logger.logError('Unsubscribe error', error);
    return redirectToPage('error', 'An error occurred');
  }
}

/**
 * POST /api/unsubscribe
 * Alternative endpoint for form-based unsubscribe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email } = body;

    // If token provided, use token-based unsubscribe
    if (token) {
      const verification = verifyUnsubscribeToken(token);
      if (!verification.valid || !verification.payload) {
        return NextResponse.json(
          { error: verification.error || 'Invalid token' },
          { status: 400 }
        );
      }

      const { userId, type, savedSearchId } = verification.payload;
      const supabase = createServiceClient();

      switch (type) {
        case 'all':
          await supabase
            .from('profiles')
            .update({ marketing_opt_out: true } as never)
            .eq('id', userId);
          await supabase
            .from('saved_searches')
            .update({ notification_frequency: 'none' } as never)
            .eq('user_id', userId);
          break;

        case 'marketing':
          await supabase
            .from('profiles')
            .update({ marketing_opt_out: true } as never)
            .eq('id', userId);
          break;

        case 'saved_search':
          if (savedSearchId) {
            await supabase
              .from('saved_searches')
              .update({ notification_frequency: 'none' } as never)
              .eq('id', savedSearchId)
              .eq('user_id', userId);
          }
          break;
      }

      return NextResponse.json({ success: true, type });
    }

    // Email-based unsubscribe (for manual requests)
    if (email) {
      const supabase = createServiceClient();

      // Find user by email
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      const profile = profileData as { id: string } | null;

      if (!profile) {
        // Don't reveal if email exists
        return NextResponse.json({ success: true, message: 'If this email exists, it has been unsubscribed' });
      }

      // Unsubscribe from all
      await supabase
        .from('profiles')
        .update({ marketing_opt_out: true } as never)
        .eq('id', profile.id);

      await supabase
        .from('saved_searches')
        .update({ notification_frequency: 'none' } as never)
        .eq('user_id', profile.id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Token or email required' },
      { status: 400 }
    );
  } catch (error) {
    logger.logError('Unsubscribe POST error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Redirect to unsubscribe confirmation page
 */
function redirectToPage(status: 'success' | 'error', detail: string): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nihontowatch.com';
  const url = new URL(`${baseUrl}/unsubscribe`);
  url.searchParams.set('status', status);
  url.searchParams.set('detail', detail);

  return NextResponse.redirect(url.toString());
}
