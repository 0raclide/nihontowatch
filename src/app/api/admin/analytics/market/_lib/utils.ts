/**
 * Shared utilities for market analytics API routes.
 *
 * This module provides common functions for authentication, parameter parsing,
 * and error handling across all analytics endpoints.
 *
 * @module api/admin/analytics/market/_lib/utils
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { AnalyticsPeriod, AnalyticsGranularity, AnalyticsAPIResponse } from '@/types/analytics';
import type { Currency } from '@/types/index';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of admin verification
 */
export type AdminVerifyResult =
  | { success: true; userId: string }
  | { success: false; response: NextResponse };

/**
 * Parsed date range from period parameter
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
  days: number | null;
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Verify that the current user has admin privileges.
 *
 * Checks:
 * 1. User is authenticated
 * 2. User has 'admin' role in profiles table
 *
 * @param supabase - Supabase client instance
 * @returns AdminVerifyResult with either success and userId, or failure with response
 */
export async function verifyAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<AdminVerifyResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized', timestamp: new Date().toISOString() },
        { status: 401 }
      ),
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>();

  if (profile?.role !== 'admin') {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Forbidden', timestamp: new Date().toISOString() },
        { status: 403 }
      ),
    };
  }

  return { success: true, userId: user.id };
}

// =============================================================================
// PARAMETER PARSING
// =============================================================================

/**
 * Parse an integer parameter from URL search params with validation.
 *
 * @param searchParams - URL search params
 * @param name - Parameter name to parse
 * @param defaultValue - Default value if param is missing or invalid
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @returns Parsed and validated integer
 */
export function parseIntParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  const rawValue = searchParams.get(name);
  if (!rawValue) return defaultValue;

  const parsed = parseInt(rawValue, 10);
  if (isNaN(parsed)) return defaultValue;

  let value = parsed;
  if (min !== undefined && value < min) value = min;
  if (max !== undefined && value > max) value = max;

  return value;
}

/**
 * Parse a float parameter from URL search params with validation.
 *
 * @param searchParams - URL search params
 * @param name - Parameter name to parse
 * @param defaultValue - Default value if param is missing or invalid
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @returns Parsed and validated float, or null if param missing and no default
 */
export function parseFloatParam(
  searchParams: URLSearchParams,
  name: string,
  defaultValue?: number,
  min?: number,
  max?: number
): number | null {
  const rawValue = searchParams.get(name);
  if (!rawValue) {
    return defaultValue ?? null;
  }

  const parsed = parseFloat(rawValue);
  if (isNaN(parsed)) {
    return defaultValue ?? null;
  }

  let value = parsed;
  if (min !== undefined && value < min) value = min;
  if (max !== undefined && value > max) value = max;

  return value;
}

/**
 * Parse currency parameter with validation.
 *
 * @param searchParams - URL search params
 * @param defaultCurrency - Default currency (defaults to JPY)
 * @returns Validated currency code
 */
export function parseCurrencyParam(
  searchParams: URLSearchParams,
  defaultCurrency: Currency = 'JPY'
): Currency {
  const raw = searchParams.get('currency')?.toUpperCase();
  if (raw === 'JPY' || raw === 'USD' || raw === 'EUR') {
    return raw;
  }
  return defaultCurrency;
}

/**
 * Parse period parameter with validation.
 *
 * @param searchParams - URL search params
 * @param defaultPeriod - Default period
 * @returns Validated period
 */
export function parsePeriodParam(
  searchParams: URLSearchParams,
  defaultPeriod: AnalyticsPeriod = '90d'
): AnalyticsPeriod {
  const raw = searchParams.get('period');
  const validPeriods: AnalyticsPeriod[] = ['7d', '30d', '90d', '180d', '1y', 'all'];
  if (raw && validPeriods.includes(raw as AnalyticsPeriod)) {
    return raw as AnalyticsPeriod;
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
 * Parse a date range from a period parameter.
 *
 * @param period - The analytics period
 * @returns DateRange with start date, end date, and number of days
 */
export function parseDateRange(period: AnalyticsPeriod): DateRange {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999); // End of today

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Start of day

  let days: number | null = null;

  switch (period) {
    case '7d':
      days = 7;
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      days = 30;
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      days = 90;
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '180d':
      days = 180;
      startDate.setDate(startDate.getDate() - 180);
      break;
    case '1y':
      days = 365;
      startDate.setDate(startDate.getDate() - 365);
      break;
    case 'all':
      // Set start date to a very old date
      startDate.setFullYear(2000, 0, 1);
      days = null;
      break;
  }

  return { startDate, endDate, days };
}

/**
 * Get comparison date for period-over-period metrics (7 days ago).
 *
 * @returns Date object representing 7 days ago at midnight
 */
export function getComparisonDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  date.setHours(0, 0, 0, 0);
  return date;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

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

/**
 * Create a standardized success response.
 *
 * @param data - Response data
 * @param cacheSeconds - Cache-Control max-age in seconds (0 for no-cache)
 * @returns NextResponse with success JSON
 */
export function successResponse<T>(
  data: T,
  cacheSeconds: number = 0
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

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate that a required parameter is present.
 *
 * @param searchParams - URL search params
 * @param name - Parameter name
 * @returns The parameter value, or null if missing
 */
export function requireParam(
  searchParams: URLSearchParams,
  name: string
): string | null {
  const value = searchParams.get(name);
  return value && value.trim() !== '' ? value.trim() : null;
}

/**
 * Validate breakdown type parameter.
 *
 * @param value - Raw parameter value
 * @returns Validated breakdown type or null
 */
export function validateBreakdownType(
  value: string | null
): 'category' | 'dealer' | 'certification' | null {
  if (value === 'category' || value === 'dealer' || value === 'certification') {
    return value;
  }
  return null;
}

/**
 * Validate metric parameter for trends.
 *
 * @param value - Raw parameter value
 * @returns Validated metric or null
 */
export function validateTrendMetric(
  value: string | null
): 'total_value' | 'median_price' | 'listing_count' | 'available_count' | null {
  const validMetrics = ['total_value', 'median_price', 'listing_count', 'available_count'];
  if (value && validMetrics.includes(value)) {
    return value as 'total_value' | 'median_price' | 'listing_count' | 'available_count';
  }
  return null;
}

// =============================================================================
// PAGINATION
// =============================================================================

/**
 * Fetch all rows from a Supabase query using pagination.
 * Supabase has a default limit of 1000 rows per request.
 *
 * @param supabase - Supabase client instance
 * @param tableName - Table to query
 * @param selectColumns - Columns to select
 * @param filters - Object with filter conditions
 * @param pageSize - Rows per page (default 1000)
 * @returns Array of all matching rows
 */
export async function fetchAllRows<T>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tableName: string,
  selectColumns: string,
  filters: Record<string, unknown> = {},
  pageSize: number = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(tableName)
      .select(selectColumns)
      .range(offset, offset + pageSize - 1);

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'is_available' && value === true) {
        query = query.eq('is_available', true);
      } else if (key === 'price_not_null' && value === true) {
        query = query.not('price_value', 'is', null);
      } else if (key === 'price_gt_zero' && value === true) {
        query = query.gt('price_value', 0);
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Pagination error at offset ${offset}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...(data as T[]));
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate percentage change between two values.
 *
 * @param oldValue - Previous value
 * @param newValue - Current value
 * @returns Percentage change (positive = increase, negative = decrease)
 */
export function calculatePercentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue === 0 ? 0 : 100;
  }
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Round a number to a specified number of decimal places.
 *
 * @param value - Value to round
 * @param decimals - Number of decimal places (default 2)
 * @returns Rounded value
 */
export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
