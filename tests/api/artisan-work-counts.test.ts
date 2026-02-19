import { describe, it, expect } from 'vitest';

/**
 * Regression tests for artisan work count deduplication.
 *
 * Background: Each physical object can appear in multiple collections
 * (e.g., all Tokuju swords also have Juyo records, most Kokuho also have
 * JuBun records). The stats must assign each object to its SINGLE highest
 * designation via a "best-collection priority" algorithm:
 *   Kokuho > Tokuju > JuBun > Jubi > Gyobutsu > Juyo
 *
 * A regression in Feb 2026 caused per-collection counting, inflating
 * totals (MIT281 showed 74 instead of correct 62). These tests ensure
 * the counts remain mutually exclusive.
 *
 * See: oshi-v2/supabase/migrations/274_fix_recompute_artisan_stats_dedup.sql
 */

const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

interface ArtisanCertifications {
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
  total_items: number;
  elite_count: number;
  elite_factor: number;
}

/**
 * Validates the sum invariant for artisan certifications.
 * total_items must equal the sum of all individual designation counts.
 * This catches double-counting from overlapping designations.
 */
function assertSumInvariant(certs: ArtisanCertifications, label: string) {
  const sum =
    certs.kokuho_count +
    certs.jubun_count +
    certs.jubi_count +
    certs.gyobutsu_count +
    certs.tokuju_count +
    certs.juyo_count;

  expect(certs.total_items, `${label}: total_items should equal sum of all designations`).toBe(sum);
}

/**
 * Validates the elite count invariant.
 * elite_count = everything except juyo_count.
 */
function assertEliteInvariant(certs: ArtisanCertifications, label: string) {
  const expectedElite =
    certs.kokuho_count +
    certs.jubun_count +
    certs.jubi_count +
    certs.gyobutsu_count +
    certs.tokuju_count;

  expect(certs.elite_count, `${label}: elite_count should equal sum of elite designations`).toBe(expectedElite);
}

/**
 * Validates the elite_factor Bayesian formula.
 * When total > 0: elite_factor = round((elite + 1) / (total + 10), 4)
 * When total = 0: elite_factor = 0
 */
function assertEliteFactorFormula(certs: ArtisanCertifications, label: string) {
  if (certs.total_items === 0) {
    expect(certs.elite_factor, `${label}: elite_factor should be 0 when no items`).toBe(0);
  } else {
    const expected = Math.round(((certs.elite_count + 1) / (certs.total_items + 10)) * 10000) / 10000;
    expect(certs.elite_factor, `${label}: elite_factor should match Bayesian formula`).toBeCloseTo(expected, 3);
  }
}

