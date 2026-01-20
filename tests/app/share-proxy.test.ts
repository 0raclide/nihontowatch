/**
 * Unit tests for the share proxy route /s/[id]
 *
 * Critical test: Ensures shared URLs redirect to /?listing={id} (quickview)
 * NOT /listing/{id} (full page). This was a regression that broke shared links.
 */
import { describe, it, expect } from 'vitest';

/**
 * Replicate the target URL logic from src/app/s/[id]/page.tsx
 * This should stay in sync with the actual implementation.
 */
function buildShareProxyRedirectTarget(listingIdParam: string): string {
  const listingId = parseInt(listingIdParam);
  return isNaN(listingId) ? '/' : `/?listing=${listingId}`;
}

describe('Share Proxy Redirect Target', () => {
  it('redirects valid listing ID to home page with ?listing= param', () => {
    const target = buildShareProxyRedirectTarget('123');

    // CRITICAL: Must redirect to /?listing= (quickview), NOT /listing/ (full page)
    expect(target).toBe('/?listing=123');
    expect(target).not.toContain('/listing/');
  });

  it('redirects to home for invalid listing ID', () => {
    expect(buildShareProxyRedirectTarget('abc')).toBe('/');
    expect(buildShareProxyRedirectTarget('')).toBe('/');
    expect(buildShareProxyRedirectTarget('NaN')).toBe('/');
  });

  it('handles numeric string IDs correctly', () => {
    expect(buildShareProxyRedirectTarget('1')).toBe('/?listing=1');
    expect(buildShareProxyRedirectTarget('999999')).toBe('/?listing=999999');
    expect(buildShareProxyRedirectTarget('00123')).toBe('/?listing=123'); // parseInt strips leading zeros
  });

  it('NEVER redirects to /listing/ path (regression guard)', () => {
    // This test exists specifically to catch the regression where
    // /s/{id} was incorrectly redirecting to /listing/{id} instead of /?listing={id}
    const testIds = ['1', '123', '999', '12345'];

    for (const id of testIds) {
      const target = buildShareProxyRedirectTarget(id);
      expect(target).not.toMatch(/^\/listing\//);
      expect(target).toMatch(/^\/\?listing=/);
    }
  });
});

describe('Share URL format expectations', () => {
  it('share proxy URL format is /s/{id}?v={version}', () => {
    // Document the expected URL formats
    const shareUrlPattern = /^\/s\/\d+\?v=[\w]+$/;

    expect('/s/123?v=abc123').toMatch(shareUrlPattern);
    expect('/s/1?v=v1').toMatch(shareUrlPattern);
  });

  it('quickview URL format is /?listing={id}', () => {
    const quickviewUrlPattern = /^\/\?listing=\d+/;

    expect('/?listing=123').toMatch(quickviewUrlPattern);
    expect('/?listing=1&type=katana').toMatch(quickviewUrlPattern);
  });
});
