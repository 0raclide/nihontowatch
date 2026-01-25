import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface GeoResult {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  timezone: string;
}

// Batch lookup IPs using ip-api.com (free, supports batch requests)
async function lookupIPs(ips: string[]): Promise<Record<string, GeoResult>> {
  const results: Record<string, GeoResult> = {};

  // ip-api.com batch endpoint (max 100 per request)
  const batches: string[][] = [];
  for (let i = 0; i < ips.length; i += 100) {
    batches.push(ips.slice(i, i + 100));
  }

  for (const batch of batches) {
    try {
      const response = await fetch('http://ip-api.com/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          batch.map((ip) => ({
            query: ip,
            fields: 'status,country,countryCode,regionName,city,isp,timezone',
          }))
        ),
      });

      if (response.ok) {
        const data = await response.json();
        data.forEach((result: {
          query: string;
          status: string;
          country?: string;
          countryCode?: string;
          regionName?: string;
          city?: string;
          isp?: string;
          timezone?: string;
        }, index: number) => {
          if (result.status === 'success') {
            results[batch[index]] = {
              country: result.country || 'Unknown',
              countryCode: result.countryCode || 'XX',
              region: result.regionName || '',
              city: result.city || '',
              isp: result.isp || '',
              timezone: result.timezone || '',
            };
          } else {
            results[batch[index]] = {
              country: 'Unknown',
              countryCode: 'XX',
              region: '',
              city: '',
              isp: '',
              timezone: '',
            };
          }
        });
      }

      // Rate limit: ip-api.com allows 45 requests/minute for free tier
      // Adding a small delay between batches
      if (batches.length > 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (error) {
      logger.error('Geo lookup error', { error });
      // Fill with unknown for failed batch
      batch.forEach((ip) => {
        results[ip] = {
          country: 'Unknown',
          countryCode: 'XX',
          region: '',
          city: '',
          isp: '',
          timezone: '',
        };
      });
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ips } = body as { ips: string[] };

    if (!Array.isArray(ips) || ips.length === 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Limit to 500 IPs max
    const limitedIPs = ips.slice(0, 500);

    // Filter out invalid IPs
    const validIPs = limitedIPs.filter((ip) => {
      // Basic IPv4/IPv6 validation
      return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.includes(':');
    });

    if (validIPs.length === 0) {
      return NextResponse.json({ geoData: {} });
    }

    const geoData = await lookupIPs(validIPs);

    // Aggregate by country for summary
    const byCountry: Record<string, { count: number; countryCode: string }> = {};
    Object.values(geoData).forEach((geo) => {
      if (!byCountry[geo.country]) {
        byCountry[geo.country] = { count: 0, countryCode: geo.countryCode };
      }
      byCountry[geo.country].count++;
    });

    const countrySummary = Object.entries(byCountry)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([country, data]) => ({
        country,
        countryCode: data.countryCode,
        count: data.count,
        percentage: (data.count / validIPs.length) * 100,
      }));

    return NextResponse.json({
      geoData,
      countrySummary,
      totalIPs: validIPs.length,
    });
  } catch (error) {
    logger.logError('Geo API error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
