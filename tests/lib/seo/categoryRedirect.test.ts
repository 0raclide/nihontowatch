import { describe, it, expect } from 'vitest';
import { findCategoryRedirect } from '@/lib/seo/categories';

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe('findCategoryRedirect', () => {
  // ── Single-filter type redirects ──────────────────────────────────────────

  it('redirects /?type=katana → /swords/katana', () => {
    expect(findCategoryRedirect(params('type=katana'))).toBe('/swords/katana');
  });

  it('redirects /?type=tsuba → /fittings/tsuba', () => {
    expect(findCategoryRedirect(params('type=tsuba'))).toBe('/fittings/tsuba');
  });

  it('is case-insensitive for type values', () => {
    expect(findCategoryRedirect(params('type=Katana'))).toBe('/swords/katana');
    expect(findCategoryRedirect(params('type=KATANA'))).toBe('/swords/katana');
  });

  // ── Single-filter cert redirects ──────────────────────────────────────────

  it('redirects /?cert=juyo → /certified/juyo', () => {
    expect(findCategoryRedirect(params('cert=juyo'))).toBe('/certified/juyo');
  });

  it('redirects /?cert=tokubetsu_hozon → /certified/tokubetsu-hozon', () => {
    expect(findCategoryRedirect(params('cert=tokubetsu_hozon'))).toBe('/certified/tokubetsu-hozon');
  });

  // ── Combination redirects ────────────────────────────────────────────────

  it('redirects /?type=katana&cert=juyo → /swords/juyo-katana', () => {
    expect(findCategoryRedirect(params('type=katana&cert=juyo'))).toBe('/swords/juyo-katana');
  });

  it('redirects /?cert=juyo&type=katana (reversed order) → /swords/juyo-katana', () => {
    expect(findCategoryRedirect(params('cert=juyo&type=katana'))).toBe('/swords/juyo-katana');
  });

  it('redirects /?type=katana&school=bizen → /swords/bizen-katana', () => {
    expect(findCategoryRedirect(params('type=katana&school=bizen'))).toBe('/swords/bizen-katana');
  });

  it('redirects /?type=katana&era=koto → /swords/koto-katana', () => {
    expect(findCategoryRedirect(params('type=katana&era=koto'))).toBe('/swords/koto-katana');
  });

  // ── Period → era alias ───────────────────────────────────────────────────

  it('normalizes period to era: /?type=katana&period=koto → /swords/koto-katana', () => {
    expect(findCategoryRedirect(params('type=katana&period=koto'))).toBe('/swords/koto-katana');
  });

  // ── No redirect cases ───────────────────────────────────────────────────

  it('returns null when tab is present (browse UI)', () => {
    expect(findCategoryRedirect(params('tab=available&type=katana'))).toBeNull();
  });

  it('returns null when tab=sold (sold filter)', () => {
    expect(findCategoryRedirect(params('tab=sold&type=katana'))).toBeNull();
  });

  it('returns null when non-category params present (sort)', () => {
    expect(findCategoryRedirect(params('type=katana&sort=price_asc'))).toBeNull();
  });

  it('returns null when non-category params present (dealer)', () => {
    expect(findCategoryRedirect(params('type=katana&dealer=5'))).toBeNull();
  });

  it('returns null when non-category params present (q)', () => {
    expect(findCategoryRedirect(params('type=katana&q=masamune'))).toBeNull();
  });

  it('returns null when no params present', () => {
    expect(findCategoryRedirect(params(''))).toBeNull();
  });

  it('returns null for CSV multi-values', () => {
    expect(findCategoryRedirect(params('type=katana,wakizashi'))).toBeNull();
  });

  it('returns null for unknown type values', () => {
    expect(findCategoryRedirect(params('type=lightsaber'))).toBeNull();
  });

  it('returns null when cat param is present', () => {
    expect(findCategoryRedirect(params('cat=nihonto&type=katana'))).toBeNull();
  });

  it('returns null for school-only (no standalone school page)', () => {
    expect(findCategoryRedirect(params('school=bizen'))).toBeNull();
  });

  it('returns null for era-only (no standalone era page)', () => {
    expect(findCategoryRedirect(params('era=koto'))).toBeNull();
  });
});
