import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface DeleteAccountRequest {
  confirmEmail: string;
  reason?: 'privacy' | 'not_using' | 'switching_service' | 'other';
  feedback?: string;
}

/**
 * POST /api/user/delete-account
 * Request account deletion (GDPR right to erasure)
 *
 * Process:
 * 1. Verify user identity (email confirmation)
 * 2. Log deletion request for compliance
 * 3. Delete user data from all tables
 * 4. Delete auth user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    const body: DeleteAccountRequest = await request.json();

    if (!body.confirmEmail) {
      return NextResponse.json(
        { error: 'Email confirmation required' },
        { status: 400 }
      );
    }

    // Verify email matches
    if (body.confirmEmail.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match account email' },
        { status: 400 }
      );
    }

    // Get user profile to check for subscription
    const { data: profileData } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .single();

    // Cast profile data since TypeScript types may not match
    const profile = profileData as {
      stripe_subscription_id: string | null;
      subscription_status: string | null;
    } | null;

    // Check if user has an active subscription
    if (profile?.stripe_subscription_id && profile.subscription_status === 'active') {
      return NextResponse.json(
        {
          error: 'Active subscription detected',
          message: 'Please cancel your subscription before deleting your account. You can do this from your account settings.',
        },
        { status: 400 }
      );
    }

    // Log deletion request for compliance audit
    const { error: logError } = await supabase
      .from('data_deletion_requests')
      .insert({
        user_id: user.id,
        email: user.email || '',
        reason: body.reason || null,
        feedback: body.feedback || null,
        status: 'processing',
      } as never);

    if (logError) {
      logger.error('Error logging deletion request', { error: logError });
      // Continue with deletion even if logging fails
    }

    // Delete user data in order (respecting foreign keys)
    // Note: Most tables should cascade delete via FK, but we do this explicitly for clarity

    // 1. Delete alert history
    const alertsData = (await supabase
      .from('user_alerts')
      .select('id')
      .eq('user_id', user.id)
    ).data as { id: string }[] | null;

    const { error: alertHistoryError } = await supabase
      .from('alert_history')
      .delete()
      .in('alert_id', alertsData?.map((a) => a.id) || []);

    if (alertHistoryError) {
      logger.error('Error deleting alert history', { error: alertHistoryError });
    }

    // 2. Delete alerts
    const { error: alertsError } = await supabase
      .from('user_alerts')
      .delete()
      .eq('user_id', user.id);

    if (alertsError) {
      logger.error('Error deleting alerts', { error: alertsError });
    }

    // 3. Delete saved search notifications
    const savedSearchesData = (await supabase
      .from('saved_searches')
      .select('id')
      .eq('user_id', user.id)
    ).data as { id: string }[] | null;

    const savedSearchIds = savedSearchesData?.map((s) => s.id) || [];

    if (savedSearchIds.length > 0) {
      const { error: notifError } = await supabase
        .from('saved_search_notifications')
        .delete()
        .in('saved_search_id', savedSearchIds);

      if (notifError) {
        logger.error('Error deleting saved search notifications', { error: notifError });
      }
    }

    // 4. Delete saved searches
    const { error: savedSearchesError } = await supabase
      .from('saved_searches')
      .delete()
      .eq('user_id', user.id);

    if (savedSearchesError) {
      logger.error('Error deleting saved searches', { error: savedSearchesError });
    }

    // 5. Delete favorites
    const { error: favoritesError } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id);

    if (favoritesError) {
      logger.error('Error deleting favorites', { error: favoritesError });
    }

    // 6. Anonymize activity data (keep for analytics, remove user association)
    const { error: activityError } = await supabase
      .from('user_activity')
      .update({ user_id: null } as never)
      .eq('user_id', user.id);

    if (activityError) {
      logger.error('Error anonymizing activity', { error: activityError });
    }

    // 7. Anonymize sessions
    const { error: sessionsError } = await supabase
      .from('user_sessions')
      .update({ user_id: null } as never)
      .eq('user_id', user.id);

    if (sessionsError) {
      logger.error('Error anonymizing sessions', { error: sessionsError });
    }

    // 8. Delete consent history (or keep for compliance - keeping for now)
    // We keep consent history as it's part of the audit trail

    // 9. Delete profile (this should cascade other FK references)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) {
      logger.error('Error deleting profile', { error: profileError });
      // Update deletion request status to failed
      await supabase
        .from('data_deletion_requests')
        .update({ status: 'failed', processed_at: new Date().toISOString() } as never)
        .eq('user_id', user.id)
        .eq('status', 'processing');

      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    // 10. Delete auth user using admin client
    try {
      const adminClient = await createAdminClient();
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id);

      if (authDeleteError) {
        logger.error('Error deleting auth user', { error: authDeleteError });
        // Profile is already deleted, so auth user is orphaned
        // Log this for manual cleanup
      }
    } catch (adminError) {
      logger.error('Admin client error', { error: adminError });
      // Continue - profile is deleted, auth user may be orphaned
    }

    // Update deletion request status to completed
    await supabase
      .from('data_deletion_requests')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        processed_by: 'system',
      } as never)
      .eq('user_id', user.id)
      .eq('status', 'processing');

    return NextResponse.json({
      success: true,
      message: 'Your account has been deleted. We\'re sorry to see you go.',
    });
  } catch (error) {
    logger.logError('Account deletion error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/delete-account
 * Check if there are any pending deletion requests
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for pending deletion requests
    const { data: requests, error } = await supabase
      .from('data_deletion_requests')
      .select('id, status, requested_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .order('requested_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('Error fetching deletion requests', { error });
      return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }

    return NextResponse.json({
      hasPendingRequest: requests && requests.length > 0,
      request: requests?.[0] || null,
    });
  } catch (error) {
    logger.logError('Deletion status check error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
