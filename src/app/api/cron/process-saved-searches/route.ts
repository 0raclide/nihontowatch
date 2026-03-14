/**
 * Cron job for processing saved search notifications
 *
 * Two-phase architecture with circuit breaker:
 *
 *   Phase 0: CIRCUIT BREAKER CHECK
 *     └─ Is SendGrid globally down? → Skip entire run
 *
 *   Phase 1: RETRY FAILED NOTIFICATIONS
 *     └─ Pick up failed notifications whose retry_after has elapsed
 *     └─ Re-fetch listings, re-send email
 *     └─ On success → mark sent, advance cursor
 *     └─ On failure → increment retry_count, compute next backoff
 *     └─ After 5 retries → abandon, advance cursor
 *
 *   Phase 2: PROCESS NEW MATCHES (existing logic, enhanced)
 *     └─ Skip searches that already have a pending retry (dedup)
 *     └─ On success → same as before
 *     └─ On failure → classify error, insert with retry_after + error_category
 *     └─ Permanent errors → insert as 'abandoned', advance last_notified_at
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
import { classifyEmailError } from '@/lib/email/errorClassifier';
import { getNextRetryAfter, shouldAbandon, MAX_RETRY_COUNT } from '@/lib/email/retryPolicy';
import { isCircuitBreakerOpen, EmailCircuitTracker } from '@/lib/email/circuitBreaker';
import type { SavedSearch, SavedSearchCriteria, Listing, NotificationFrequency } from '@/types';
import type { Database } from '@/types/database';
import { isLocale, type Locale } from '@/i18n';
import { LISTING_FILTERS } from '@/lib/constants';

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

    // ================================================================
    // PHASE 0: CIRCUIT BREAKER CHECK
    // ================================================================
    const cbState = await isCircuitBreakerOpen(supabase);
    if (cbState.open) {
      logger.warn('Email circuit breaker is OPEN — skipping entire run', {
        reason: cbState.reason,
      });
      return NextResponse.json({
        message: 'Circuit breaker open — skipping email sends',
        circuitBreaker: cbState,
        frequency,
        processed: 0,
        notificationsSent: 0,
        retried: 0,
        errors: 0,
      });
    }

    const tracker = new EmailCircuitTracker();
    let retried = 0;
    let retriedSuccess = 0;
    let retriedFailed = 0;
    let retriedAbandoned = 0;

    // ================================================================
    // PHASE 1: RETRY FAILED NOTIFICATIONS
    // ================================================================
    const { data: retryableNotifications } = await supabase
      .from('saved_search_notifications')
      .select('id, saved_search_id, matched_listing_ids, retry_count, error_message')
      .eq('status', 'failed')
      .not('retry_after', 'is', null)
      .lte('retry_after', new Date().toISOString())
      .lt('retry_count', MAX_RETRY_COUNT)
      .order('retry_after', { ascending: true })
      .limit(50) as { data: Array<{
        id: string;
        saved_search_id: string;
        matched_listing_ids: number[];
        retry_count: number;
        error_message: string | null;
      }> | null };

    if (retryableNotifications && retryableNotifications.length > 0) {
      logger.info('Phase 1: Retrying failed notifications', {
        count: retryableNotifications.length,
      });

      // Look up saved searches and user info for the retryables
      const retrySearchIds = [...new Set(retryableNotifications.map(n => n.saved_search_id))];
      const { data: retrySearches } = await supabase
        .from('saved_searches')
        .select('*')
        .in('id', retrySearchIds) as { data: SavedSearchRow[] | null };

      const retrySearchMap = new Map<string, SavedSearchRow>();
      retrySearches?.forEach(s => retrySearchMap.set(s.id, s));

      // Get user profiles for retryable searches
      const retryUserIds = [...new Set(retrySearches?.map(s => s.user_id) || [])];
      const { data: retryProfiles } = await supabase
        .from('profiles')
        .select('id, email, preferences')
        .in('id', retryUserIds) as { data: Pick<ProfileRow, 'id' | 'email' | 'preferences'>[] | null };

      const retryEmails = new Map<string, string>();
      const retryLocales = new Map<string, Locale>();
      retryProfiles?.forEach(p => {
        if (p.email) retryEmails.set(p.id, p.email);
        const prefs = p.preferences as Record<string, unknown> | null;
        const prefLocale = prefs?.locale;
        if (isLocale(prefLocale as string)) retryLocales.set(p.id, prefLocale as Locale);
      });

      for (const notification of retryableNotifications) {
        // Check if circuit breaker tripped mid-run
        if (tracker.isTripped()) {
          logger.warn('Circuit breaker tripped mid-Phase-1 — stopping retries');
          await tracker.tripBreaker(supabase);
          break;
        }

        retried++;
        const savedSearch = retrySearchMap.get(notification.saved_search_id);
        if (!savedSearch) {
          // Search was deleted — abandon this notification
          await supabase
            .from('saved_search_notifications')
            .update({ status: 'abandoned', error_message: 'Saved search deleted' } as never)
            .eq('id', notification.id);
          retriedAbandoned++;
          continue;
        }

        const email = retryEmails.get(savedSearch.user_id);
        if (!email) {
          await supabase
            .from('saved_search_notifications')
            .update({ status: 'abandoned', error_message: 'No email for user', error_category: 'permanent' } as never)
            .eq('id', notification.id);
          retriedAbandoned++;
          continue;
        }

        // Re-fetch the matched listings by ID
        const { data: listings } = await supabase
          .from('listings')
          .select('*')
          .in('id', notification.matched_listing_ids)
          .eq('is_available', true);

        if (!listings || listings.length === 0) {
          // All listings sold/removed — abandon, advance cursor
          await supabase
            .from('saved_search_notifications')
            .update({ status: 'abandoned', error_message: 'All matched listings no longer available' } as never)
            .eq('id', notification.id);
          await supabase
            .from('saved_searches')
            .update({ last_notified_at: new Date().toISOString() } as never)
            .eq('id', savedSearch.id);
          retriedAbandoned++;
          continue;
        }

        // Re-send
        const locale = retryLocales.get(savedSearch.user_id) || 'en';
        const result = await sendSavedSearchNotification(
          email,
          savedSearch as unknown as SavedSearch,
          listings as unknown as Listing[],
          frequency as 'instant' | 'daily',
          savedSearch.user_id,
          locale
        );

        if (result.success) {
          tracker.recordSuccess();
          retriedSuccess++;

          // Mark sent, advance cursor
          await supabase
            .from('saved_search_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              retry_after: null,
            } as never)
            .eq('id', notification.id);

          await supabase
            .from('saved_searches')
            .update({
              last_notified_at: new Date().toISOString(),
              last_match_count: listings.length,
            } as never)
            .eq('id', savedSearch.id);
        } else {
          tracker.recordFailure();
          retriedFailed++;

          const newRetryCount = notification.retry_count + 1;
          const errorCategory = classifyEmailError(result.error || 'Unknown error');

          if (errorCategory === 'permanent' || shouldAbandon(newRetryCount)) {
            // Abandon
            await supabase
              .from('saved_search_notifications')
              .update({
                status: 'abandoned',
                retry_count: newRetryCount,
                retry_after: null,
                error_message: result.error,
                error_category: errorCategory,
              } as never)
              .eq('id', notification.id);

            // Advance cursor to prevent re-matching the same listings
            await supabase
              .from('saved_searches')
              .update({ last_notified_at: new Date().toISOString() } as never)
              .eq('id', savedSearch.id);
            retriedAbandoned++;
          } else {
            // Schedule next retry
            const nextRetryAfter = getNextRetryAfter(newRetryCount);
            await supabase
              .from('saved_search_notifications')
              .update({
                retry_count: newRetryCount,
                retry_after: nextRetryAfter?.toISOString() ?? null,
                error_message: result.error,
                error_category: errorCategory,
              } as never)
              .eq('id', notification.id);
          }
        }
      }
    }

    // Check circuit breaker after Phase 1
    if (tracker.isTripped()) {
      logger.warn('Circuit breaker tripped after Phase 1 — skipping Phase 2');
      await tracker.tripBreaker(supabase);
      return NextResponse.json({
        message: 'Circuit breaker tripped — stopping sends',
        frequency,
        processed: 0,
        notificationsSent: 0,
        retried,
        retriedSuccess,
        retriedFailed,
        retriedAbandoned,
        errors: 0,
        circuitBreakerTripped: true,
      });
    }

    // ================================================================
    // PHASE 2: PROCESS NEW MATCHES
    // ================================================================
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
        frequency,
        processed: 0,
        notificationsSent: 0,
        retried,
        retriedSuccess,
        retriedFailed,
        retriedAbandoned,
        errors: 0,
        circuitBreakerTripped: false,
      });
    }

    // Dedup: find saved searches that already have a pending retry
    const searchIds = savedSearches.map(s => s.id);
    const { data: pendingRetries } = await supabase
      .from('saved_search_notifications')
      .select('saved_search_id')
      .in('saved_search_id', searchIds)
      .eq('status', 'failed')
      .not('retry_after', 'is', null) as { data: Array<{ saved_search_id: string }> | null };

    const searchesWithPendingRetry = new Set(
      pendingRetries?.map(r => r.saved_search_id) || []
    );

    logger.info('Processing saved searches', {
      count: savedSearches.length,
      frequency,
      skippedDueToRetry: searchesWithPendingRetry.size,
    });

    // Get user emails and locale preferences for notifications
    const userIds = [...new Set(savedSearches.map((s) => s.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, preferences')
      .in('id', userIds);

    const profiles = profilesData as Pick<ProfileRow, 'id' | 'email' | 'preferences'>[] | null;
    const userEmails = new Map<string, string>();
    const userLocales = new Map<string, Locale>();
    const userMinPrices = new Map<string, number>();
    profiles?.forEach((p) => {
      if (p.email) userEmails.set(p.id, p.email);
      const prefs = p.preferences as Record<string, unknown> | null;
      const prefLocale = prefs?.locale;
      if (isLocale(prefLocale as string)) userLocales.set(p.id, prefLocale as Locale);
      // Respect user's showAllPrices preference for price floor bypass
      const showAllPrices = prefs?.showAllPrices === true;
      userMinPrices.set(p.id, showAllPrices ? 0 : LISTING_FILTERS.MIN_PRICE_JPY);
    });

    // Process in batches
    let processed = 0;
    let notificationsSent = 0;
    let errors = 0;

    for (let i = 0; i < savedSearches.length; i += BATCH_SIZE) {
      // Check circuit breaker mid-batch
      if (tracker.isTripped()) {
        logger.warn('Circuit breaker tripped mid-Phase-2 — stopping');
        await tracker.tripBreaker(supabase);
        break;
      }

      const batch = savedSearches.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (savedSearch) => {
          try {
            // Dedup: skip if this search already has a pending retry
            if (searchesWithPendingRetry.has(savedSearch.id)) {
              logger.info('Skipping search with pending retry', {
                savedSearchId: savedSearch.id,
              });
              return;
            }

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
            const userMinPrice = userMinPrices.get(savedSearch.user_id) ?? LISTING_FILTERS.MIN_PRICE_JPY;
            const matchedListings = await findMatchingListings(
              supabase,
              criteria,
              sinceTimestamp,
              50, // Limit to 50 listings per notification
              userMinPrice
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
              tracker.recordSuccess();
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
              tracker.recordFailure();
              errors++;

              const errorMessage = result.error || 'Unknown error';
              const errorCategory = classifyEmailError(errorMessage);

              logger.error('Failed to send notification', {
                savedSearchId: savedSearch.id,
                error: errorMessage,
                errorCategory,
              });

              if (errorCategory === 'permanent') {
                // Permanent error — abandon immediately, advance cursor
                await supabase.from('saved_search_notifications').insert({
                  saved_search_id: savedSearch.id,
                  matched_listing_ids: matchedListings.map((l) => l.id),
                  status: 'abandoned',
                  error_message: errorMessage,
                  error_category: 'permanent',
                  retry_count: 0,
                } as never);

                // Advance cursor so we don't re-match these listings
                await supabase
                  .from('saved_searches')
                  .update({ last_notified_at: new Date().toISOString() } as never)
                  .eq('id', savedSearch.id);
              } else {
                // Transient error — schedule retry
                const retryAfter = getNextRetryAfter(0);
                await supabase.from('saved_search_notifications').insert({
                  saved_search_id: savedSearch.id,
                  matched_listing_ids: matchedListings.map((l) => l.id),
                  status: 'failed',
                  error_message: errorMessage,
                  error_category: 'transient',
                  retry_count: 0,
                  retry_after: retryAfter?.toISOString() ?? null,
                } as never);
                // Do NOT advance last_notified_at — retry will handle it
              }
            }
          } catch (err) {
            errors++;
            logger.error('Error processing saved search', { savedSearchId: savedSearch.id, error: err });
          }
        })
      );
    }

    // Final circuit breaker check — trip if needed after all processing
    if (tracker.isTripped()) {
      await tracker.tripBreaker(supabase);
    }

    return NextResponse.json({
      message: `Processed ${processed} saved searches`,
      frequency,
      processed,
      notificationsSent,
      retried,
      retriedSuccess,
      retriedFailed,
      retriedAbandoned,
      errors,
      circuitBreakerTripped: tracker.isTripped(),
    });
  } catch (error) {
    logger.logError('Saved search cron error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
