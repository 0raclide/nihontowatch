/**
 * Report Missing URL API
 *
 * POST /api/admin/report-missing-url
 * Body: { url: string }
 *
 * Admin-only endpoint to flag a dealer URL as missing from the database.
 * Inserts into discovered_urls with high priority so the scraper team can investigate.
 */

import { NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/auth';
import { normalizeUrl } from '@/lib/urlNormalization';
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from '@/lib/api/responses';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const supabase = await createClient();
    const authResult = await verifyAdmin(supabase);

    if (!authResult.isAdmin) {
      return authResult.error === 'unauthorized' ? apiUnauthorized() : apiForbidden();
    }

    const { user } = authResult;

    // Parse request body
    let body: { url: string };
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    if (!body.url || typeof body.url !== 'string') {
      return apiBadRequest('url is required and must be a string');
    }

    const rawUrl = body.url.trim();

    // Basic URL validation
    const urlPattern = /^(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z]{2,})+(?::\d+)?(?:\/\S*)?$/;
    if (!urlPattern.test(rawUrl)) {
      return apiBadRequest('Invalid URL format');
    }

    // Normalize the URL
    const normalized = normalizeUrl(rawUrl);

    // Extract domain from the normalized URL (everything before the first /)
    const domain = normalized.split('/')[0];

    // Use service client for DB operations (RLS bypass)
    const serviceClient = createServiceClient();

    // Find dealer by matching domain
    const { data: dealers, error: dealerError } = await serviceClient
      .from('dealers')
      .select('id, name, domain')
      .eq('is_active', true);

    if (dealerError) {
      logger.error('Failed to fetch dealers for URL matching', { error: dealerError.message });
      return apiServerError('Failed to look up dealers');
    }

    // Match by checking if the URL domain contains or is contained by the dealer domain
    const matchedDealer = dealers?.find(d => {
      const dealerDomain = d.domain.replace(/^www\./, '');
      return domain.includes(dealerDomain) || dealerDomain.includes(domain);
    });

    if (!matchedDealer) {
      return apiBadRequest(`Could not identify dealer from URL domain "${domain}". Known dealers must be registered first.`);
    }

    // Ensure URL has protocol for storage (discovered_urls expects full URLs)
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    // Upsert into discovered_urls with high priority
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (serviceClient
      .from('discovered_urls') as any)
      .upsert(
        {
          url: fullUrl,
          dealer_id: matchedDealer.id,
          is_scraped: false,
          scrape_priority: 10,
          discovered_at: new Date().toISOString(),
        },
        { onConflict: 'url' }
      );

    if (insertError) {
      logger.error('Failed to insert discovered URL', {
        url: fullUrl,
        dealerId: matchedDealer.id,
        error: insertError.message,
      });
      return apiServerError(`Failed to save URL: ${insertError.message}`);
    }

    logger.info('Missing URL reported by admin', {
      url: fullUrl,
      dealerName: matchedDealer.name,
      dealerId: matchedDealer.id,
      userId: user.id,
    });

    return apiSuccess({
      success: true,
      dealer_name: matchedDealer.name,
      url: fullUrl,
    });
  } catch (error) {
    logger.logError('Report missing URL error', error);
    return apiServerError();
  }
}
