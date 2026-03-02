import { createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// SendGrid free tier: 100 emails/day
// Override with SENDGRID_DAILY_LIMIT env var if you upgrade
const DAILY_LIMIT = parseInt(process.env.SENDGRID_DAILY_LIMIT || '100', 10);
const WARNING_THRESHOLD = 0.8; // Warn at 80% usage

export interface EmailBudget {
  sent: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'exhausted';
}

/**
 * Count emails sent today (UTC) across all notification channels.
 * Queries saved_search_notifications + alert_history tables.
 */
export async function getEmailBudget(): Promise<EmailBudget> {
  const supabase = createServiceClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const since = todayStart.toISOString();

  // Count from both notification tables in parallel
  const [searchResult, alertResult] = await Promise.all([
    supabase
      .from('saved_search_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', since),
    supabase
      .from('alert_history')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_status', 'sent')
      .gte('triggered_at', since),
  ]);

  if (searchResult.error) {
    logger.warn('Failed to count saved_search_notifications', { error: searchResult.error.message });
  }
  if (alertResult.error) {
    logger.warn('Failed to count alert_history', { error: alertResult.error.message });
  }

  const sent = (searchResult.count ?? 0) + (alertResult.count ?? 0);
  const remaining = Math.max(0, DAILY_LIMIT - sent);
  const percentUsed = DAILY_LIMIT > 0 ? (sent / DAILY_LIMIT) * 100 : 0;

  let status: EmailBudget['status'] = 'ok';
  if (sent >= DAILY_LIMIT) {
    status = 'exhausted';
  } else if (sent >= DAILY_LIMIT * WARNING_THRESHOLD) {
    status = 'warning';
  }

  return { sent, limit: DAILY_LIMIT, remaining, percentUsed, status };
}

/**
 * Quick check: can we send more emails today?
 * Use this before attempting a send to avoid wasting API calls.
 */
export async function canSendEmail(): Promise<{ allowed: boolean; budget: EmailBudget }> {
  const budget = await getEmailBudget();
  return { allowed: budget.status !== 'exhausted', budget };
}
