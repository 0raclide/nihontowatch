import { createClient } from '@/lib/supabase/server';
import { verifyDealer } from '@/lib/dealer/auth';
import { yuhinkaiClient, yuhinkaiConfigured, IMAGE_STORAGE_BASE, buildStoragePaths } from '@/lib/supabase/yuhinkai';
import type { CatalogMatchItem, CatalogMatchResponse } from '@/types/catalog';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await verifyDealer(supabase);
  if (!auth.isDealer) {
    return NextResponse.json(
      { error: auth.error === 'unauthorized' ? 'Not authenticated' : 'Not a dealer' },
      { status: auth.error === 'unauthorized' ? 401 : 403 }
    );
  }

  if (!yuhinkaiConfigured) {
    return NextResponse.json(
      { error: 'Catalog service unavailable' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const artisanCode = searchParams.get('artisan_code');
  const collection = searchParams.get('collection');

  if (!artisanCode || !collection) {
    return NextResponse.json(
      { error: 'artisan_code and collection are required' },
      { status: 400 }
    );
  }

  try {
    const rpcParams: Record<string, unknown> = {
      p_artisan_code: artisanCode,
      p_collection: collection,
      p_limit: 100,
    };

    const { data, error } = await yuhinkaiClient.rpc('search_catalog', rpcParams);

    if (error) {
      console.error('[catalog-match] RPC error:', error);
      return NextResponse.json({ error: 'Catalog search failed' }, { status: 500 });
    }

    const result = data as { total: number; items: Record<string, unknown>[]; volumes: Array<{ volume: number; count: number }> } | null;
    if (!result) {
      return NextResponse.json({ total: 0, items: [], volumes: [] } satisfies CatalogMatchResponse);
    }

    // Transform items: mm→cm conversion, build all candidate image URLs
    const items: CatalogMatchItem[] = (result.items || []).map((row) => {
      const vol = row.volume as number;
      const itemNum = row.item_number as number;
      const col = row.collection as string;

      // Build all candidate image URLs in priority order
      const paths = buildStoragePaths(col, vol, itemNum);
      const imageUrls = paths.map(p => `${IMAGE_STORAGE_BASE}/storage/v1/object/public/images/${p.path}`);

      // gold_values stores measurements already in cm — no conversion needed
      const toNum = (v: unknown): number | null => {
        if (v == null) return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      return {
        object_uuid: row.object_uuid as string,
        collection: col,
        volume: vol,
        item_number: itemNum,
        image_urls: imageUrls,
        form_type: (row.gold_form_type as string | null) || null,
        nagasa_cm: toNum(row.gold_nagasa),
        sori_cm: toNum(row.gold_sori),
        motohaba_cm: toNum(row.gold_motohaba),
        sakihaba_cm: toNum(row.gold_sakihaba),
        mei_status: (row.gold_mei_status as string | null) || null,
        period: (row.gold_period as string | null) || null,
        artisan_kanji: (row.gold_artisan_kanji as string | null) || null,
        item_type: (row.gold_item_type as string | null) || null,
      };
    });

    const response: CatalogMatchResponse = {
      total: result.total || 0,
      items,
      volumes: result.volumes || [],
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[catalog-match] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
