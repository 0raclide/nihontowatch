import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/admin/auth';
import { apiSuccess, apiUnauthorized, apiForbidden, apiServerError } from '@/lib/api/responses';
import type { FeedbackStatus } from '@/types/feedback';

const VALID_STATUSES: FeedbackStatus[] = ['open', 'acknowledged', 'resolved', 'dismissed'];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as FeedbackStatus | null;
    const feedbackType = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    const service = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fb = () => service.from('user_feedback') as any;

    // Main query (filtered + paginated)
    let query = fb().select('*', { count: 'exact' });

    if (status && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status);
    }

    if (feedbackType) {
      query = query.eq('feedback_type', feedbackType);
    }

    // Run main query + summary counts in parallel
    const [mainResult, openResult, dataReportResult, bugResult, featureResult] = await Promise.all([
      query.order('created_at', { ascending: false }).range(offset, offset + limit - 1),
      fb().select('*', { count: 'exact', head: true }).eq('status', 'open'),
      fb().select('*', { count: 'exact', head: true }).eq('feedback_type', 'data_report'),
      fb().select('*', { count: 'exact', head: true }).eq('feedback_type', 'bug'),
      fb().select('*', { count: 'exact', head: true }).eq('feedback_type', 'feature_request'),
    ]);

    if (mainResult.error) {
      return apiServerError('Failed to fetch feedback', mainResult.error);
    }

    // Fetch user display names
    const feedbackItems = (mainResult.data || []) as Array<Record<string, unknown>>;
    const userIds = [...new Set(feedbackItems.map((f: Record<string, unknown>) => f.user_id as string))];
    let userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles } = await (service.from('profiles') as any)
        .select('id, display_name')
        .in('id', userIds);

      if (profiles) {
        userMap = Object.fromEntries(
          (profiles as Array<{ id: string; display_name: string | null }>)
            .map(p => [p.id, p.display_name || 'Unknown'])
        );
      }
    }

    const enriched = feedbackItems.map((f: Record<string, unknown>) => ({
      ...f,
      user_display_name: userMap[f.user_id as string] || 'Unknown',
    }));

    return apiSuccess({
      data: enriched,
      total: mainResult.count || 0,
      summary: {
        open: openResult.count ?? 0,
        data_reports: dataReportResult.count ?? 0,
        bugs: bugResult.count ?? 0,
        features: featureResult.count ?? 0,
      },
    });
  } catch (err) {
    return apiServerError('Failed to fetch feedback', err);
  }
}