async function fetchArtisanLegacy(code: string): Promise<ArtisanCertifications | null> {
  const res = await fetch(`${API_BASE}/api/artisan/${encodeURIComponent(code)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.artisan) return null;
  return {
    kokuho_count: data.artisan.kokuho_count,
    jubun_count: data.artisan.jubun_count,
    jubi_count: data.artisan.jubi_count,
    gyobutsu_count: data.artisan.gyobutsu_count,
    tokuju_count: data.artisan.tokuju_count,
    juyo_count: data.artisan.juyo_count,
    total_items: data.artisan.total_items,
    elite_count: data.artisan.elite_count,
    elite_factor: data.artisan.elite_factor ?? 0,
  };
}

async function fetchArtisanRich(code: string): Promise<ArtisanCertifications | null> {
  const res = await fetch(`${API_BASE}/api/artisan/${encodeURIComponent(code)}?rich=1`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.certifications) return null;
  return data.certifications;
}

describe('Artisan Work Count Deduplication', () => {
  /**
   * MIT281 (Mitsutada) is the canonical test case.
   * - Has 10 objects with both Tokuju AND Juyo catalog_records
   * - Has 2 objects with both Kokuho AND JuBun catalog_records
   * - Correct total: 62 (not 74 which was the old double-counted value)
   *
   * Ground truth (verified Feb 2026 via direct SQL, updated Feb 19 2026):
   *   kokuho: 3, jubun: 15, jubi: 13, gyobutsu: 2, tokuju: 10, juyo: 18
   *   total: 61, elite: 43
   */
  describe('MIT281 (Mitsutada) — known overlapping designations', () => {
    it('should have correct total_items after deduplication (legacy API)', async () => {
      const certs = await fetchArtisanLegacy('MIT281');
      if (!certs) {
        console.warn('MIT281 not available — skipping');
        return;
      }

      // The old bug gave total_items = 74. Correct is 61.
      expect(certs.total_items, 'MIT281 total should be 61 (was 74 when double-counted)').toBe(61);
    });

    it('should satisfy sum invariant (legacy API)', async () => {
      const certs = await fetchArtisanLegacy('MIT281');
      if (!certs) return;
      assertSumInvariant(certs, 'MIT281 legacy');
    });

    it('should satisfy elite count invariant (legacy API)', async () => {
      const certs = await fetchArtisanLegacy('MIT281');
      if (!certs) return;
      assertEliteInvariant(certs, 'MIT281 legacy');
    });

    it('should satisfy elite_factor formula (legacy API)', async () => {
      const certs = await fetchArtisanLegacy('MIT281');
      if (!certs) return;
      assertEliteFactorFormula(certs, 'MIT281 legacy');
    });

    it('should have correct individual designation counts', async () => {
      const certs = await fetchArtisanLegacy('MIT281');
      if (!certs) return;

      // Snapshot from verified SQL query after fix applied
      expect(certs.kokuho_count, 'MIT281 kokuho').toBe(3);
      expect(certs.jubun_count, 'MIT281 jubun').toBe(15);
      expect(certs.jubi_count, 'MIT281 jubi').toBe(13);
      expect(certs.gyobutsu_count, 'MIT281 gyobutsu').toBe(2);
      expect(certs.tokuju_count, 'MIT281 tokuju').toBe(10);
      expect(certs.juyo_count, 'MIT281 juyo').toBe(18);
    });

    it('should return same counts via rich API as legacy API', async () => {
      const [legacy, rich] = await Promise.all([
        fetchArtisanLegacy('MIT281'),
        fetchArtisanRich('MIT281'),
      ]);
      if (!legacy || !rich) return;

      expect(rich.total_items).toBe(legacy.total_items);
      expect(rich.kokuho_count).toBe(legacy.kokuho_count);
      expect(rich.jubun_count).toBe(legacy.jubun_count);
      expect(rich.jubi_count).toBe(legacy.jubi_count);
      expect(rich.gyobutsu_count).toBe(legacy.gyobutsu_count);
      expect(rich.tokuju_count).toBe(legacy.tokuju_count);
      expect(rich.juyo_count).toBe(legacy.juyo_count);
      expect(rich.elite_count).toBe(legacy.elite_count);
    });
  });

  /**
   * Sample artisans with known overlapping designations.
   * The sum invariant must hold for all of them.
   */
  describe('Sum invariant across multiple artisans', () => {
    // Artisans known to have overlapping Tokuju/Juyo and Kokuho/JuBun records
    const testCodes = [
      { code: 'MIT281', name: 'Mitsutada' },
      { code: 'MAS590', name: 'Masamune' },
      { code: 'SAD154', name: 'Sadamune' },
      { code: 'YOS011', name: 'Yoshimitsu (Awataguchi)' },
      { code: 'KUN122', name: 'Kuniyoshi' },
    ];

    for (const { code, name } of testCodes) {
      it(`${code} (${name}): total_items = sum of all designation counts`, async () => {
        const certs = await fetchArtisanLegacy(code);
        if (!certs) {
          console.warn(`${code} not available — skipping`);
          return;
        }

        assertSumInvariant(certs, `${code} (${name})`);
        assertEliteInvariant(certs, `${code} (${name})`);
        assertEliteFactorFormula(certs, `${code} (${name})`);
      });
    }
  });

  /**
   * Fetch a batch of artisans from the directory API and verify
   * the sum invariant holds for all returned entries.
   */
  describe('Directory-wide sum invariant', () => {
    it('should satisfy sum invariant for top-50 artisans by elite_factor', async () => {
      const res = await fetch(`${API_BASE}/api/artists/directory?sort=elite_factor&limit=50`);
      if (!res.ok) {
        console.warn('Directory API unavailable — skipping');
        return;
      }
      const data = await res.json();
      const artists = data.artists || [];

      let checked = 0;
      for (const artist of artists) {
        const kokuho = artist.kokuho_count ?? 0;
        const jubun = artist.jubun_count ?? 0;
        const jubi = artist.jubi_count ?? 0;
        const gyobutsu = artist.gyobutsu_count ?? 0;
        const tokuju = artist.tokuju_count ?? 0;
        const juyo = artist.juyo_count ?? 0;
        const total = artist.total_items ?? 0;

        const sum = kokuho + jubun + jubi + gyobutsu + tokuju + juyo;
        const code = artist.code;

        expect(total, `${code}: total_items (${total}) should equal sum of designations (${sum})`).toBe(sum);
        checked++;
      }

      expect(checked, 'Should have checked at least some artisans').toBeGreaterThan(0);
    });
  });

  /**
   * Verify that no artisan has negative counts
   * (could happen if the dedup logic has an off-by-one error).
   */
  describe('Non-negative count invariant', () => {
    it('MIT281 should have all non-negative counts', async () => {
      const certs = await fetchArtisanLegacy('MIT281');
      if (!certs) return;

      expect(certs.kokuho_count).toBeGreaterThanOrEqual(0);
      expect(certs.jubun_count).toBeGreaterThanOrEqual(0);
      expect(certs.jubi_count).toBeGreaterThanOrEqual(0);
      expect(certs.gyobutsu_count).toBeGreaterThanOrEqual(0);
      expect(certs.tokuju_count).toBeGreaterThanOrEqual(0);
      expect(certs.juyo_count).toBeGreaterThanOrEqual(0);
      expect(certs.total_items).toBeGreaterThanOrEqual(0);
      expect(certs.elite_count).toBeGreaterThanOrEqual(0);
      expect(certs.elite_factor).toBeGreaterThanOrEqual(0);
    });
  });
});
