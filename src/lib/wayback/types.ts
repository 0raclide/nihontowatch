/**
 * Wayback Machine API types
 */

export interface WaybackCdxResponse {
  // CDX response is an array of arrays
  // First row is header, subsequent rows are data
  // Format when fl=timestamp: [["timestamp"], ["20210601120000"]]
  timestamp?: string;
  found: boolean;
}

export interface WaybackCheckResult {
  url: string;
  found: boolean;
  firstArchiveAt: Date | null;
  checkedAt: Date;
  error?: string;
}
