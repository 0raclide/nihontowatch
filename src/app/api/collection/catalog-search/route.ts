import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getArtisanDisplayName } from '@/lib/artisan/displayName';

export const dynamic = 'force-dynamic';

const isYuhinkaiConfigured = !!(
  (process.env.YUHINKAI_SUPABASE_URL || process.env.OSHI_V2_SUPABASE_URL) &&
  (process.env.YUHINKAI_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_KEY || process.env.OSHI_V2_SUPABASE_ANON_KEY)
);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isYuhinkaiConfigured) {
      return NextResponse.json({ results: [], error: 'Yuhinkai database not configured' }, { status: 503 });
    }

    const searchParams = request.nextUrl.searchParams;
    const cert = searchParams.get('cert') || '';      // 'Juyo', 'Tokuju', etc.
    const session = searchParams.get('session');       // Volume/session number
    const q = searchParams.get('q')?.trim() || '';     // Free text (smith name)
    const nagasaStr = searchParams.get('nagasa');      // Blade length in cm
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);

    if (!cert && !q) {
      return NextResponse.json({ results: [], error: 'Provide cert or q parameter' }, { status: 400 });
    }

    const { yuhinkaiClient } = await import('@/lib/supabase/yuhinkai');

    // Step 1: Search gold_values for matching objects
    let goldQuery = yuhinkaiClient
      .from('gold_values')
      .select('object_uuid, gold_smith_id, gold_maker_id, gold_form_type, gold_nagasa, gold_sori, gold_motohaba, gold_sakihaba, gold_mei_status, gold_collections');

    // Filter by collection if cert provided
    if (cert) {
      // Map cert display names to collection names
      const collectionMap: Record<string, string> = {
        'Juyo': 'Juyo',
        'Tokuju': 'Tokuju',
        'Tokubetsu Juyo': 'Tokuju',
        'Kokuho': 'Kokuho',
        'JuBun': 'JuBun',
        'Jubi': 'Jubi',
        'Juyo Bijutsuhin': 'Jubi',
      };
      const collection = collectionMap[cert] || cert;
      goldQuery = goldQuery.contains('gold_collections', [collection]);
    }

    // Filter by smith name if q provided (search smith_entities first)
    let targetSmithIds: string[] | null = null;
    if (q && q.length >= 2) {
      const escapedQ = q.replace(/[%_\\]/g, '\\$&');
      const pattern = `%${escapedQ}%`;

      const { data: smiths } = await yuhinkaiClient
        .from('smith_entities')
        .select('smith_id')
        .or(`name_romaji.ilike.${pattern},name_kanji.ilike.${pattern},smith_id.ilike.${pattern}`)
        .limit(50);

      const { data: makers } = await yuhinkaiClient
        .from('tosogu_makers')
        .select('maker_id')
        .or(`name_romaji.ilike.${pattern},name_kanji.ilike.${pattern},maker_id.ilike.${pattern}`)
        .limit(50);

      targetSmithIds = [
        ...(smiths || []).map(s => s.smith_id),
        ...(makers || []).map(m => m.maker_id),
      ];

      if (targetSmithIds.length === 0) {
        return NextResponse.json({ results: [] });
      }

      goldQuery = goldQuery.or(
        targetSmithIds.map(id => `gold_smith_id.eq.${id}`).join(',') +
        (targetSmithIds.length > 0 ? ',' : '') +
        targetSmithIds.map(id => `gold_maker_id.eq.${id}`).join(',')
      );
    }

    const { data: goldRows, error: goldError } = await goldQuery.limit(200);

    if (goldError || !goldRows || goldRows.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Step 2: Get catalog_records for matching objects
    const uuids = goldRows.map(r => r.object_uuid as string);

    let catalogQuery = yuhinkaiClient
      .from('catalog_records')
      .select('object_uuid, collection, volume, item_number')
      .in('object_uuid', uuids);

    // Filter by session/volume if provided
    if (session) {
      catalogQuery = catalogQuery.eq('volume', Number(session));
    }

    // Filter by collection if cert provided
    if (cert) {
      const collectionMap: Record<string, string> = {
        'Juyo': 'Juyo', 'Tokuju': 'Tokuju', 'Tokubetsu Juyo': 'Tokuju',
        'Kokuho': 'Kokuho', 'JuBun': 'JuBun', 'Jubi': 'Jubi', 'Juyo Bijutsuhin': 'Jubi',
      };
      const collection = collectionMap[cert] || cert;
      catalogQuery = catalogQuery.eq('collection', collection);
    }

    const { data: catalogRecords } = await catalogQuery;

    if (!catalogRecords || catalogRecords.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Step 3: Get smith/maker names for display
    const smithIds = [...new Set(goldRows.map(r => r.gold_smith_id).filter(Boolean))] as string[];
    const makerIds = [...new Set(goldRows.map(r => r.gold_maker_id).filter(Boolean))] as string[];

    const [{ data: smithEntities }, { data: tosoguMakers }] = await Promise.all([
      smithIds.length > 0
        ? yuhinkaiClient.from('smith_entities').select('smith_id, name_romaji, school, province, era').in('smith_id', smithIds)
        : Promise.resolve({ data: [] }),
      makerIds.length > 0
        ? yuhinkaiClient.from('tosogu_makers').select('maker_id, name_romaji, school, province, era').in('maker_id', makerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const nameMap = new Map<string, { name: string | null; school: string | null; province: string | null; era: string | null }>();
    for (const s of smithEntities || []) {
      nameMap.set(s.smith_id, { name: s.name_romaji, school: s.school, province: s.province, era: s.era });
    }
    for (const m of tosoguMakers || []) {
      nameMap.set(m.maker_id, { name: m.name_romaji, school: m.school, province: m.province, era: m.era });
    }

    // Step 4: Build catalog UUID -> gold_values map
    const goldByUuid = new Map(goldRows.map(r => [r.object_uuid as string, r]));

    // Build results
    const results = catalogRecords.map(cr => {
      const gold = goldByUuid.get(cr.object_uuid);
      if (!gold) return null;

      const artisanId = (gold.gold_smith_id || gold.gold_maker_id) as string | null;
      const artisanInfo = artisanId ? nameMap.get(artisanId) : null;

      return {
        object_uuid: cr.object_uuid,
        collection: cr.collection,
        volume: cr.volume,
        item_number: cr.item_number,
        smith_id: artisanId,
        smith_name: artisanInfo ? getArtisanDisplayName(artisanInfo.name, artisanInfo.school) : null,
        smith_school: artisanInfo?.school || null,
        form_type: gold.gold_form_type as string | null,
        nagasa: gold.gold_nagasa ? (gold.gold_nagasa as number) / 10 : null,   // Convert mm -> cm
        sori: gold.gold_sori ? (gold.gold_sori as number) / 10 : null,
        motohaba: gold.gold_motohaba ? (gold.gold_motohaba as number) / 10 : null,
        sakihaba: gold.gold_sakihaba ? (gold.gold_sakihaba as number) / 10 : null,
        mei_status: gold.gold_mei_status as string | null,
        province: artisanInfo?.province || null,
        era: artisanInfo?.era || null,
      };
    }).filter(Boolean);

    // Filter by nagasa proximity if provided
    let filteredResults = results;
    if (nagasaStr) {
      const targetNagasa = parseFloat(nagasaStr);
      if (!isNaN(targetNagasa)) {
        filteredResults = results.filter(r => {
          if (!r || !r.nagasa) return false;
          return Math.abs(r.nagasa - targetNagasa) <= 1.0; // +/- 1.0 cm tolerance
        });
        // Sort by nagasa proximity
        filteredResults.sort((a, b) => {
          const da = Math.abs((a?.nagasa || 0) - targetNagasa);
          const db = Math.abs((b?.nagasa || 0) - targetNagasa);
          return da - db;
        });
      }
    }

    return NextResponse.json({
      results: filteredResults.slice(0, limit),
      total: filteredResults.length,
    });
  } catch (error) {
    logger.logError('Catalog search error', error);
    return NextResponse.json({ results: [], error: 'Internal server error' }, { status: 500 });
  }
}
