/**
 * Pipeline Health Alert — emails admin(s) when the scraper pipeline is down.
 *
 * Checks `scrape_runs` for recent activity. If no run completed in the last
 * CRITICAL_THRESHOLD_HOURS, sends a single alert email to all admin users.
 *
 * Dedup: Stores last alert timestamp in `system_state` table row
 * (key='pipeline_alert_last_sent'). Won't re-alert until the pipeline
 * recovers (a new scrape_run appears) and then goes down again.
 *
 * Schedule: every 4 hours (vercel.json)
 * Auth: CRON_SECRET (Bearer or x-cron-secret header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyCronAuth } from '@/lib/api/cronAuth';
import { logger } from '@/lib/logger';
import { sendPipelineAlert } from '@/lib/email/pipeline-alert';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRITICAL_THRESHOLD_HOURS = 12;

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // Get the most recent scrape run
    const { data: lastRun } = await supabase
      .from('scrape_runs')
      .select('started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(1)
      .single() as { data: { started_at: string; completed_at: string | null } | null };

    if (!lastRun) {
      logger.warn('[pipeline-health] No scrape_runs found at all');
      await sendAlertIfNeeded(supabase, -1, 'No pipeline runs found in the database.');
      return NextResponse.json({ status: 'alert_sent', reason: 'no_runs_found' });
    }

    const lastTimestamp = lastRun.completed_at || lastRun.started_at;
    const hoursSince = (Date.now() - new Date(lastTimestamp).getTime()) / (1000 * 60 * 60);

    if (hoursSince <= CRITICAL_THRESHOLD_HOURS) {
      // Pipeline is healthy — clear any previous alert state so we can
      // re-alert if it goes down again
      await clearAlertState(supabase);
      logger.info(`[pipeline-health] Healthy — last activity ${Math.round(hoursSince)}h ago`);
      return NextResponse.json({ status: 'healthy', hoursSince: Math.round(hoursSince * 10) / 10 });
    }

    // Pipeline is down — alert if we haven't already for this incident
    const roundedHours = Math.round(hoursSince);
    const message = `No pipeline activity in ~${roundedHours}h. Last run: ${lastTimestamp}. Check GitHub Actions.`;
    const sent = await sendAlertIfNeeded(supabase, roundedHours, message);

    return NextResponse.json({
      status: 'critical',
      hoursSince: roundedHours,
      alertSent: sent,
    });
  } catch (error) {
    logger.error('[pipeline-health] Error checking pipeline health', { error: String(error) });
    return NextResponse.json(
      { error: 'Internal error checking pipeline health' },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

/**
 * Send alert email if we haven't already alerted for this downtime incident.
 * Returns true if an email was actually sent.
 */
async function sendAlertIfNeeded(
  supabase: SupabaseClient,
  hoursSince: number,
  message: string
): Promise<boolean> {
  // Check if we already sent an alert for this incident
  const { data: state } = await supabase
    .from('system_state')
    .select('value')
    .eq('key', 'pipeline_alert_last_sent')
    .single();

  if (state?.value) {
    // Already alerted for this incident — skip
    logger.info('[pipeline-health] Alert already sent for this incident, skipping');
    return false;
  }

  // Fetch admin emails
  const { data: adminProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin') as { data: Array<{ id: string }> | null };

  if (!adminProfiles || adminProfiles.length === 0) {
    logger.error('[pipeline-health] No admin users found, cannot send alert');
    return false;
  }

  // Get emails from auth.users via admin API
  const adminEmails: string[] = [];
  for (const profile of adminProfiles) {
    const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
    if (user?.email) {
      adminEmails.push(user.email);
    }
  }

  if (adminEmails.length === 0) {
    logger.error('[pipeline-health] No admin emails resolved');
    return false;
  }

  // Send the alert
  const result = await sendPipelineAlert(adminEmails, hoursSince, message);

  if (result.success) {
    // Mark that we've alerted for this incident
    await supabase
      .from('system_state')
      .upsert({ key: 'pipeline_alert_last_sent', value: new Date().toISOString() });

    logger.info(`[pipeline-health] Alert sent to ${adminEmails.join(', ')}`);
  } else {
    logger.error(`[pipeline-health] Failed to send alert: ${result.error}`);
  }

  return result.success;
}

/**
 * Clear the alert state when pipeline recovers, so we can re-alert
 * if it goes down again.
 */
async function clearAlertState(supabase: SupabaseClient) {
  await supabase
    .from('system_state')
    .delete()
    .eq('key', 'pipeline_alert_last_sent');
}
