/* eslint-disable @typescript-eslint/no-explicit-any */
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

    // Try to get recent scrape runs (table may not exist)
    try {
      const { data: runs, error } = await supabase
        .from('scrape_runs')
        .select('id, run_type, status, started_at, completed_at, urls_processed, errors, dealers(name)')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) {
        // Table doesn't exist or query failed
        console.log('scrape_runs table not available:', error.message);
        return NextResponse.json({ runs: [] });
      }

      // Format runs for frontend
      const formattedRuns = (runs || []).map((run: any) => ({
        id: run.id,
        dealer: run.dealers?.name || 'All Dealers',
        status: run.status,
        processed: run.urls_processed || 0,
        errors: run.errors || 0,
        startedAt: run.started_at,
      }));

      return NextResponse.json({ runs: formattedRuns });
    } catch (e) {
      // Table doesn't exist
      return NextResponse.json({ runs: [] });
    }
  } catch (error) {
    console.error('Scraper runs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
