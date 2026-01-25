import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import { apiUnauthorized, apiForbidden, apiServerError } from '@/lib/api/responses';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    // Use service client to bypass RLS for scraper tables
    const serviceClient = createServiceClient();

    // Get listings stats (these tables exist)
    const [listingsResult, availableResult] = await Promise.all([
      serviceClient.from('listings').select('id', { count: 'exact', head: true }),
      serviceClient.from('listings').select('id', { count: 'exact', head: true }).eq('is_available', true),
    ]);

    // Try to get scraper-specific stats (tables may not exist)
    let pendingUrls = 0;
    let lastScrape = { time: null as string | null, dealer: null as string | null };
    let qaPassRate = 0;

    try {
      const pendingResult = await serviceClient
        .from('discovered_urls')
        .select('id', { count: 'exact', head: true })
        .eq('is_scraped', false);
      if (!pendingResult.error) {
        pendingUrls = pendingResult.count || 0;
      }
    } catch {
      // Table doesn't exist, use default
    }

    try {
      const lastRunResult = await serviceClient
        .from('scrape_runs')
        .select('completed_at, dealers(name)')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single() as { data: { completed_at: string | null; dealers: { name: string } | null } | null; error: unknown };
      if (!lastRunResult.error && lastRunResult.data) {
        lastScrape = {
          time: lastRunResult.data.completed_at || null,
          dealer: lastRunResult.data.dealers?.name || null,
        };
      }
    } catch {
      // Table doesn't exist, use default
    }

    try {
      const qaResult = await serviceClient
        .from('extraction_metrics')
        .select('qa_status')
        .gte('extracted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (!qaResult.error && qaResult.data && qaResult.data.length > 0) {
        const total = qaResult.data.length;
        const passed = qaResult.data.filter(
          (m: { qa_status: string }) => m.qa_status === 'passed' || m.qa_status === 'warnings'
        ).length;
        qaPassRate = Math.round((passed / total) * 100);
      }
    } catch {
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
    logger.logError('Scraper stats error', error);
    return apiServerError();
  }
}
