/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minute timeout for scrape operations

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { dealer, limit = 50 } = body;

    // For now, just create a scrape_run record to indicate the request
    // In production, this would trigger the actual scraper via a webhook or queue
    const { data: dealerData } = dealer
      ? await supabase
          .from('dealers')
          .select('id')
          .eq('name', dealer)
          .single()
      : { data: null };

    const { data: run, error } = await supabase
      .from('scrape_runs')
      .insert({
        dealer_id: dealerData?.id || null,
        run_type: 'scrape',
        status: 'pending',
        urls_processed: 0,
        errors: 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating scrape run:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // TODO: In production, trigger actual scraper here via:
    // - GitHub Actions workflow dispatch
    // - Message queue (SQS, Redis, etc.)
    // - Direct API call to scraper service
    // For now, we just record the request

    return NextResponse.json({
      success: true,
      runId: run.id,
      message: `Scrape queued for ${dealer || 'all dealers'} (limit: ${limit})`,
    });
  } catch (error) {
    console.error('Trigger scrape error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
