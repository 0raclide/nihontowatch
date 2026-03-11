import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// force-dynamic because we read searchParams (?date=YYYY-MM-DD)
// In-memory cache handles rate limiting instead of ISR
export const dynamic = 'force-dynamic';

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
  date?: string;
}

// In-memory cache for current rates
let cachedRates: ExchangeRates | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

// In-memory cache for historical rates (date → rates). These never change.
const historicalCache = new Map<string, ExchangeRates>();

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get('date');

    // Historical rate request
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return await fetchHistoricalRates(date);
    }

    // Current rate request (existing behavior)
    const now = Date.now();

    // Return cached rates if still valid
    if (cachedRates && now - cacheTimestamp < CACHE_DURATION) {
      const response = NextResponse.json(cachedRates);
      response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      return response;
    }

    // Fetch fresh rates from Frankfurter API (free, no API key needed)
    // Base is USD, get JPY, EUR, and AUD rates
    const response = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=JPY,EUR,AUD,GBP,CAD,CHF',
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();

    // Build rates object with USD as base (rate = 1)
    const rates: ExchangeRates = {
      base: 'USD',
      rates: {
        USD: 1,
        JPY: data.rates.JPY,
        EUR: data.rates.EUR,
        AUD: data.rates.AUD,
        GBP: data.rates.GBP,
        CAD: data.rates.CAD,
        CHF: data.rates.CHF,
      },
      timestamp: now,
    };

    // Update cache
    cachedRates = rates;
    cacheTimestamp = now;

    const jsonResponse = NextResponse.json(rates);
    jsonResponse.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return jsonResponse;
  } catch (error) {
    logger.error('Exchange rate fetch error', { error });

    // Return fallback rates if API fails
    const fallbackRates: ExchangeRates = {
      base: 'USD',
      rates: {
        USD: 1,
        JPY: 150,
        EUR: 0.92,
        AUD: 1.55,
        GBP: 0.79,
        CAD: 1.37,
        CHF: 0.88,
      },
      timestamp: Date.now(),
    };

    return NextResponse.json(fallbackRates);
  }
}

async function fetchHistoricalRates(date: string): Promise<NextResponse> {
  // Check in-memory cache first (historical rates never change)
  const cached = historicalCache.get(date);
  if (cached) {
    const response = NextResponse.json(cached);
    // Historical rates are immutable — cache for 1 year
    response.headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return response;
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.app/${date}?from=USD&to=JPY,EUR,AUD,GBP,CAD,CHF`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch historical rates for ${date}`);
    }

    const data = await response.json();

    const rates: ExchangeRates = {
      base: 'USD',
      rates: {
        USD: 1,
        JPY: data.rates.JPY,
        EUR: data.rates.EUR,
        AUD: data.rates.AUD,
        GBP: data.rates.GBP,
        CAD: data.rates.CAD,
        CHF: data.rates.CHF,
      },
      timestamp: Date.now(),
      date,
    };

    // Cache indefinitely (historical rates don't change)
    // Limit cache size to prevent memory leaks
    if (historicalCache.size < 1000) {
      historicalCache.set(date, rates);
    }

    const jsonResponse = NextResponse.json(rates);
    jsonResponse.headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return jsonResponse;
  } catch (error) {
    logger.error('Historical exchange rate fetch error', { error, date });

    // Return current rates as fallback for historical request
    const fallbackRates: ExchangeRates = {
      base: 'USD',
      rates: {
        USD: 1,
        JPY: 150,
        EUR: 0.92,
        AUD: 1.55,
        GBP: 0.79,
        CAD: 1.37,
        CHF: 0.88,
      },
      timestamp: Date.now(),
      date,
    };

    return NextResponse.json(fallbackRates);
  }
}
