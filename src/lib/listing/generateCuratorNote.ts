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

export interface CuratorNoteResult {
  note: string | null;
  headline: string | null;
}

/**
 * Parse the HEADLINE: ... \n---\n ... format from the LLM response.
 * Falls back to treating the entire response as the note if no delimiter is found.
 */
export function parseHeadlineAndNote(raw: string): CuratorNoteResult {
  const match = raw.match(/^HEADLINE:\s*(.+?)\n---\n([\s\S]+)$/);
  if (match) {
    return { headline: match[1].trim(), note: match[2].trim() };
  }
  // Fallback: no delimiter — treat entire response as note
  return { headline: null, note: raw.trim() };
}

/**
 * Generate a curator's note for the given context and language.
 *
 * @returns The generated note and headline, or nulls on error.
 */
export async function generateCuratorNote(
  context: CuratorNoteContext,
  lang: 'en' | 'ja'
): Promise<CuratorNoteResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.error('OPENROUTER_API_KEY not configured');
    return { note: null, headline: null };
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
      return { note: null, headline: null };
    }

    const data: OpenRouterResponse = await response.json();

    if (data.error) {
      logger.error('OpenRouter returned error', { error: data.error.message, lang });
      return { note: null, headline: null };
    }

    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      logger.error('Empty curator note response', { lang });
      return { note: null, headline: null };
    }

    return parseHeadlineAndNote(content);
  } catch (error) {
    logger.logError('Curator note generation failed', error, { lang });
    return { note: null, headline: null };
  }
}
