/**
 * Cron job for processing saved search notifications
 *
 * Called by GitHub Actions on a schedule:
 * - Every 15 minutes for 'instant' notifications
 * - Daily at 8am UTC for 'daily' digest
 *
 * Query params:
 * - frequency: 'instant' | 'daily' (required)
 */

import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { findMatchingListings } from '@/lib/savedSearches/matcher';
import { sendSavedSearchNotification } from '@/lib/email/sendgrid';
import { logger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api/cronAuth';
import type { SavedSearch, SavedSearchCriteria, Listing, NotificationFrequency } from '@/types';
import type { Database } from '@/types/database';
import { isLocale, type Locale } from '@/i18n';

type SavedSearchRow = Database['public']['Tables']['saved_searches']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for Vercel

// Process saved searches in batches
const BATCH_SIZE = 20;


/**
 * Get the lookback window based on frequency
 */
function getLookbackWindow(frequency: NotificationFrequency): Date {
  const now = new Date();

  if (frequency === 'instant') {
    // Look back 20 minutes to account for processing time
    return new Date(now.getTime() - 20 * 60 * 1000);
  } else {
    // Look back 25 hours for daily to account for timezone variations
    return new Date(now.getTime() - 25 * 60 * 60 * 1000);
  }
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get frequency from query param
  const frequency = request.nextUrl.searchParams.get('frequency') as NotificationFrequency | null;

  if (!frequency || !['instant', 'daily'].includes(frequency)) {
    return NextResponse.json(
      { error: 'Invalid frequency. Must be "instant" or "daily".' },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceClient();
    const lookbackWindow = getLookbackWindow(frequency);

    // Get active saved searches with this notification frequency
    const { data, error: fetchError } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('notification_frequency', frequency)
      .eq('is_active', true);

    const savedSearches = data as SavedSearchRow[] | null;

    if (fetchError) {
      logger.error('Error fetching saved searches', { error: fetchError });
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!savedSearches || savedSearches.length === 0) {
      return NextResponse.json({
        message: `No active saved searches with ${frequency} notifications`,
        processed: 0,
        notificationsSent: 0,
      });
    }

    logger.info('Processing saved searches', { count: savedSearches.length, frequency });

    // Get user emails and locale preferences for notifications
    const userIds = [...new Set(savedSearches.map((s) => s.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, preferences')
      .in('id', userIds);

    const profiles = profilesData as Pick<ProfileRow, 'id' | 'email' | 'preferences'>[] | null;
    const userEmails = new Map<string, string>();
    const userLocales = new Map<string, Locale>();
    profiles?.forEach((p) => {
      if (p.email) userEmails.set(p.id, p.email);
      const pref = (p.preferences as Record<string, unknown> | null)?.locale;
      if (isLocale(pref as string)) userLocales.set(p.id, pref as Locale);
    });

    // Process in batches
    let processed = 0;
    let notificationsSent = 0;
    let errors = 0;

    for (let i = 0; i < savedSearches.length; i += BATCH_SIZE) {
      const batch = savedSearches.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (savedSearch) => {
          try {
            const email = userEmails.get(savedSearch.user_id);
            if (!email) {
              logger.warn('No email for user', { userId: savedSearch.user_id });
              return;
            }

            // Determine since timestamp
            const sinceTimestamp = savedSearch.last_notified_at
              ? new Date(savedSearch.last_notified_at)
              : lookbackWindow;

            // Find matching listings
            const criteria = savedSearch.search_criteria as SavedSearchCriteria;
            const matchedListings = await findMatchingListings(
              supabase,
              criteria,
              sinceTimestamp,
              50 // Limit to 50 listings per notification
            );

            processed++;

            if (matchedListings.length === 0) {
              // No new matches, just update last_notified_at
              await supabase
                .from('saved_searches')
                .update({
                  last_notified_at: new Date().toISOString(),
                  last_match_count: 0,
                } as never)
                .eq('id', savedSearch.id);
              return;
            }

            // Send notification (with userId for unsubscribe link)
            const locale = userLocales.get(savedSearch.user_id) || 'en';
            const result = await sendSavedSearchNotification(
              email,
              savedSearch as unknown as SavedSearch,
              matchedListings as unknown as Listing[],
              frequency as 'instant' | 'daily',
              savedSearch.user_id,
              locale
            );

            if (result.success) {
              notificationsSent++;

              // Update saved search
              await supabase
                .from('saved_searches')
                .update({
                  last_notified_at: new Date().toISOString(),
                  last_match_count: matchedListings.length,
                } as never)
                .eq('id', savedSearch.id);

              // Record in notification history
              await supabase.from('saved_search_notifications').insert({
                saved_search_id: savedSearch.id,
                matched_listing_ids: matchedListings.map((l) => l.id),
                status: 'sent',
                sent_at: new Date().toISOString(),
              } as never);
            } else {
              errors++;
              logger.error('Failed to send notification', {
                savedSearchId: savedSearch.id,
                error: result.error,
              });

              // Record failed notification
              await supabase.from('saved_search_notifications').insert({
                saved_search_id: savedSearch.id,
                matched_listing_ids: matchedListings.map((l) => l.id),
                status: 'failed',
                error_message: result.error,
              } as never);
            }
          } catch (err) {
            errors++;
            logger.error('Error processing saved search', { savedSearchId: savedSearch.id, error: err });
          }
        })
      );
    }

    return NextResponse.json({
      message: `Processed ${processed} saved searches`,
      frequency,
      processed,
      notificationsSent,
      errors,
    });
  } catch (error) {
    logger.logError('Saved search cron error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
