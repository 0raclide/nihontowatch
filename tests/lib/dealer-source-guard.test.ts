/**
 * Structural regression test: dealer portal listing isolation
 *
 * Ensures all user-facing code paths that query the `listings` table
 * include the `.neq('source', 'dealer')` guard (or equivalent).
 *
 * This test exists because dealer portal test listings leaked into
 * saved search alerts (P0 incident 2026-03-03). The root cause was
 * that `source = 'dealer'` filtering was only applied in 3 of 15+
 * query paths.
 *
 * Defense-in-depth:
 * 1. RLS policy (migration 098) — database-level, protects all paths
 * 2. Application-level `.neq('source', 'dealer')` — code-level guard
 * 3. THIS TEST — catches new unguarded code before it ships
 *
 * To add a new file to the allowlist, add it to KNOWN_SAFE_FILES below
 * with a comment explaining why it doesn't need the guard.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Files that query .from('listings') but are KNOWN SAFE (don't need the guard):
// - Admin-only endpoints (use service_role key, RLS bypassed)
// - Dealer portal APIs (intentionally query dealer listings)
// - Cron compute jobs (don't return data to users)
// - Debug endpoints
const KNOWN_SAFE_FILES = new Set([
  // Admin endpoints (service_role key — RLS bypassed)
  'src/app/api/listing/[id]/fix-artisan/route.ts',
  'src/app/api/listing/[id]/fix-cert/route.ts',
  'src/app/api/listing/[id]/fix-fields/route.ts',
  'src/app/api/listing/[id]/set-status/route.ts',
  'src/app/api/listing/[id]/unlock-fields/route.ts',
  'src/app/api/listing/[id]/hide/route.ts',
  'src/app/api/listing/[id]/verify-artisan/route.ts',
  'src/app/api/listing/[id]/score-breakdown/route.ts',
  'src/app/api/admin/stats/route.ts',
  'src/app/api/admin/analytics/market/overview/route.ts',
  'src/app/api/admin/analytics/market/distribution/route.ts',
  'src/app/api/admin/analytics/market/trends/route.ts',
  'src/app/api/admin/dealers/analytics/route.ts',
  'src/app/api/admin/analytics/engagement/top-listings/route.ts',
  'src/app/api/admin/scrapers/stats/route.ts',
  'src/app/api/admin/setsumei/preview/route.ts',
  'src/app/api/admin/setsumei/connect/route.ts',
  'src/app/api/admin/sync-elite-factor/route.ts',
  'src/app/api/debug/subscription/route.ts',

  // Dealer portal APIs (intentionally access dealer listings)
  'src/app/api/dealer/listings/route.ts',
  'src/app/api/dealer/listings/[id]/route.ts',
  'src/app/api/dealer/listings/counts/route.ts',
  'src/app/api/dealer/listings/intelligence/route.ts',
  'src/app/api/dealer/images/route.ts',

  // Cron compute jobs (don't return data to users, waste compute at worst)
  'src/app/api/cron/compute-focal-points/route.ts',
  'src/app/api/cron/compute-composite-thumbnails/route.ts',

  // Scoring module (called by admin endpoints, operates on single listing by ID)
  'src/lib/featured/scoring.ts',

  // Test files
  'tests/',
]);

/**
 * Recursively find all .ts/.tsx files under a directory
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .next, archived_pages
      if (['node_modules', '.next', 'archived_pages', '.git'].includes(entry.name)) continue;
      findTsFiles(fullPath, files);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Check if a file is in the known-safe allowlist
 */
function isKnownSafe(relativePath: string): boolean {
  for (const safe of KNOWN_SAFE_FILES) {
    if (relativePath.startsWith(safe)) return true;
  }
  return false;
}

describe('Dealer source guard regression test', () => {
  it('all user-facing .from("listings") calls should have source != dealer guard or RLS note', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const srcDir = path.join(projectRoot, 'src');
    const allFiles = findTsFiles(srcDir);

    const unguarded: string[] = [];

    for (const filePath of allFiles) {
      const relativePath = path.relative(projectRoot, filePath);

      // Skip known-safe files
      if (isKnownSafe(relativePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');

      // Check if file queries .from('listings')
      if (!content.includes(".from('listings')") && !content.includes('.from("listings")')) {
        continue;
      }

      // Check if it has the guard
      const hasGuard =
        content.includes("neq('source', 'dealer')") ||
        content.includes('neq("source", "dealer")') ||
        content.includes("source === 'dealer'") ||
        content.includes("source !== 'dealer'") ||
        content.includes("NEXT_PUBLIC_DEALER_LISTINGS_LIVE");

      if (!hasGuard) {
        unguarded.push(relativePath);
      }
    }

    if (unguarded.length > 0) {
      throw new Error(
        `Found ${unguarded.length} file(s) that query .from('listings') without a dealer source guard.\n` +
        `Either add .neq('source', 'dealer') or add the file to KNOWN_SAFE_FILES in this test:\n\n` +
        unguarded.map(f => `  - ${f}`).join('\n') +
        '\n\nSee: docs/POSTMORTEM_DEALER_LISTING_LEAK.md'
      );
    }
  });
});
