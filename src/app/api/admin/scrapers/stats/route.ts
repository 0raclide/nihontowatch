/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  if (profile?.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }

  return { user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get listings stats (these tables exist)
    const [listingsResult, availableResult] = await Promise.all([
      supabase.from('listings').select('id', { count: 'exact', head: true }),
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('is_available', true),
    ]);

    // Try to get scraper-specific stats (tables may not exist)
    let pendingUrls = 0;
    let lastScrape = { time: null as string | null, dealer: null as string | null };
    let qaPassRate = 0;

    try {
      const pendingResult = await supabase
        .from('discovered_urls')
        .select('id', { count: 'exact', head: true })
        .eq('is_scraped', false);
      if (!pendingResult.error) {
        pendingUrls = pendingResult.count || 0;
      }
    } catch (e) {
      // Table doesn't exist, use default
    }

    try {
      const lastRunResult = await supabase
        .from('scrape_runs')
        .select('completed_at, dealers(name)')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      if (!lastRunResult.error && lastRunResult.data) {
        lastScrape = {
          time: lastRunResult.data.completed_at || null,
          dealer: (lastRunResult.data.dealers as any)?.name || null,
        };
      }
    } catch (e) {
      // Table doesn't exist, use default
    }

    try {
      const qaResult = await supabase
        .from('extraction_metrics')
        .select('qa_status')
        .gte('extracted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (!qaResult.error && qaResult.data && qaResult.data.length > 0) {
        const total = qaResult.data.length;
        const passed = qaResult.data.filter(
          (m: any) => m.qa_status === 'passed' || m.qa_status === 'warnings'
        ).length;
        qaPassRate = Math.round((passed / total) * 100);
      }
    } catch (e) {
      // Table doesn't exist, use default
    }

    return NextResponse.json({
      lastScrape,
      totalListings: listingsResult.count || 0,
      availableListings: availableResult.count || 0,
      qaPassRate,
      pendingUrls,
    });
  } catch (error) {
    console.error('Scraper stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
