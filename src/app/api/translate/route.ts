/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { apiRateLimited } from '@/lib/api/responses';

export const dynamic = 'force-dynamic';

// =============================================================================
// Rate Limiting (in-memory, per IP)
// =============================================================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 translations/min per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

/** @internal Exported only for test cleanup */
export function _resetRateLimitForTesting() {
  rateLimitMap.clear();
}

import { isPredominantlyJapanese } from '@/lib/text/japanese';

interface TranslateRequest {
  listingId: number;
  type?: 'description' | 'title';
}

interface ListingForTranslation {
  id: number;
  title: string | null;
  title_en: string | null;
  title_ja: string | null;
  description: string | null;
  description_en: string | null;
  description_ja: string | null;
  item_type: string | null;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * POST /api/translate
 * Bidirectional listing translation using OpenRouter.
 * Auto-detects direction from source text:
 *   - Japanese source → translates to English (title_en / description_en)
 *   - English source  → translates to Japanese (title_ja / description_ja)
 * Caches the translation in the database for future requests.
 *
 * Body: { listingId: number, type?: 'description' | 'title' }
 * Defaults to 'description' for backwards compatibility
 */
export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return apiRateLimited(60);
  }

  try {
    const body: TranslateRequest = await request.json();
    const { listingId, type = 'description' } = body;

    if (!listingId || typeof listingId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid listingId' },
        { status: 400 }
      );
    }

    if (type !== 'description' && type !== 'title') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "description" or "title"' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch the listing with both original and translated fields
    const { data, error: fetchError } = await supabase
      .from('listings')
      .select('id, title, title_en, title_ja, description, description_en, description_ja, item_type')
      .eq('id', listingId)
      .single();

    const listing = data as ListingForTranslation | null;

    if (fetchError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Determine translation direction based on whether source contains Japanese
    const sourceField = type === 'title' ? listing.title : listing.description;

    // If no source text, return null
    if (!sourceField) {
      return NextResponse.json({
        translation: null,
        cached: true,
        reason: `no_${type}`,
      });
    }

    // Auto-detect direction: JP→EN (existing) or EN→JP (new)
    const hasJapanese = isPredominantlyJapanese(sourceField);
    const direction: 'jp_to_en' | 'en_to_jp' = hasJapanese ? 'jp_to_en' : 'en_to_jp';

    // Select the right cached field and target column based on direction
    const cachedField = direction === 'jp_to_en'
      ? (type === 'title' ? listing.title_en : listing.description_en)
      : (type === 'title' ? listing.title_ja : listing.description_ja);
    const targetColumn = direction === 'jp_to_en'
      ? (type === 'title' ? 'title_en' : 'description_en')
      : (type === 'title' ? 'title_ja' : 'description_ja');

    // If already translated, return cached version
    if (cachedField) {
      return NextResponse.json({
        translation: cachedField,
        cached: true,
      });
    }

    // Translate using OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      logger.error('OPENROUTER_API_KEY not configured');
      return NextResponse.json({
        translation: sourceField,
        cached: false,
        error: 'Translation service unavailable',
      });
    }

    // Determine item context for better translation
    const isTosogu = listing.item_type?.includes('tsuba') ||
      listing.item_type?.includes('menuki') ||
      listing.item_type?.includes('kozuka') ||
      listing.item_type?.includes('kogai') ||
      listing.item_type?.includes('fuchi') ||
      listing.item_type?.includes('kashira');

    const itemContext = isTosogu
      ? 'sword fitting (tosogu)'
      : 'Japanese sword (nihonto)';

    // Build prompt based on direction and type
    let prompt: string;
    if (direction === 'jp_to_en') {
      // JP→EN prompts (existing)
      if (type === 'title') {
        prompt = `Translate this Japanese ${itemContext} listing title to English.
Keep it concise. Preserve technical terms in romaji (mei, mumei, etc.).
Preserve proper names (smith names, schools).
Only output the translation, no explanations.

${sourceField}`;
      } else {
        prompt = `Translate this Japanese ${itemContext} dealer description to English.
Preserve technical terms in romaji (mei, mumei, nagasa, sori, shakudo, etc.).
Keep formatting and line breaks.
Only output the translation, no explanations or preamble.

${sourceField}`;
      }
    } else {
      // EN→JP prompts (new)
      if (type === 'title') {
        prompt = `Translate this English ${itemContext} listing title to natural Japanese.
Use appropriate kanji for standard sword terminology.
Preserve proper names in their standard kanji form where known.
Only output the translation, no explanations.

${sourceField}`;
      } else {
        prompt = `Translate this English ${itemContext} dealer description to natural Japanese.
Write as a knowledgeable Japanese dealer would — formal but accessible.
Use standard nihonto terminology in kanji (銘, 無銘, 長さ, 反り, 赤銅, 四分一, etc.).
Keep formatting and line breaks.
Only output the translation, no explanations or preamble.

${sourceField}`;
      }
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nihontowatch.com',
        'X-Title': 'Nihontowatch',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{
          role: 'user',
          content: prompt,
        }],
        max_tokens: type === 'title' ? 200 : 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenRouter API error', { status: response.status, errorText });

      // Return original text on API failure
      return NextResponse.json({
        translation: sourceField,
        cached: false,
        error: 'Translation failed',
      });
    }

    const responseData: OpenRouterResponse = await response.json();
    const translation = responseData.choices?.[0]?.message?.content?.trim();

    if (!translation) {
      logger.error('Empty translation response', { listingId });
      return NextResponse.json({
        translation: sourceField,
        cached: false,
        error: 'Empty translation',
      });
    }

    // Cache the translation in the database
    const { error: updateError } = await (supabase as any)
      .from('listings')
      .update({ [targetColumn]: translation })
      .eq('id', listingId);

    if (updateError) {
      logger.error('Failed to cache translation', { error: updateError, listingId });
      // Still return the translation even if caching failed
    }

    return NextResponse.json({
      translation,
      cached: false,
    });
  } catch (error) {
    logger.logError('Translation API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
