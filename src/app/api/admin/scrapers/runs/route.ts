/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import { apiUnauthorized, apiForbidden } from '@/lib/api/responses';

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

    // Try to get recent scrape runs (table may not exist)
    try {
      const { data: runs, error } = await serviceClient
        .from('scrape_runs')
        .select('id, run_type, status, started_at, completed_at, urls_processed, new_listings, updated_listings, errors, error_message, dealers(name)')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) {
        // Table doesn't exist or query failed
        logger.info('scrape_runs table not available', { error: error.message });
        return NextResponse.json({ runs: [] });
      }

      // Format runs for frontend
      const formattedRuns = (runs || []).map((run: any) => ({
        id: run.id,
        runType: run.run_type,
        dealer: run.dealers?.name || 'All Dealers',
        status: run.status,
        processed: run.urls_processed || 0,
        newListings: run.new_listings || 0,
        updatedListings: run.updated_listings || 0,
        errors: run.errors || 0,
        errorMessage: run.error_message || null,
        startedAt: run.started_at,
        completedAt: run.completed_at,
      }));

      return NextResponse.json({ runs: formattedRuns });
    } catch (e) {
      // Table doesn't exist
      return NextResponse.json({ runs: [] });
    }
  } catch (error) {
    logger.logError('Scraper runs error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
