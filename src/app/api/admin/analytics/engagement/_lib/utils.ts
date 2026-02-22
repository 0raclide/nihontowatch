/**
 * Shared utilities for engagement analytics API routes.
 *
 * Provides common functions for authentication, parameter parsing,
 * date calculations, and response handling across all engagement endpoints.
 *
 * @module api/admin/analytics/engagement/_lib/utils
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { AnalyticsPeriod, AnalyticsGranularity, AnalyticsAPIResponse } from '@/types/analytics';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Date range with comparison period
 */
export interface PeriodDateRange {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
  days: number;
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

// Use the canonical verifyAdmin from '@/lib/admin/auth' instead.
// See: src/lib/admin/auth.ts

// =============================================================================
// ADMIN USER FILTERING
// =============================================================================

/**
 * Get all admin user IDs for filtering analytics data.
 *
 * Used to exclude admin browsing activity from engagement metrics.
 *
 * @param supabase - Supabase client instance
 * @returns Array of admin user ID strings
 */
export async function getAdminUserIds(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');
  return (data || []).map((p: { id: string }) => p.id);
}

// =============================================================================
// PARAMETER PARSING
// =============================================================================

/**
 * Parse period parameter with validation.
 * Only allows engagement-relevant periods: 7d, 30d, 90d
 *
 * @param searchParams - URL search params
 * @param defaultPeriod - Default period (defaults to '30d')
 * @returns Validated period
 */
export function parsePeriodParam(
  searchParams: URLSearchParams,
  defaultPeriod: '7d' | '30d' | '90d' = '30d'
): '7d' | '30d' | '90d' {
  const raw = searchParams.get('period');
  const validPeriods = ['7d', '30d', '90d'] as const;
  if (raw && validPeriods.includes(raw as '7d' | '30d' | '90d')) {
    return raw as '7d' | '30d' | '90d';
  }
  return defaultPeriod;
}

/**
 * Parse granularity parameter with validation.
 *
 * @param searchParams - URL search params
 * @param defaultGranularity - Default granularity
 * @returns Validated granularity
 */
export function parseGranularityParam(
  searchParams: URLSearchParams,
  defaultGranularity: AnalyticsGranularity = 'daily'
): AnalyticsGranularity {
  const raw = searchParams.get('granularity');
  const validGranularities: AnalyticsGranularity[] = ['daily', 'weekly', 'monthly'];
  if (raw && validGranularities.includes(raw as AnalyticsGranularity)) {
    return raw as AnalyticsGranularity;
  }
  return defaultGranularity;
}

/**
 * Parse limit parameter with validation.
 *
 * @param searchParams - URL search params
 * @param defaultLimit - Default limit
 * @param maxLimit - Maximum allowed limit
 * @returns Validated limit
 */
export function parseLimitParam(
  searchParams: URLSearchParams,
  defaultLimit: number = 20,
  maxLimit: number = 100
): number {
  const raw = searchParams.get('limit');
  if (!raw) return defaultLimit;

  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1) return defaultLimit;

  return Math.min(parsed, maxLimit);
}

/**
 * Parse sortBy parameter with validation.
 *
 * @param searchParams - URL search params
 * @param validOptions - Array of valid sort options
 * @param defaultSort - Default sort option
 * @returns Validated sort option
 */
export function parseSortByParam<T extends string>(
  searchParams: URLSearchParams,
  validOptions: readonly T[],
  defaultSort: T
): T {
  const raw = searchParams.get('sortBy');
  if (raw && validOptions.includes(raw as T)) {
    return raw as T;
  }
  return defaultSort;
}

// =============================================================================
// DATE CALCULATIONS
// =============================================================================

/**
 * Calculate date ranges for a given period including comparison period.
 *
 * @param period - The analytics period ('7d', '30d', '90d')
 * @returns PeriodDateRange with current and previous period dates
 */
export function calculatePeriodDates(period: '7d' | '30d' | '90d'): PeriodDateRange {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Previous period is the same length, ending where current period starts
  const previousEndDate = new Date(startDate);
  previousEndDate.setMilliseconds(-1); // End of previous day

  const previousStartDate = new Date(previousEndDate);
  previousStartDate.setDate(previousStartDate.getDate() - days + 1);
  previousStartDate.setHours(0, 0, 0, 0);

  return {
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    days,
  };
}

/**
 * Get the start of today (midnight)
 */
export function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Create a standardized success response with caching.
 *
 * @param data - Response data
 * @param cacheSeconds - Cache-Control max-age in seconds (default 60)
 * @returns NextResponse with success JSON and cache headers
 */
export function successResponse<T>(
  data: T,
  cacheSeconds: number = 60
): NextResponse<AnalyticsAPIResponse<T>> {
  const response = NextResponse.json<AnalyticsAPIResponse<T>>({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });

  if (cacheSeconds > 0) {
    response.headers.set(
      'Cache-Control',
      `private, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`
    );
  } else {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  return response;
}

/**
 * Create a standardized error response.
 *
 * @param message - Error message
 * @param status - HTTP status code
 * @returns NextResponse with error JSON
 */
export function errorResponse<T = unknown>(
  message: string,
  status: number = 500
): NextResponse<AnalyticsAPIResponse<T>> {
  return NextResponse.json<AnalyticsAPIResponse<T>>(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

// =============================================================================
// PAGINATED FETCH
// =============================================================================

/**
 * Fetch all rows from a Supabase query, paginating past the PostgREST
 * max_rows limit (default 1,000). Without this, `.limit(100000)` is
 * silently capped and returns incomplete data.
 *
 * @param queryBuilder - A Supabase query builder (before .range/.limit)
 * @param pageSize - Rows per page (default 1000, matching PostgREST default)
 * @returns All matching rows
 */
export async function fetchAllRows<T extends Record<string, unknown>>(
  queryBuilder: {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
  },
  pageSize: number = 1000
): Promise<{ data: T[]; error: { message: string } | null }> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error } = await queryBuilder.range(offset, offset + pageSize - 1);

    if (error) {
      return { data: allRows, error };
    }

    if (page && page.length > 0) {
      allRows.push(...page);
      offset += page.length;
      hasMore = page.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return { data: allRows, error: null };
}

// =============================================================================
// MATH HELPERS
// =============================================================================

/**
 * Calculate percentage change between two values.
 *
 * @param previous - Previous value
 * @param current - Current value
 * @returns Percentage change (can be negative)
 */
export function percentChange(previous: number, current: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Round a number to specified decimal places.
 *
 * @param value - Value to round
 * @param decimals - Number of decimal places (default 2)
 * @returns Rounded value
 */
export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Safely divide two numbers, returning 0 if divisor is 0.
 *
 * @param numerator - The numerator
 * @param denominator - The denominator
 * @returns The result of division, or 0 if denominator is 0
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}
