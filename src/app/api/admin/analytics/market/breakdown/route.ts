/**
 * Market Breakdown API Route
 *
 * Returns market breakdown by category (item type), dealer, or certification.
 * Includes counts, values, market share percentages, and price metrics.
 *
 * @route GET /api/admin/analytics/market/breakdown
 *
 * @query by - Required: 'category' | 'dealer' | 'certification'
 * @query limit - Max items to return (default 20)
 *
 * @returns {AnalyticsAPIResponse<CategoryBreakdownResponse | DealerBreakdownResponse>}
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { convertPriceToJPY } from '@/lib/currency/convert';
import type {
  CategoryBreakdownResponse,
  DealerBreakdownResponse,
  CategoryMetrics,
  DealerMetrics,
  AnalyticsAPIResponse,
} from '@/types/analytics';
import type { ItemType } from '@/types/index';
import { getItemTypeLabel } from '@/types/index';
import {
  verifyAdmin,
  parseIntParam,
  validateBreakdownType,
  errorResponse,
  successResponse,
  roundTo,
  fetchAllRows,
} from '../_lib/utils';
import { median, mean } from '@/lib/analytics/statistics';

export const dynamic = 'force-dynamic';

// =============================================================================
// QUERY RESULT TYPES
// =============================================================================

/** Type for category breakdown query results */
interface CategoryListingRow {
  item_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  is_available: boolean | null;
  is_sold: boolean | null;
}

/** Type for dealer query results */
interface DealerRow {
  id: number;
  name: string;
}

/** Type for dealer breakdown listing query results */
interface DealerListingRow {
  dealer_id: number;
  price_value: number | null;
  price_currency: string | null;
  is_available: boolean | null;
}

