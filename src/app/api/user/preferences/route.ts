import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Whitelist of allowed preference keys that can be set via this endpoint */
const ALLOWED_KEYS = new Set(['showAllPrices']);

/**
 * GET /api/user/preferences
 * Returns the authenticated user's preferences from their profile.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single();

    const row = profile as { preferences: Record<string, unknown> | null } | null;

    return NextResponse.json({ preferences: row?.preferences || {} });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/preferences
 * Merges partial updates into the user's preferences JSONB.
 * Only whitelisted keys are accepted.
 *
 * Body: { showAllPrices?: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate: only allow whitelisted keys
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_KEYS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid preference keys provided' }, { status: 400 });
    }

    // Validate types
    if ('showAllPrices' in updates && typeof updates.showAllPrices !== 'boolean') {
      return NextResponse.json({ error: 'showAllPrices must be a boolean' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read current preferences and merge
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single();

    const row = profile as { preferences: Record<string, unknown> | null } | null;
    const currentPrefs = row?.preferences || {};

    const { error } = await supabase
      .from('profiles')
      .update({ preferences: { ...currentPrefs, ...updates } } as never)
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, preferences: { ...currentPrefs, ...updates } });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
