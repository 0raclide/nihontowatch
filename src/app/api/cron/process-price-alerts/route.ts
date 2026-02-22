/**
 * Cron job for processing price drop alerts
 *
 * Called by Vercel Cron every 15 minutes
 * Detects price decreases and sends notifications to users with active price_drop alerts
 */

import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendPriceDropNotification } from '@/lib/email/sendgrid';
import { logger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api/cronAuth';
import type { Listing } from '@/types';
import type { Database } from '@/types/database';
import { isLocale, type Locale } from '@/i18n';

type AlertRow = Database['public']['Tables']['alerts']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type PriceHistoryRow = Database['public']['Tables']['price_history']['Row'];

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for Vercel

// Process alerts in batches
const BATCH_SIZE = 20;
// Cooldown period between notifications for the same alert (24 hours)
const COOLDOWN_HOURS = 24;


/**
 * Get the lookback window for detecting price changes
 */
function getLookbackWindow(): Date {
  const now = new Date();
  // Look back 20 minutes to account for processing time and overlap
  return new Date(now.getTime() - 20 * 60 * 1000);
}

/**
 * Check if an alert is within its cooldown period
 */
function isWithinCooldown(lastTriggeredAt: string | null): boolean {
  if (!lastTriggeredAt) return false;

  const lastTriggered = new Date(lastTriggeredAt);
  const cooldownEnd = new Date(lastTriggered.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
  return new Date() < cooldownEnd;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const lookbackWindow = getLookbackWindow();

    logger.info('Processing price drop alerts', { since: lookbackWindow.toISOString() });

    // Step 1: Find recent price decreases
    const { data: priceChanges, error: priceError } = await supabase
      .from('price_history')
      .select('*')
      .eq('change_type', 'decrease')
      .gte('detected_at', lookbackWindow.toISOString());

    if (priceError) {
      logger.error('Error fetching price changes', { error: priceError });
      return NextResponse.json({ error: priceError.message }, { status: 500 });
    }

    const priceChangesTyped = priceChanges as PriceHistoryRow[] | null;

    if (!priceChangesTyped || priceChangesTyped.length === 0) {
      return NextResponse.json({
        message: 'No recent price decreases found',
        processed: 0,
        notificationsSent: 0,
      });
    }

    logger.info('Found price decreases', { count: priceChangesTyped.length });

    // Get unique listing IDs with price drops
    const listingIds = [...new Set(priceChangesTyped.map((pc) => pc.listing_id))];

    // Create a map of listing_id to most recent price change
    const priceChangeMap = new Map<number, PriceHistoryRow>();
    for (const pc of priceChangesTyped) {
      const existing = priceChangeMap.get(pc.listing_id);
      if (!existing || new Date(pc.detected_at) > new Date(existing.detected_at)) {
        priceChangeMap.set(pc.listing_id, pc);
      }
    }

    // Step 2: Find active price_drop alerts for these listings
    const { data: alertsData, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('alert_type', 'price_drop')
      .eq('is_active', true)
      .in('listing_id', listingIds);

    const alerts = alertsData as AlertRow[] | null;

    if (alertsError) {
      logger.error('Error fetching alerts', { error: alertsError });
      return NextResponse.json({ error: alertsError.message }, { status: 500 });
    }

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({
        message: 'No active price_drop alerts for changed listings',
        priceChangesFound: priceChanges.length,
        processed: 0,
        notificationsSent: 0,
      });
    }

    logger.info('Found active price_drop alerts to process', { count: alerts.length });

    // Filter out alerts within cooldown period
    const eligibleAlerts = alerts.filter((alert) => !isWithinCooldown(alert.last_triggered_at));

    if (eligibleAlerts.length === 0) {
      return NextResponse.json({
        message: 'All alerts are within cooldown period',
        totalAlerts: alerts.length,
        processed: 0,
        notificationsSent: 0,
      });
    }

    logger.info('Alerts eligible after cooldown filter', { count: eligibleAlerts.length });

    // Step 3: Get user emails and locale preferences
    const userIds = [...new Set(eligibleAlerts.map((a) => a.user_id))];
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

    // Step 4: Get listing details
    const alertListingIds = [...new Set(eligibleAlerts.map((a) => a.listing_id).filter(Boolean))];
    const { data: listingsData } = await supabase
      .from('listings')
      .select(`
        id,
        url,
        title,
        item_type,
        price_value,
        price_currency,
        cert_type,
        images,
        dealer_id,
        dealers!inner(id, name, name_ja, domain)
      `)
      .in('id', alertListingIds);

    const listingsMap = new Map<number, Listing>();
    (listingsData as unknown as Listing[])?.forEach((l) => {
      listingsMap.set(l.id, l);
    });

    // Step 5: Process alerts in batches
    let processed = 0;
    let notificationsSent = 0;
    let errors = 0;

    for (let i = 0; i < eligibleAlerts.length; i += BATCH_SIZE) {
      const batch = eligibleAlerts.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (alert) => {
          try {
            const email = userEmails.get(alert.user_id);
            if (!email) {
              logger.warn('No email for user', { userId: alert.user_id });
              return;
            }

            const listing = alert.listing_id ? listingsMap.get(alert.listing_id) : null;
            if (!listing) {
              logger.warn('No listing found for alert', { alertId: alert.id });
              return;
            }

            const priceChange = alert.listing_id ? priceChangeMap.get(alert.listing_id) : null;
            if (!priceChange) {
              logger.warn('No price change found for listing', { listingId: alert.listing_id });
              return;
            }

            processed++;

            // Send notification
            const locale = userLocales.get(alert.user_id) || 'en';
            const result = await sendPriceDropNotification(
              email,
              listing,
              priceChange.old_price || 0,
              priceChange.new_price || 0,
              locale
            );

            if (result.success) {
              notificationsSent++;

              // Update alert's last_triggered_at
              await supabase
                .from('alerts')
                .update({
                  last_triggered_at: new Date().toISOString(),
                } as never)
                .eq('id', alert.id);

              // Record in alert_history
              await supabase.from('alert_history').insert({
                alert_id: alert.id,
                triggered_at: new Date().toISOString(),
                delivery_status: 'sent',
                delivery_method: 'email',
              } as never);

              logger.info('Sent price drop notification', { alertId: alert.id, email });
            } else {
              errors++;
              logger.error('Failed to send notification', { alertId: alert.id, error: result.error });

              // Record failed notification
              await supabase.from('alert_history').insert({
                alert_id: alert.id,
                triggered_at: new Date().toISOString(),
                delivery_status: 'failed',
                delivery_method: 'email',
                error_message: result.error,
              } as never);
            }
          } catch (err) {
            errors++;
            logger.error('Error processing alert', { alertId: alert.id, error: err });
          }
        })
      );
    }

    return NextResponse.json({
      message: `Processed ${processed} price drop alerts`,
      priceChangesFound: priceChangesTyped.length,
      alertsFound: alerts.length,
      eligibleAfterCooldown: eligibleAlerts.length,
      processed,
      notificationsSent,
      errors,
    });
  } catch (error) {
    logger.logError('Price alerts cron error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
