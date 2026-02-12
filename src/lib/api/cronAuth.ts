/**
 * Shared cron job authentication utility
 *
 * Verifies that incoming cron requests have valid CRON_SECRET credentials.
 * Used by all cron routes to ensure consistent auth behavior.
 *
 * Accepts either:
 * - Authorization: Bearer <CRON_SECRET>
 * - x-cron-secret: <CRON_SECRET>
 *
 * IMPORTANT: Returns false when CRON_SECRET is not configured (fail-closed).
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured - rejecting request');
    return false;
  }

  // Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check x-cron-secret header
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}
