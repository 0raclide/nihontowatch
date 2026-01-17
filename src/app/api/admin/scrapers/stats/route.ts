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

    // Run all queries in parallel
    const [
      listingsResult,
      availableResult,
      pendingUrlsResult,
      lastRunResult,
      qaMetricsResult,
    ] = await Promise.all([
      // Total listings
      supabase.from('listings').select('id', { count: 'exact', head: true }),
      // Available listings
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('is_available', true),
      // Pending URLs (unscraped)
      supabase.from('discovered_urls').select('id', { count: 'exact', head: true }).is('scraped_at', null),
      // Last completed scrape run
      supabase
        .from('scrape_runs')
        .select('completed_at, dealers(name)')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single(),
      // QA metrics for pass rate (last 7 days)
      supabase
        .from('extraction_metrics')
        .select('qa_status')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Calculate QA pass rate
    let qaPassRate = 0;
    if (qaMetricsResult.data && qaMetricsResult.data.length > 0) {
      const total = qaMetricsResult.data.length;
      const passed = qaMetricsResult.data.filter(
        (m: any) => m.qa_status === 'passed' || m.qa_status === 'warnings'
      ).length;
      qaPassRate = Math.round((passed / total) * 100);
    }

    // Format last scrape info
    const lastScrape = {
      time: lastRunResult.data?.completed_at || null,
      dealer: (lastRunResult.data?.dealers as any)?.name || null,
    };

    return NextResponse.json({
      lastScrape,
      totalListings: listingsResult.count || 0,
      availableListings: availableResult.count || 0,
      qaPassRate,
      pendingUrls: pendingUrlsResult.count || 0,
    });
  } catch (error) {
    console.error('Scraper stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