/** Type for certification breakdown query results */
interface CertificationListingRow {
  cert_type: string | null;
  price_value: number | null;
  price_currency: string | null;
  is_available: boolean | null;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

// Union type for breakdown responses
type BreakdownResponse = CategoryBreakdownResponse | DealerBreakdownResponse | CertificationBreakdownResponse;

// Certification breakdown response type (not in analytics.ts, so define here)
interface CertificationBreakdownResponse {
  certifications: CertificationMetrics[];
  totals: {
    totalCount: number;
    totalValueJPY: number;
  };
}

interface CertificationMetrics {
  certType: string;
  displayName: string;
  totalCount: number;
  availableCount: number;
  totalValueJPY: number;
  medianPriceJPY: number;
  avgPriceJPY: number;
  countShare: number;
  valueShare: number;
}

/**
 * GET /api/admin/analytics/market/breakdown
 *
 * Returns market breakdown by the specified dimension (category, dealer, or certification).
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsAPIResponse<BreakdownResponse>>> {
  try {
    const supabase = await createClient();

    // 1. Verify admin authentication
    const authResult = await verifyAdmin(supabase);
    if (!authResult.success) {
      return authResult.response as NextResponse<AnalyticsAPIResponse<BreakdownResponse>>;
    }

    // 2. Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const byParam = searchParams.get('by');
    const breakdownType = validateBreakdownType(byParam);
    const limit = parseIntParam(searchParams, 'limit', 20, 1, 100);

    if (!breakdownType) {
      return errorResponse(
        "Missing or invalid 'by' parameter. Must be one of: category, dealer, certification",
        400
      );
    }

    // 3. Route to appropriate handler based on breakdown type
    switch (breakdownType) {
      case 'category':
        return await getCategoryBreakdown(supabase, limit);
      case 'dealer':
        return await getDealerBreakdown(supabase, limit);
      case 'certification':
        return await getCertificationBreakdown(supabase, limit);
      default:
        return errorResponse('Invalid breakdown type', 400);
    }
  } catch (error) {
    logger.logError('Market breakdown API error', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Get market breakdown by item category (item_type).
 */
async function getCategoryBreakdown(
  supabase: Awaited<ReturnType<typeof createClient>>,
  limit: number
): Promise<NextResponse<AnalyticsAPIResponse<CategoryBreakdownResponse>>> {
  // Fetch ALL listings with pagination (Supabase default limit is 1000)
  const listings = await fetchAllRows<CategoryListingRow>(
    supabase,
    'listings',
    'item_type, price_value, price_currency, is_available, is_sold',
    {} // No filters - we need all for category breakdown
  );

  logger.info('Category breakdown fetched listings', { count: listings.length });

  if (listings.length === 0) {
    const emptyResponse: CategoryBreakdownResponse = {
      categories: [],
      totals: { totalCount: 0, totalValueJPY: 0, medianPriceJPY: 0 },
    };
    return successResponse(emptyResponse, 300);
  }

  // Group listings by item_type
  const categoryMap = new Map<
    string,
    {
      total: number;
      available: number;
      sold: number;
      prices: number[];
    }
  >();

  let totalAvailableCount = 0;
  let totalAvailableValue = 0;
  const allAvailablePrices: number[] = [];

  for (const listing of listings) {
    const itemType = listing.item_type || 'unknown';
    const priceJPY = convertPriceToJPY(listing.price_value, listing.price_currency);

    if (!categoryMap.has(itemType)) {
      categoryMap.set(itemType, { total: 0, available: 0, sold: 0, prices: [] });
    }

    const category = categoryMap.get(itemType)!;
    category.total++;

    if (listing.is_available) {
      category.available++;
      if (priceJPY > 0) {
        category.prices.push(priceJPY);
        totalAvailableCount++;
        totalAvailableValue += priceJPY;
        allAvailablePrices.push(priceJPY);
      }
    }

    if (listing.is_sold) {
      category.sold++;
    }
  }

  // Calculate market-wide median for comparison
  const marketMedian = median(allAvailablePrices);

  // Convert to CategoryMetrics array
  const categories: CategoryMetrics[] = [];

  for (const [itemType, data] of categoryMap) {
    const categoryMedian = median(data.prices);
    const categoryAvg = mean(data.prices);
    const categoryTotal = data.prices.reduce((sum, p) => sum + p, 0);

    const metrics: CategoryMetrics = {
      itemType: itemType as ItemType,
      displayName: getItemTypeLabel(itemType as ItemType),
      totalCount: data.total,
      availableCount: data.available,
      soldCount: data.sold,
      totalValueJPY: roundTo(categoryTotal, 0),
      medianPriceJPY: roundTo(categoryMedian, 0),
      avgPriceJPY: roundTo(categoryAvg, 0),
      priceRange: {
        min: data.prices.length > 0 ? Math.min(...data.prices) : 0,
        max: data.prices.length > 0 ? Math.max(...data.prices) : 0,
      },
      countShare: totalAvailableCount > 0 ? roundTo(data.available / totalAvailableCount, 4) : 0,
      valueShare: totalAvailableValue > 0 ? roundTo(categoryTotal / totalAvailableValue, 4) : 0,
      priceVsMarket:
        marketMedian > 0 ? roundTo((categoryMedian - marketMedian) / marketMedian, 4) : 0,
    };

    categories.push(metrics);
  }

  // Sort by available count and limit
  categories.sort((a, b) => b.availableCount - a.availableCount);
  const limitedCategories = categories.slice(0, limit);

  const response: CategoryBreakdownResponse = {
    categories: limitedCategories,
    totals: {
      totalCount: totalAvailableCount,
      totalValueJPY: roundTo(totalAvailableValue, 0),
      medianPriceJPY: roundTo(marketMedian, 0),
    },
  };

  return successResponse(response, 300);
}

/**
 * Get market breakdown by dealer.
 */
async function getDealerBreakdown(
  supabase: Awaited<ReturnType<typeof createClient>>,
  limit: number
): Promise<NextResponse<AnalyticsAPIResponse<DealerBreakdownResponse>>> {
  // Query dealers
  const { data: dealersData, error: dealersError } = await supabase
    .from('dealers')
    .select('id, name')
    .eq('is_active', true);

  if (dealersError) {
    logger.error('Dealer query error', { error: dealersError });
    return errorResponse('Failed to fetch dealer data', 500);
  }

  const dealers = (dealersData || []) as DealerRow[];

  // Fetch ALL listings with pagination (Supabase default limit is 1000)
  const listings = await fetchAllRows<DealerListingRow>(
    supabase,
    'listings',
    'dealer_id, price_value, price_currency, is_available',
    { is_available: true, price_not_null: true }
  );

  logger.info('Dealer breakdown fetched listings', { count: listings.length });

  // Create dealer name lookup
  const dealerNames = new Map<number, string>();
  for (const dealer of dealers) {
    dealerNames.set(dealer.id, dealer.name);
  }

  // Group listings by dealer
  const dealerMap = new Map<
    number,
    {
      count: number;
      prices: number[];
    }
  >();

  let totalCount = 0;
  let totalValue = 0;

  for (const listing of listings) {
    const dealerId = listing.dealer_id;
    const priceJPY = convertPriceToJPY(listing.price_value, listing.price_currency);

    if (!dealerMap.has(dealerId)) {
      dealerMap.set(dealerId, { count: 0, prices: [] });
    }

    const dealer = dealerMap.get(dealerId)!;
    dealer.count++;

    if (priceJPY > 0) {
      dealer.prices.push(priceJPY);
      totalCount++;
      totalValue += priceJPY;
    }
  }

  // Convert to DealerMetrics array
  const dealerMetrics: DealerMetrics[] = [];

  for (const [dealerId, data] of dealerMap) {
    const dealerTotal = data.prices.reduce((sum, p) => sum + p, 0);

    const metrics: DealerMetrics = {
      dealerId,
      dealerName: dealerNames.get(dealerId) || `Dealer #${dealerId}`,
      totalCount: data.count,
      availableCount: data.count,
      totalValueJPY: roundTo(dealerTotal, 0),
      medianPriceJPY: roundTo(median(data.prices), 0),
      avgPriceJPY: roundTo(mean(data.prices), 0),
      countShare: totalCount > 0 ? roundTo(data.count / totalCount, 4) : 0,
      valueShare: totalValue > 0 ? roundTo(dealerTotal / totalValue, 4) : 0,
    };

    dealerMetrics.push(metrics);
  }

  // Sort by available count and limit
  dealerMetrics.sort((a, b) => b.availableCount - a.availableCount);
  const limitedDealers = dealerMetrics.slice(0, limit);

  const response: DealerBreakdownResponse = {
    dealers: limitedDealers,
    totals: {
      totalCount,
      totalValueJPY: roundTo(totalValue, 0),
    },
  };

  return successResponse(response, 300);
}

/**
 * Get market breakdown by certification type.
 */
async function getCertificationBreakdown(
  supabase: Awaited<ReturnType<typeof createClient>>,
  limit: number
): Promise<NextResponse<AnalyticsAPIResponse<CertificationBreakdownResponse>>> {
  // Fetch ALL listings with pagination (Supabase default limit is 1000)
  // We filter for cert_type in code since we can't do NOT NULL in the generic fetcher
  const allListings = await fetchAllRows<CertificationListingRow>(
    supabase,
    'listings',
    'cert_type, price_value, price_currency, is_available',
    { is_available: true }
  );

  // Filter for listings with certifications
  const listings = allListings.filter(l => l.cert_type !== null && l.cert_type !== '');

  logger.info('Certification breakdown fetched listings', { count: listings.length });

  if (listings.length === 0) {
    const emptyResponse: CertificationBreakdownResponse = {
      certifications: [],
      totals: { totalCount: 0, totalValueJPY: 0 },
    };
    return successResponse(emptyResponse, 300);
  }

  // Group listings by cert_type
  const certMap = new Map<
    string,
    {
      count: number;
      prices: number[];
    }
  >();

  let totalCount = 0;
  let totalValue = 0;

  for (const listing of listings) {
    const certType = listing.cert_type || 'None';
    const priceJPY = convertPriceToJPY(listing.price_value, listing.price_currency);

    if (!certMap.has(certType)) {
      certMap.set(certType, { count: 0, prices: [] });
    }

    const cert = certMap.get(certType)!;
    cert.count++;

    if (priceJPY > 0) {
      cert.prices.push(priceJPY);
      totalCount++;
      totalValue += priceJPY;
    }
  }

  // Convert to CertificationMetrics array
  const certMetrics: CertificationMetrics[] = [];

  for (const [certType, data] of certMap) {
    const certTotal = data.prices.reduce((sum, p) => sum + p, 0);

    const metrics: CertificationMetrics = {
      certType,
      displayName: formatCertificationName(certType),
      totalCount: data.count,
      availableCount: data.count,
      totalValueJPY: roundTo(certTotal, 0),
      medianPriceJPY: roundTo(median(data.prices), 0),
      avgPriceJPY: roundTo(mean(data.prices), 0),
      countShare: totalCount > 0 ? roundTo(data.count / totalCount, 4) : 0,
      valueShare: totalValue > 0 ? roundTo(certTotal / totalValue, 4) : 0,
    };

    certMetrics.push(metrics);
  }

  // Sort by count and limit
  certMetrics.sort((a, b) => b.totalCount - a.totalCount);
  const limitedCerts = certMetrics.slice(0, limit);

  const response: CertificationBreakdownResponse = {
    certifications: limitedCerts,
    totals: {
      totalCount,
      totalValueJPY: roundTo(totalValue, 0),
    },
  };

  return successResponse(response, 300);
}


/**
 * Format certification type for display.
 */
function formatCertificationName(certType: string): string {
  // Map common certification abbreviations to full names
  const certNames: Record<string, string> = {
    'Juyo': 'Juyo Token',
    'Tokubetsu Juyo': 'Tokubetsu Juyo Token',
    'Hozon': 'Hozon Token',
    'Tokubetsu Hozon': 'Tokubetsu Hozon Token',
    'Juyo Tosogu': 'Juyo Tosogu',
    'Tokubetsu Hozon Tosogu': 'Tokubetsu Hozon Tosogu',
    'Hozon Tosogu': 'Hozon Tosogu',
    'NTHK Kanteisho': 'NTHK Kanteisho',
  };

  return certNames[certType] || certType;
}
