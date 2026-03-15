import { createClient } from '@/lib/supabase/server';
import { checkCollectionAccess } from '@/lib/collection/access';
import { yuhinkaiClient, yuhinkaiConfigured } from '@/lib/supabase/yuhinkai';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_RESULTS = 15;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const accessDenied = await checkCollectionAccess(supabase, user.id);
    if (accessDenied) return accessDenied;

    if (!yuhinkaiConfigured) {
      return NextResponse.json({ results: [] });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const q = searchParams.get('q')?.trim();

    if (!type || !q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    if (type === 'provenance') {
      const { data, error } = await yuhinkaiClient
        .from('denrai_canonical_names')
        .select('canonical_name, name_ja, category')
        .or(`canonical_name.ilike.%${q}%,name_ja.ilike.%${q}%`)
        .limit(MAX_RESULTS);

      if (error) {
        return NextResponse.json({ results: [] });
      }

      return NextResponse.json({
        results: (data || []).map(row => ({
          name: row.canonical_name,
          name_ja: row.name_ja || null,
          category: row.category || null,
        })),
      });
    }

    if (type === 'kiwame') {
      const { data, error } = await yuhinkaiClient
        .rpc('search_kiwame_appraisers', { search_term: q, result_limit: MAX_RESULTS });

      if (error) {
        // Fallback: simple query if RPC doesn't exist
        const { data: fallbackData } = await yuhinkaiClient
          .from('gold_values')
          .select('gold_kiwame_appraisers')
          .not('gold_kiwame_appraisers', 'is', null)
          .limit(200);

        if (fallbackData) {
          const allAppraisers = new Set<string>();
          for (const row of fallbackData) {
            const appraisers = row.gold_kiwame_appraisers as string[];
            if (Array.isArray(appraisers)) {
              for (const a of appraisers) {
                if (a.toLowerCase().includes(q.toLowerCase())) {
                  allAppraisers.add(a);
                }
              }
            }
          }
          return NextResponse.json({
            results: [...allAppraisers].slice(0, MAX_RESULTS).map(name => ({
              name,
              name_ja: null,
              category: null,
            })),
          });
        }

        return NextResponse.json({ results: [] });
      }

      return NextResponse.json({
        results: (data || []).map((row: { appraiser_name: string }) => ({
          name: row.appraiser_name,
          name_ja: null,
          category: null,
        })),
      });
    }

    return NextResponse.json({ results: [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
