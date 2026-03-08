/**
 * Curator's Note — AI Generation via OpenRouter
 *
 * Calls Opus 4.6 via OpenRouter to generate curator's notes.
 * Follows the same OpenRouter pattern as src/app/api/translate/route.ts.
 *
 * @module lib/listing/generateCuratorNote
 */

import { logger } from '@/lib/logger';
import type { CuratorNoteContext } from './curatorNote';
import { buildSystemPrompt, buildUserPrompt } from './curatorNotePrompt';

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

/**
 * Generate a curator's note for the given context and language.
 *
 * @returns The generated note text, or null on error.
 */
export async function generateCuratorNote(
  context: CuratorNoteContext,
  lang: 'en' | 'ja'
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.error('OPENROUTER_API_KEY not configured');
    return null;
  }

  const systemPrompt = buildSystemPrompt(lang);
  const userPrompt = buildUserPrompt(context, lang);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nihontowatch.com',
        'X-Title': 'Nihontowatch',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4-6',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: lang === 'en' ? 1500 : 2000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenRouter API error for curator note', {
        status: response.status,
        errorText,
        lang,
      });
      return null;
    }

    const data: OpenRouterResponse = await response.json();

    if (data.error) {
      logger.error('OpenRouter returned error', { error: data.error.message, lang });
      return null;
    }

    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      logger.error('Empty curator note response', { lang });
      return null;
    }

    return content;
  } catch (error) {
    logger.logError('Curator note generation failed', error, { lang });
    return null;
  }
}
