import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiBadRequest, apiUnauthorized, apiRateLimited, apiServerError } from '@/lib/api/responses';
import { sendFeedbackAdminNotification } from '@/lib/email/sendgrid';
import type { FeedbackType, FeedbackTargetType } from '@/types/feedback';

const VALID_FEEDBACK_TYPES: FeedbackType[] = ['data_report', 'bug', 'feature_request', 'other'];
const VALID_TARGET_TYPES: FeedbackTargetType[] = ['listing', 'artist'];
const MAX_MESSAGE_LENGTH = 2000;
const RATE_LIMIT_PER_HOUR = 10;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiUnauthorized('You must be logged in to submit feedback');
    }

    const body = await request.json();
    const { feedback_type, target_type, target_id, target_label, message, page_url } = body;

    // Validate feedback_type
    if (!feedback_type || !VALID_FEEDBACK_TYPES.includes(feedback_type)) {
      return apiBadRequest('Invalid feedback type');
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return apiBadRequest('Message is required');
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return apiBadRequest(`Message must be under ${MAX_MESSAGE_LENGTH} characters`);
    }

    // Validate target_type if provided
    if (target_type && !VALID_TARGET_TYPES.includes(target_type)) {
      return apiBadRequest('Invalid target type');
    }

    // Rate limit: max N submissions per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await (supabase
      .from('user_feedback') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (count !== null && count >= RATE_LIMIT_PER_HOUR) {
      return apiRateLimited(3600);
    }

    // Insert feedback (RLS allows insert where auth.uid() = user_id)
    const { data, error } = await (supabase
      .from('user_feedback') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        user_id: user.id,
        feedback_type,
        target_type: target_type || null,
        target_id: target_id ? String(target_id) : null,
        target_label: target_label || null,
        message: message.trim(),
        page_url: page_url || null,
      })
      .select('id, status')
      .single();

    if (error) {
      return apiServerError('Failed to submit feedback', error);
    }

    // Send admin email notification (best-effort, don't fail the request)
    try {
      const service = createServiceClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (service.from('profiles') as any)
        .select('display_name')
        .eq('id', user.id)
        .single();
      const displayName = profile?.display_name || user.email || 'Unknown';

      await sendFeedbackAdminNotification({
        feedback_type,
        target_type: target_type || null,
        target_id: target_id ? String(target_id) : null,
        target_label: target_label || null,
        message: message.trim(),
        page_url: page_url || null,
        user_display_name: displayName,
      });
    } catch (emailErr) {
      console.error('Failed to send admin feedback notification:', emailErr);
    }

    return apiSuccess({ id: data.id, status: data.status });
  } catch (err) {
    return apiServerError('Failed to submit feedback', err);
  }
}
