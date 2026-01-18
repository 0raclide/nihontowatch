/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Japanese character detection regex
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

interface TranslateRequest {
  listingId: number;
}

interface ListingForTranslation {
  id: number;
  description: string | null;
  description_en: string | null;
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
 * Translate a listing description to English using OpenRouter
 * Caches the translation in the database for future requests
 */
export async function POST(request: NextRequest) {
  try {
    const body: TranslateRequest = await request.json();
    const { listingId } = body;

    if (!listingId || typeof listingId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid listingId' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch the listing with description and existing translation
    const { data, error: fetchError } = await supabase
      .from('listings')
      .select('id, description, description_en, item_type')
      .eq('id', listingId)
      .single();

    const listing = data as ListingForTranslation | null;

    if (fetchError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // If no description, return null
    if (!listing.description) {
      return NextResponse.json({
        translation: null,
        cached: true,
        reason: 'no_description',
      });
    }

    // If already translated, return cached version
    if (listing.description_en) {
      return NextResponse.json({
        translation: listing.description_en,
        cached: true,
      });
    }

    // Check if description contains Japanese
    if (!JAPANESE_REGEX.test(listing.description)) {
      // No Japanese text, store original as translation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('listings')
        .update({ description_en: listing.description })
        .eq('id', listingId);

      return NextResponse.json({
        translation: listing.description,
        cached: false,
        reason: 'no_japanese',
      });
    }

    // Translate using OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
      return NextResponse.json({
        translation: listing.description,
        cached: false,
        error: 'Translation service unavailable',
      });
    }

    // Determine item context for better translation
    const itemContext = listing.item_type?.includes('tsuba') ||
      listing.item_type?.includes('menuki') ||
      listing.item_type?.includes('kozuka') ||
      listing.item_type?.includes('kogai') ||
      listing.item_type?.includes('fuchi') ||
      listing.item_type?.includes('kashira')
      ? 'sword fitting (tosogu)'
      : 'Japanese sword (nihonto)';

    const prompt = `Translate this Japanese ${itemContext} dealer description to English.
Preserve technical terms in romaji (mei, mumei, nagasa, sori, shakudo, etc.).
Keep formatting and line breaks.
Only output the translation, no explanations or preamble.

${listing.description}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nihontowatch.com',
        'X-Title': 'Nihontowatch',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{
          role: 'user',
          content: prompt,
        }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);

      // Return original description on API failure
      return NextResponse.json({
        translation: listing.description,
        cached: false,
        error: 'Translation failed',
      });
    }

    const responseData: OpenRouterResponse = await response.json();
    const translation = responseData.choices?.[0]?.message?.content?.trim();

    if (!translation) {
      console.error('Empty translation response');
      return NextResponse.json({
        translation: listing.description,
        cached: false,
        error: 'Empty translation',
      });
    }

    // Cache the translation in the database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('listings')
      .update({ description_en: translation })
      .eq('id', listingId);

    if (updateError) {
      console.error('Failed to cache translation:', updateError);
      // Still return the translation even if caching failed
    }

    return NextResponse.json({
      translation,
      cached: false,
    });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
