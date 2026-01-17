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

    // Try to get extraction metrics (table may not exist)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: metrics, error } = await supabase
        .from('extraction_metrics')
        .select('dealer_id, qa_status, validation_errors, dealers(name)')
        .gte('created_at', sevenDaysAgo);

      if (error) {
        // Table doesn't exist or query failed
        console.log('extraction_metrics table not available:', error.message);
        return NextResponse.json({ issues: [] });
      }

      // Aggregate by dealer
      const dealerStats: Record<string, {
        name: string;
        total: number;
        passed: number;
        errorCounts: Record<string, number>;
      }> = {};

      for (const metric of (metrics || []) as any[]) {
        const dealerName = metric.dealers?.name || 'Unknown';
        const dealerId = metric.dealer_id;

        if (!dealerStats[dealerId]) {
          dealerStats[dealerId] = {
            name: dealerName,
            total: 0,
            passed: 0,
            errorCounts: {},
          };
        }

        dealerStats[dealerId].total++;

        if (metric.qa_status === 'passed' || metric.qa_status === 'warnings') {
          dealerStats[dealerId].passed++;
        }

        // Count errors by field
        if (metric.validation_errors && Array.isArray(metric.validation_errors)) {
          for (const err of metric.validation_errors) {
            const field = err.field || 'unknown';
            dealerStats[dealerId].errorCounts[field] =
              (dealerStats[dealerId].errorCounts[field] || 0) + 1;
          }
        }
      }

      // Format issues list, sorted by worst pass rate
      const issues = Object.values(dealerStats)
        .map((stat) => {
          const passRate = stat.total > 0 ? (stat.passed / stat.total) * 100 : 100;

          // Find top error field
          let topIssue: string | null = null;
          let maxErrors = 0;
          for (const [field, count] of Object.entries(stat.errorCounts)) {
            if (count > maxErrors) {
              maxErrors = count;
              topIssue = `${field} errors (${count})`;
            }
          }

          return {
            dealer: stat.name,
            total: stat.total,
            passed: stat.passed,
            passRate: Math.round(passRate * 10) / 10,
            topIssue,
          };
        })
        .filter((issue) => issue.passRate < 100) // Only show dealers with issues
        .sort((a, b) => a.passRate - b.passRate); // Worst first

      return NextResponse.json({ issues });
    } catch (e) {
      // Table doesn't exist
      return NextResponse.json({ issues: [] });
    }
  } catch (error) {
    console.error('Scraper QA error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
