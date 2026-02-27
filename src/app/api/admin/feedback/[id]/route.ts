import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/admin/auth';
import { apiSuccess, apiBadRequest, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from '@/lib/api/responses';
import type { FeedbackStatus } from '@/types/feedback';

const VALID_STATUSES: FeedbackStatus[] = ['open', 'acknowledged', 'resolved', 'dismissed'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const { id } = await params;
    const feedbackId = parseInt(id, 10);
    if (isNaN(feedbackId)) {
      return apiBadRequest('Invalid feedback ID');
    }

    const body = await request.json();
    const { status, admin_notes } = body;

    // Build update object
    const updates: Record<string, unknown> = {};

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return apiBadRequest('Invalid status');
      }
      updates.status = status;

      // Set resolved_by and resolved_at when closing
      if (status === 'resolved' || status === 'dismissed') {
        updates.resolved_by = authResult.user.id;
        updates.resolved_at = new Date().toISOString();
      } else {
        updates.resolved_by = null;
        updates.resolved_at = null;
      }
    }

    if (admin_notes !== undefined) {
      updates.admin_notes = admin_notes;
    }

    if (Object.keys(updates).length === 0) {
      return apiBadRequest('No fields to update');
    }

    const service = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (service.from('user_feedback') as any)
      .update(updates)
      .eq('id', feedbackId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return apiNotFound('Feedback');
      }
      return apiServerError('Failed to update feedback', error);
    }

    return apiSuccess(data);
  } catch (err) {
    return apiServerError('Failed to update feedback', err);
  }
}
