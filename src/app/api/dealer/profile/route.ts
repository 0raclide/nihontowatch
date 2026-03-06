import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { computeProfileCompleteness } from '@/lib/dealer/profileCompleteness';
import { SPECIALIZATION_VALUES } from '@/lib/dealer/specializations';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = new Set([
  // Existing editable fields
  'contact_email', 'contact_page_url', 'sales_policy_url',
  'ships_international', 'accepts_wire_transfer', 'accepts_paypal', 'accepts_credit_card',
  'requires_deposit', 'deposit_percentage', 'english_support',
  // New profile fields
  'logo_url', 'banner_url', 'accent_color',
  'bio_en', 'bio_ja', 'founded_year', 'shop_photo_url', 'specializations',
  'phone', 'line_id', 'instagram_url', 'facebook_url',
  'address', 'city', 'postal_code', 'address_visible',
  'memberships', 'return_policy',
]);

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/**
 * GET /api/dealer/profile
 * Fetch the dealer's full profile data + completeness score.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json(
        { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
        { status: auth.error === 'unauthorized' ? 401 : 403 }
      );
    }

    const serviceClient = createServiceClient();
    const { data: dealer, error } = await serviceClient
      .from('dealers')
      .select('*')
      .eq('id', auth.dealerId)
      .single();

    if (error || !dealer) {
      return NextResponse.json({ error: 'Dealer not found' }, { status: 404 });
    }

    const profileCompleteness = computeProfileCompleteness(dealer);

    return NextResponse.json({ dealer, profileCompleteness });
  } catch (error) {
    logger.logError('Dealer profile GET error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/dealer/profile
 * Update dealer profile fields. Only ALLOWED_FIELDS accepted.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await verifyDealer(supabase);
    if (!auth.isDealer) {
      return NextResponse.json(
        { error: auth.error === 'unauthorized' ? 'Unauthorized' : 'Forbidden' },
        { status: auth.error === 'unauthorized' ? 401 : 403 }
      );
    }

    const body = await request.json();

    // Filter to allowed fields only
    const updates: Record<string, unknown> = {};
    for (const key of Object.keys(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Validate specific fields
    if ('accent_color' in updates && updates.accent_color !== null) {
      if (typeof updates.accent_color !== 'string' || !HEX_COLOR_REGEX.test(updates.accent_color)) {
        return NextResponse.json({ error: 'accent_color must be a valid hex color (e.g. #c4a35a)' }, { status: 400 });
      }
    }

    if ('founded_year' in updates && updates.founded_year !== null) {
      const year = Number(updates.founded_year);
      if (!Number.isInteger(year) || year < 1600 || year > 2026) {
        return NextResponse.json({ error: 'founded_year must be between 1600 and 2026' }, { status: 400 });
      }
      updates.founded_year = year;
    }

    if ('specializations' in updates && updates.specializations !== null) {
      if (!Array.isArray(updates.specializations)) {
        return NextResponse.json({ error: 'specializations must be an array' }, { status: 400 });
      }
      for (const s of updates.specializations as string[]) {
        if (!SPECIALIZATION_VALUES.has(s)) {
          return NextResponse.json({ error: `Invalid specialization: ${s}` }, { status: 400 });
        }
      }
    }

    if ('deposit_percentage' in updates && updates.deposit_percentage !== null) {
      const pct = Number(updates.deposit_percentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: 'deposit_percentage must be 0-100' }, { status: 400 });
      }
      updates.deposit_percentage = pct;
    }

    // Normalize bare instagram handles to full URLs
    if ('instagram_url' in updates && updates.instagram_url) {
      const raw = (updates.instagram_url as string).trim();
      if (raw && !raw.startsWith('http')) {
        const handle = raw.replace(/^@/, '');
        updates.instagram_url = `https://www.instagram.com/${handle}`;
      }
    }

    const serviceClient = createServiceClient();
    const { data: dealer, error } = await (serviceClient.from('dealers') as any)
      .update(updates)
      .eq('id', auth.dealerId)
      .select('*')
      .single();

    if (error) {
      logger.error('Dealer profile PATCH error', { error, dealerId: auth.dealerId });
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    const profileCompleteness = computeProfileCompleteness(dealer);

    return NextResponse.json({ dealer, profileCompleteness });
  } catch (error) {
    logger.logError('Dealer profile PATCH error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
