import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { collectionItemsFrom } from '@/lib/supabase/collectionItems';
import { normalizeProvenance } from '@/lib/provenance/normalize';
import { getArtisanNames } from '@/lib/supabase/yuhinkai';
import { getArtisanDisplayName, getArtisanDisplayNameKanji, getArtisanAlias } from '@/lib/artisan/displayName';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const SYSTEM_STATE_KEY = 'showcase_share_token';

/**
 * GET /api/showcase/public?token={token}&page=1&limit=50
 *
 * Public (no auth) endpoint that validates a share token and returns
 * showcase items. Returns 403 if the token is invalid or revoked.
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Validate token against system_state (no caching → instant revocation)
    const serviceClient = createServiceClient();
    const { data: tokenRow } = await serviceClient
      .from('system_state')
      .select('value')
      .eq('key', SYSTEM_STATE_KEY)
      .single() as { data: { value: string } | null };

    if (!tokenRow || tokenRow.value !== token) {
      return NextResponse.json({ error: 'Invalid or expired share link' }, { status: 403 });
    }

    // Parse pagination
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || PAGE_SIZE));

    // Query showcase items — both 'collectors' and 'dealers' visibility (same as admin view)
    let query = collectionItemsFrom(serviceClient)
      .select('*', { count: 'exact' })
      .in('visibility', ['collectors', 'dealers']);

    // Sort: newest first
    query = query.order('created_at', { ascending: false });

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: items, error, count } = await query;

    if (error) {
      logger.error('[showcase/public] Query error:', { error });
      return NextResponse.json({ error: 'Failed to fetch showcase items' }, { status: 500 });
    }

    // Fetch profiles for unique owner_ids
    const ownerIds = [...new Set((items || []).map((i: { owner_id: string }) => i.owner_id))];
    const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
    if (ownerIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', ownerIds) as { data: Array<{ id: string; display_name: string | null; avatar_url: string | null }> | null };
      for (const p of profiles || []) {
        profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
      }
    }

    // Enrich artisan display names from Yuhinkai
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artisanCodes = [...new Set((items || []).map((i: any) => i.artisan_id).filter(Boolean))] as string[];
    let artisanNamesObj: Record<string, { name_romaji: string | null; name_kanji: string | null; school: string | null }> = {};
    if (artisanCodes.length > 0) {
      try {
        const artisanNameMap = await getArtisanNames(artisanCodes);
        artisanNamesObj = Object.fromEntries(artisanNameMap);
      } catch (err) {
        logger.warn('Failed to fetch artisan names for public showcase', { error: err });
      }
    }

    // Merge profile data + normalize provenance + enrich artisan names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = (items || []).map((item: any) => {
      const artisanId = item.artisan_id as string | null;
      const entry = artisanId ? artisanNamesObj[artisanId] : null;
      return {
        ...item,
        provenance: normalizeProvenance(item.provenance),
        profiles: profileMap.get(item.owner_id) || null,
        artisan_display_name: entry
          ? (getArtisanAlias(artisanId!) || getArtisanDisplayName(entry.name_romaji ?? null, entry.school ?? null, artisanId!) || null)
          : null,
        artisan_name_kanji: entry
          ? (getArtisanDisplayNameKanji(entry.name_kanji ?? null, artisanId!) || null)
          : null,
      };
    });

    return NextResponse.json({
      data: enriched,
      total: count || 0,
      page,
      limit,
      artisanNames: artisanNamesObj,
    });
  } catch (error) {
    logger.logError('Public showcase GET error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
