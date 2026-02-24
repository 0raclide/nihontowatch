import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { verifyCronAuth } from '@/lib/api/cronAuth';

/**
 * POST /api/admin/refresh-price-jpy
 *
 * Refreshes all price_jpy values using live exchange rates.
 * This ensures accurate cross-currency price sorting.
 *
 * Should be called:
 * - Periodically via cron (e.g., weekly)
 * - After significant exchange rate movements
 * - After bulk listing imports
 */
export async function POST(request: NextRequest) {
  // Verify authorization (cron or admin API key)
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch current exchange rates
    const ratesResponse = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=JPY,EUR,GBP,AUD',
      { cache: 'no-store' }
    );

    let usdToJpy = 150; // fallback
    let eurToJpy = 160; // fallback
    let gbpToJpy = 190; // fallback
    let audToJpy = 97;  // fallback

    if (ratesResponse.ok) {
      const ratesData = await ratesResponse.json();
      // Rates are relative to USD (base)
      // JPY rate = how many JPY per 1 USD
      // EUR rate = how many EUR per 1 USD
      usdToJpy = ratesData.rates.JPY || 150;

      // To convert EUR to JPY: EUR -> USD -> JPY
      // EUR to USD = 1 / EUR_rate, then USD to JPY = * JPY_rate
      const eurRate = ratesData.rates.EUR || 0.92;
      eurToJpy = usdToJpy / eurRate;

      // Same for GBP
      const gbpRate = ratesData.rates.GBP || 0.79;
      gbpToJpy = usdToJpy / gbpRate;

      // Same for AUD
      const audRate = ratesData.rates.AUD || 1.55;
      audToJpy = usdToJpy / audRate;
    }

    const supabase = await createClient();

    // Call the database function to refresh all price_jpy values
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('refresh_price_jpy', {
      usd_to_jpy: usdToJpy,
      eur_to_jpy: eurToJpy,
      gbp_to_jpy: gbpToJpy,
      aud_to_jpy: audToJpy,
    });

    if (error) {
      logger.error('Failed to refresh price_jpy', { error });
      return NextResponse.json(
        { error: 'Failed to refresh prices', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: data,
      rates: {
        usdToJpy: Math.round(usdToJpy * 100) / 100,
        eurToJpy: Math.round(eurToJpy * 100) / 100,
        gbpToJpy: Math.round(gbpToJpy * 100) / 100,
        audToJpy: Math.round(audToJpy * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.logError('Price refresh error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for cron triggers
export async function GET(request: NextRequest) {
  return POST(request);
}
