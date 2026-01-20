import { NextResponse } from 'next/server';

// Enable ISR caching - rates don't change frequently
// Removed force-dynamic which was conflicting with revalidate
export const revalidate = 3600; // Cache for 1 hour

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

// In-memory cache
let cachedRates: ExchangeRates | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in ms

export async function GET() {
  try {
    const now = Date.now();

    // Return cached rates if still valid
    if (cachedRates && now - cacheTimestamp < CACHE_DURATION) {
      const response = NextResponse.json(cachedRates);
      response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      return response;
    }

    // Fetch fresh rates from Frankfurter API (free, no API key needed)
    // Base is USD, get JPY and EUR rates
    const response = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=JPY,EUR',
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
    console.error('Exchange rate fetch error:', error);

    // Return fallback rates if API fails
    const fallbackRates: ExchangeRates = {
      base: 'USD',
      rates: {
        USD: 1,
        JPY: 150, // Approximate fallback
        EUR: 0.92, // Approximate fallback
      },
      timestamp: Date.now(),
    };

    return NextResponse.json(fallbackRates);
  }
}
