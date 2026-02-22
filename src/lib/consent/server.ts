/**
 * Server-side GDPR region helper.
 *
 * Used in Server Components (layout.tsx) to read the GDPR region flag
 * from the request cookie without pulling in React context.
 * Mirrors the pattern from src/i18n/server.ts.
 */

import { cookies } from 'next/headers';
import { GDPR_COOKIE } from './gdpr';

/**
 * Read the GDPR region flag from the `nw-gdpr` cookie (server-side).
 * Returns true if the visitor is in a GDPR jurisdiction, false otherwise.
 * Defaults to false if cookie is missing (local dev / non-Vercel).
 */
export async function getServerGdprRegion(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(GDPR_COOKIE)?.value;
  return raw === '1';
}
