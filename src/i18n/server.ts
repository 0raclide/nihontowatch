/**
 * Server-side locale helpers.
 *
 * Used in Server Components (layout.tsx, page.tsx) to read the locale
 * from the request cookie without pulling in React context.
 */

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, type Locale } from './index';

/**
 * Read the current locale from the `nw-locale` cookie (server-side).
 * Returns DEFAULT_LOCALE ('en') if the cookie is missing or invalid.
 */
export async function getServerLocale(): Promise<Locale> {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}
