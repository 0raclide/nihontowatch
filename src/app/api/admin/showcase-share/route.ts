import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const SYSTEM_STATE_KEY = 'showcase_share_token';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

/**
 * GET /api/admin/showcase-share
 * Returns the current showcase share token (or null if none exists).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);
    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized'
        ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = createServiceClient();
    const { data } = await serviceClient
      .from('system_state')
      .select('value')
      .eq('key', SYSTEM_STATE_KEY)
      .single() as { data: { value: string } | null };

    if (!data) {
      return NextResponse.json({ token: null, url: null });
    }

    return NextResponse.json({
      token: data.value,
      url: `${BASE_URL}/showcase/public/${data.value}`,
    });
  } catch (error) {
    logger.logError('GET /api/admin/showcase-share error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/showcase-share
 * Generates a new UUID v4 token, upserts into system_state.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);
    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized'
        ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = randomUUID();
    const serviceClient = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (serviceClient.from('system_state') as any)
      .upsert(
        { key: SYSTEM_STATE_KEY, value: token, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      logger.error('[showcase-share] Upsert error:', { error });
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }

    return NextResponse.json({
      token,
      url: `${BASE_URL}/showcase/public/${token}`,
    });
  } catch (error) {
    logger.logError('POST /api/admin/showcase-share error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/showcase-share
 * Revokes the current token by deleting it from system_state.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);
    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized'
        ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        : NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = createServiceClient();
    await serviceClient
      .from('system_state')
      .delete()
      .eq('key', SYSTEM_STATE_KEY);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError('DELETE /api/admin/showcase-share error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
