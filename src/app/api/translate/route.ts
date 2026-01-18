/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Japanese character detection regex
const JAPANESE_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

interface TranslateRequest {
  listingId: number;
  type?: 'description' | 'title';
}

interface ListingForTranslation {
  id: number;
  title: string | null;
  title_en: string | null;
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
 * Translate a listing title or description to English using OpenRouter
 * Caches the translation in the database for future requests
 *
 * Body: { listingId: number, type?: 'description' | 'title' }
 * Defaults to 'description' for backwards compatibility
 */
export async function POST(request: NextRequest) {
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

    const supabase = await createClient();

    // Fetch the listing with both original and translated fields
    const { data, error: fetchError } = await supabase
      .from('listings')
      .select('id, title, title_en, description, description_en, item_type')
      .eq('id', listingId)
      .single();

    const listing = data as ListingForTranslation | null;

    if (fetchError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Determine which field to translate
    const sourceField = type === 'title' ? listing.title : listing.description;
    const cachedField = type === 'title' ? listing.title_en : listing.description_en;
    const targetColumn = type === 'title' ? 'title_en' : 'description_en';

    // If no source text, return null
    if (!sourceField) {
      return NextResponse.json({
        translation: null,
        cached: true,
        reason: `no_${type}`,
      });
    }

    // If already translated, return cached version
    if (cachedField) {
      return NextResponse.json({
        translation: cachedField,
        cached: true,
      });
    }

    // Check if source contains Japanese
    if (!JAPANESE_REGEX.test(sourceField)) {
      // No Japanese text, store original as translation
      await (supabase as any)
        .from('listings')
        .update({ [targetColumn]: sourceField })
        .eq('id', listingId);

      return NextResponse.json({
        translation: sourceField,
        cached: false,
        reason: 'no_japanese',
      });
    }

    // Translate using OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
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

    // Different prompts for title vs description
    let prompt: string;
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
        max_tokens: type === 'title' ? 200 : 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);

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
      console.error('Empty translation response');
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
