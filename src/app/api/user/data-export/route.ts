import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/data-export
 * Export all user data for GDPR right to access/portability
 *
 * Returns a JSON file containing:
 * - Profile information
 * - Preferences
 * - Favorites
 * - Saved searches
 * - Alerts
 * - Activity history (last 90 days)
 * - Consent history
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

    // Fetch all user data in parallel
    const [
      profileResult,
      favoritesResult,
      savedSearchesResult,
      alertsResult,
      activityResult,
      consentHistoryResult,
    ] = await Promise.all([
      // Profile
      supabase
        .from('profiles')
        .select('email, display_name, role, preferences, created_at, updated_at, subscription_tier, subscription_status, consent_preferences, consent_updated_at, marketing_opt_out')
        .eq('id', user.id)
        .single(),

      // Favorites with listing details
      supabase
        .from('user_favorites')
        .select(`
          id,
          created_at,
          listing:listings(
            id,
            title,
            url,
            price_value,
            price_currency,
            item_type,
            dealer:dealers(name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Saved searches
      supabase
        .from('saved_searches')
        .select('id, name, search_criteria, notification_frequency, is_active, created_at, updated_at, last_notified_at, last_match_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Alerts
      supabase
        .from('user_alerts')
        .select(`
          id,
          alert_type,
          target_price,
          search_criteria,
          is_active,
          created_at,
          last_triggered_at,
          listing:listings(
            id,
            title,
            url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Activity (last 90 days)
      supabase
        .from('user_activity')
        .select('id, session_id, action_type, page_path, listing_id, metadata, duration_ms, created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1000),

      // Consent history
      supabase
        .from('user_consent_history')
        .select('id, preferences, version, method, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    // Check for errors
    if (profileResult.error) {
      console.error('Error fetching profile:', profileResult.error);
      return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
    }

    // Cast profile data since TypeScript types may not have new columns yet
    const profile = profileResult.data as {
      email: string | null;
      display_name: string | null;
      role: string | null;
      preferences: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
      subscription_tier: string | null;
      subscription_status: string | null;
      consent_preferences: Record<string, unknown> | null;
      consent_updated_at: string | null;
      marketing_opt_out: boolean | null;
    } | null;

    // Build export object
    const exportData = {
      exportedAt: new Date().toISOString(),
      format: 'json',
      version: '1.0',
      user: {
        email: profile?.email,
        displayName: profile?.display_name,
        role: profile?.role,
        createdAt: profile?.created_at,
        updatedAt: profile?.updated_at,
        preferences: profile?.preferences,
        subscription: {
          tier: profile?.subscription_tier,
          status: profile?.subscription_status,
        },
        consent: {
          preferences: profile?.consent_preferences,
          updatedAt: profile?.consent_updated_at,
          marketingOptOut: profile?.marketing_opt_out,
        },
      },
      data: {
        favorites: favoritesResult.data || [],
        savedSearches: savedSearchesResult.data || [],
        alerts: alertsResult.data || [],
        activityHistory: {
          note: 'Activity data from the last 90 days (limited to 1000 records)',
          records: activityResult.data || [],
        },
        consentHistory: consentHistoryResult.data || [],
      },
      metadata: {
        totalFavorites: favoritesResult.data?.length || 0,
        totalSavedSearches: savedSearchesResult.data?.length || 0,
        totalAlerts: alertsResult.data?.length || 0,
        activityRecords: activityResult.data?.length || 0,
        consentRecords: consentHistoryResult.data?.length || 0,
      },
    };

    // Return as downloadable JSON
    const response = NextResponse.json(exportData);
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="nihontowatch-data-export-${new Date().toISOString().split('T')[0]}.json"`
    );

    return response;
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
