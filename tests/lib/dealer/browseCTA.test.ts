import { describe, it, expect } from 'vitest';

// =============================================================================
// Browse CTA — nw:// URL Detection Tests
//
// When DEALER_LISTINGS_LIVE=true, dealer listings appear in browse.
// Their URLs use the nw:// protocol (e.g. nw://dealer/42/abc-uuid),
// which is not navigable in a browser. The "View on Dealer" button
// must be hidden for these listings.
// =============================================================================

describe('nw:// URL detection', () => {
  const isDealerOwned = (url: string | null | undefined) => url?.startsWith('nw://') ?? false;

  it('GOLDEN: detects nw:// dealer-owned URLs', () => {
    expect(isDealerOwned('nw://dealer/42/abc-def-123')).toBe(true);
  });

  it('GOLDEN: does not flag normal dealer URLs', () => {
    expect(isDealerOwned('https://aoi-art.com/listing/123')).toBe(false);
    expect(isDealerOwned('https://nihonto.com/items/456')).toBe(false);
  });

  it('handles null/undefined URLs safely', () => {
    expect(isDealerOwned(null)).toBe(false);
    expect(isDealerOwned(undefined)).toBe(false);
  });

  it('handles empty string', () => {
    expect(isDealerOwned('')).toBe(false);
  });

  it('is case-sensitive (nw:// only, not NW://)', () => {
    expect(isDealerOwned('NW://dealer/42/abc')).toBe(false);
    expect(isDealerOwned('Nw://dealer/42/abc')).toBe(false);
  });
});
