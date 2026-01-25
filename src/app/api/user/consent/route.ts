import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';
import type { ConsentRecord, ConsentHistoryInsert } from '@/lib/consent/types';

export const dynamic = 'force-dynamic';

/**
 * Hash IP address for audit logging (privacy-preserving)
 */
function hashString(str: string): string {
  // Simple hash - in production, consider using crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Get client IP from request headers
 */
function getClientIP(headersList: Headers): string | null {
  // Check various headers (Vercel, Cloudflare, etc.)
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return (
    headersList.get('x-real-ip') ||
    headersList.get('x-vercel-forwarded-for') ||
    null
  );
}

/**
 * GET /api/user/consent
 * Get current consent preferences for authenticated user
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile with consent preferences
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('consent_preferences, consent_updated_at, marketing_opt_out')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logger.error('Error fetching consent', { error: profileError });
      return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 });
    }

    // Cast profile data since TypeScript types may not have new columns yet
    const profile = profileData as {
      consent_preferences: Record<string, unknown> | null;
      consent_updated_at: string | null;
      marketing_opt_out: boolean | null;
    } | null;

    return NextResponse.json({
      consent: profile?.consent_preferences,
      updatedAt: profile?.consent_updated_at,
      marketingOptOut: profile?.marketing_opt_out,
    });
  } catch (error) {
    logger.logError('Consent GET error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/user/consent
 * Save consent preferences for authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const headersList = await headers();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { consent } = body as { consent: ConsentRecord };

    if (!consent || !consent.preferences) {
      return NextResponse.json({ error: 'Invalid consent data' }, { status: 400 });
    }

    // Validate consent structure
    if (typeof consent.preferences.essential !== 'boolean' ||
        typeof consent.preferences.functional !== 'boolean' ||
        typeof consent.preferences.analytics !== 'boolean' ||
        typeof consent.preferences.marketing !== 'boolean') {
      return NextResponse.json({ error: 'Invalid consent preferences' }, { status: 400 });
    }

    // Get IP and user agent for audit trail
    const clientIP = getClientIP(headersList);
    const userAgent = headersList.get('user-agent') || '';
    const ipHash = clientIP ? hashString(`nihontowatch_salt_${clientIP}`) : null;
    const userAgentHash = userAgent ? hashString(userAgent) : null;

    // Update profile with current consent
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        consent_preferences: consent.preferences,
        consent_updated_at: consent.timestamp,
        marketing_opt_out: !consent.preferences.marketing,
      } as never)
      .eq('id', user.id);

    if (updateError) {
      logger.error('Error updating consent', { error: updateError });
      return NextResponse.json({ error: 'Failed to save consent' }, { status: 500 });
    }

    // Log consent change to history (audit trail)
    const historyRecord: ConsentHistoryInsert = {
      user_id: user.id,
      preferences: consent.preferences,
      version: consent.version,
      method: consent.method,
      ip_hash: ipHash,
    };

    const { error: historyError } = await supabase
      .from('user_consent_history')
      .insert(historyRecord as never);

    if (historyError) {
      // Don't fail the request, just log the error
      logger.error('Error logging consent history', { error: historyError });
    }

    return NextResponse.json({
      success: true,
      consent: {
        preferences: consent.preferences,
        timestamp: consent.timestamp,
        version: consent.version,
      },
    });
  } catch (error) {
    logger.logError('Consent POST error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/user/consent
 * Reset consent to defaults (revoke all non-essential)
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const headersList = await headers();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const defaultPreferences = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false,
    };

    // Get IP for audit trail
    const clientIP = getClientIP(headersList);
    const ipHash = clientIP ? hashString(`nihontowatch_salt_${clientIP}`) : null;

    // Update profile to revoke consent
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        consent_preferences: defaultPreferences,
        consent_updated_at: now,
        marketing_opt_out: true,
      } as never)
      .eq('id', user.id);

    if (updateError) {
      logger.error('Error revoking consent', { error: updateError });
      return NextResponse.json({ error: 'Failed to revoke consent' }, { status: 500 });
    }

    // Log revocation to history
    const { error: historyError } = await supabase
      .from('user_consent_history')
      .insert({
        user_id: user.id,
        preferences: defaultPreferences,
        version: '1.0',
        method: 'api',
        ip_hash: ipHash,
      } as never);

    if (historyError) {
      logger.error('Error logging consent revocation', { error: historyError });
    }

    return NextResponse.json({
      success: true,
      message: 'Consent revoked successfully',
    });
  } catch (error) {
    logger.logError('Consent DELETE error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
