/**
 * Cron job for processing back-in-stock alerts
 *
 * Called by Vercel Cron every 15 minutes
 * Detects listings that became available again and sends notifications
 */

import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendBackInStockNotification } from '@/lib/email/sendgrid';
import { logger } from '@/lib/logger';
import type { Listing } from '@/types';
import type { Database } from '@/types/database';

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
 * Verify the request is authorized
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn('CRON_SECRET not configured - allowing unauthenticated access');
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * Get the lookback window for detecting status changes
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
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const lookbackWindow = getLookbackWindow();

    logger.info('Processing back-in-stock alerts', { since: lookbackWindow.toISOString() });

    // Step 1: Find listings that recently became available
    // We check for listings that:
    // 1. Are currently available (is_available = true OR status = 'available')
    // 2. Were recently scraped (last_scraped_at >= lookback window)
    // 3. Have a price_history entry with change_type = 'status_change' in the lookback window
    //
    // Alternative: Check price_history for status changes directly

    const { data: statusChanges, error: statusError } = await supabase
      .from('price_history')
      .select('listing_id, detected_at')
      .eq('change_type', 'status_change')
      .gte('detected_at', lookbackWindow.toISOString());

    if (statusError) {
      logger.error('Error fetching status changes', { error: statusError });
      return NextResponse.json({ error: statusError.message }, { status: 500 });
    }

    const statusChangesTyped = statusChanges as Pick<PriceHistoryRow, 'listing_id' | 'detected_at'>[] | null;

    if (!statusChangesTyped || statusChangesTyped.length === 0) {
      return NextResponse.json({
        message: 'No recent status changes found',
        processed: 0,
        notificationsSent: 0,
      });
    }

    logger.info('Found status changes', { count: statusChangesTyped.length });

    // Get unique listing IDs
    const listingIds = [...new Set(statusChangesTyped.map((sc) => sc.listing_id))];

    // Step 2: Filter to only listings that are NOW available
    const { data: availableListings, error: listingsError } = await supabase
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
        is_available,
        status,
        dealer_id,
        dealers!inner(id, name, domain)
      `)
      .in('id', listingIds)
      .or('is_available.eq.true,status.eq.available');

    if (listingsError) {
      logger.error('Error fetching listings', { error: listingsError });
      return NextResponse.json({ error: listingsError.message }, { status: 500 });
    }

    const availableListingsTyped = availableListings as unknown as Listing[] | null;

    if (!availableListingsTyped || availableListingsTyped.length === 0) {
      return NextResponse.json({
        message: 'No listings became available (status changes were to sold/unavailable)',
        statusChangesFound: statusChangesTyped.length,
        processed: 0,
        notificationsSent: 0,
      });
    }

    logger.info('Listings now available', { count: availableListingsTyped.length });

    const availableListingIds = availableListingsTyped.map((l) => l.id);

    // Step 3: Find active back_in_stock alerts for these listings
    const { data: alertsData, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('alert_type', 'back_in_stock')
      .eq('is_active', true)
      .in('listing_id', availableListingIds);

    const alerts = alertsData as AlertRow[] | null;

    if (alertsError) {
      logger.error('Error fetching alerts', { error: alertsError });
      return NextResponse.json({ error: alertsError.message }, { status: 500 });
    }

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({
        message: 'No active back_in_stock alerts for newly available listings',
        statusChangesFound: statusChangesTyped.length,
        listingsNowAvailable: availableListingsTyped.length,
        processed: 0,
        notificationsSent: 0,
      });
    }

    logger.info('Found active back_in_stock alerts', { count: alerts.length });

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

    logger.info('Alerts eligible after cooldown', { count: eligibleAlerts.length });

    // Step 4: Get user emails
    const userIds = [...new Set(eligibleAlerts.map((a) => a.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const profiles = profilesData as Pick<ProfileRow, 'id' | 'email'>[] | null;
    const userEmails = new Map<string, string>();
    profiles?.forEach((p) => {
      if (p.email) userEmails.set(p.id, p.email);
    });

    // Create listings map
    const listingsMap = new Map<number, Listing>();
    availableListingsTyped?.forEach((l) => {
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

            processed++;

            // Send notification
            const result = await sendBackInStockNotification(email, listing);

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

              logger.info('Sent back-in-stock notification', { alertId: alert.id, email });
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
      message: `Processed ${processed} back-in-stock alerts`,
      statusChangesFound: statusChangesTyped.length,
      listingsNowAvailable: availableListingsTyped.length,
      alertsFound: alerts.length,
      eligibleAfterCooldown: eligibleAlerts.length,
      processed,
      notificationsSent,
      errors,
    });
  } catch (error) {
    logger.logError('Back-in-stock alerts cron error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
