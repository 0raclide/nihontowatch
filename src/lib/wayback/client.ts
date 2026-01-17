/**
 * Wayback Machine CDX API Client
 *
 * Uses the CDX Server API to find the oldest archive of a URL:
 * https://web.archive.org/cdx/search/cdx?url=<URL>&limit=1&output=json&fl=timestamp
 *
 * Rate limited to 1 request per minute (conservative to respect archive.org)
 */

import type { WaybackCheckResult } from './types';

const CDX_API_BASE = 'https://web.archive.org/cdx/search/cdx';
const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout

/**
 * Parse Wayback CDX timestamp format (YYYYMMDDhhmmss) to Date
 */
function parseWaybackTimestamp(timestamp: string): Date {
  // Format: 20210601120000 -> 2021-06-01T12:00:00
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  const hour = timestamp.slice(8, 10);
  const minute = timestamp.slice(10, 12);
  const second = timestamp.slice(12, 14);

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

/**
 * Check Wayback Machine for the oldest archive of a URL
 *
 * @param url - The URL to check
 * @returns WaybackCheckResult with archive date or null if not found
 */
export async function checkWaybackArchive(
  url: string
): Promise<WaybackCheckResult> {
  const checkedAt = new Date();

  try {
    // Build CDX API query
    // limit=1 gets first result (oldest when sorted ascending by default)
    // output=json for easier parsing
    // fl=timestamp to only get the timestamp field
    const params = new URLSearchParams({
      url: url,
      limit: '1',
      output: 'json',
      fl: 'timestamp',
    });

    const apiUrl = `${CDX_API_BASE}?${params.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Nihontowatch/1.0 (https://nihontowatch.com; archival research)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        url,
        found: false,
        firstArchiveAt: null,
        checkedAt,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const text = await response.text();

    // Empty response means not in archive
    if (!text.trim()) {
      return {
        url,
        found: false,
        firstArchiveAt: null,
        checkedAt,
      };
    }

    // Parse JSON response
    // Format: [["timestamp"],["20210601120000"]]
    const data = JSON.parse(text);

    // First row is header, second row is data
    if (!Array.isArray(data) || data.length < 2) {
      return {
        url,
        found: false,
        firstArchiveAt: null,
        checkedAt,
      };
    }

    const timestamp = data[1]?.[0]; // Second row, first column
    if (!timestamp) {
      return {
        url,
        found: false,
        firstArchiveAt: null,
        checkedAt,
      };
    }

    return {
      url,
      found: true,
      firstArchiveAt: parseWaybackTimestamp(timestamp),
      checkedAt,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Handle abort specifically
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        url,
        found: false,
        firstArchiveAt: null,
        checkedAt,
        error: 'Request timeout',
      };
    }

    return {
      url,
      found: false,
      firstArchiveAt: null,
      checkedAt,
      error: errorMessage,
    };
  }
}

/**
 * Rate limiter class for Wayback requests
 * Enforces minimum interval between requests
 */
export class WaybackRateLimiter {
  private lastRequestTime: number = 0;
  private readonly minIntervalMs: number;

  constructor(requestsPerMinute: number = 1) {
    // 1 request per minute = 60000ms interval
    this.minIntervalMs = (60 / requestsPerMinute) * 1000;
  }

  /**
   * Wait until rate limit allows next request
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Check URL with rate limiting
   */
  async checkWithRateLimit(url: string): Promise<WaybackCheckResult> {
    await this.waitForSlot();
    return checkWaybackArchive(url);
  }
}

// Default rate limiter instance (1 request per minute)
export const defaultRateLimiter = new WaybackRateLimiter(1);
