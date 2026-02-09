import { describe, it, expect } from 'vitest';

/**
 * Tests for enriched Students & School (Related Artisans) sections on artist profiles.
 *
 * Validates:
 * - Rich artisan API returns enriched student data (certification counts, elite_factor)
 * - Students are sorted by elite_factor descending
 * - available_count is optional on the API route (SSR page adds it separately)
 * - Legacy API is unaffected
 *
 * Note: available_count is attached server-side in the SSR page.tsx (not the API route),
 * so the API route may or may not include it. The component tests verify rendering.
 */

const API_BASE = process.env.TEST_API_URL || 'https://nihontowatch.com';

// MIT281 (Mitsutada) is the canonical test artisan — has known students and school peers
const TEST_CODE = 'MIT281';

describe('Artist Profile Enrichment — Students & Related', () => {
  describe('Rich API (?rich=1) student data', () => {
    it('should return students with certification counts and elite_factor', async () => {
      const res = await fetch(`${API_BASE}/api/artisan/${TEST_CODE}?rich=1`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.lineage).toBeDefined();

      const { students } = data.lineage;
      if (students.length === 0) {
        console.warn(`${TEST_CODE} has no students — skipping enrichment checks`);
        return;
      }

      // Every student should have the enriched fields
      for (const student of students) {
        expect(student.code, 'student should have code').toBeTruthy();
        expect(student.slug, 'student should have slug').toBeTruthy();

        // Certification fields must be present (numbers, possibly 0)
        expect(typeof student.kokuho_count).toBe('number');
        expect(typeof student.jubun_count).toBe('number');
        expect(typeof student.jubi_count).toBe('number');
        expect(typeof student.gyobutsu_count).toBe('number');
        expect(typeof student.tokuju_count).toBe('number');
        expect(typeof student.juyo_count).toBe('number');
        expect(typeof student.elite_factor).toBe('number');

        // name_kanji should be present (can be null)
        expect('name_kanji' in student).toBe(true);
        // school should be present (can be null)
        expect('school' in student).toBe(true);
      }
    });

    it('should sort students by elite_factor descending', async () => {
      const res = await fetch(`${API_BASE}/api/artisan/${TEST_CODE}?rich=1`);
      const data = await res.json();
      const { students } = data.lineage;

      if (students.length < 2) {
        console.warn(`${TEST_CODE} has fewer than 2 students — cannot verify sort order`);
        return;
      }

      for (let i = 1; i < students.length; i++) {
        expect(
          students[i - 1].elite_factor,
          `Student ${students[i - 1].code} (elite_factor=${students[i - 1].elite_factor}) should rank >= ${students[i].code} (elite_factor=${students[i].elite_factor})`
        ).toBeGreaterThanOrEqual(students[i].elite_factor);
      }
    });

    it('should include non-negative certification counts on students', async () => {
      const res = await fetch(`${API_BASE}/api/artisan/${TEST_CODE}?rich=1`);
      const data = await res.json();
      const { students } = data.lineage;

      if (students.length === 0) return;

      for (const student of students) {
        expect(student.kokuho_count).toBeGreaterThanOrEqual(0);
        expect(student.jubun_count).toBeGreaterThanOrEqual(0);
        expect(student.jubi_count).toBeGreaterThanOrEqual(0);
        expect(student.gyobutsu_count).toBeGreaterThanOrEqual(0);
        expect(student.tokuju_count).toBeGreaterThanOrEqual(0);
        expect(student.juyo_count).toBeGreaterThanOrEqual(0);
        expect(student.elite_factor).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Rich API (?rich=1) related artisans data', () => {
    it('should include certification counts and elite_factor on related artisans', async () => {
      const res = await fetch(`${API_BASE}/api/artisan/${TEST_CODE}?rich=1`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      const related = data.related || [];

      if (related.length === 0) {
        console.warn(`${TEST_CODE} has no related artisans — skipping`);
        return;
      }

      for (const artisan of related) {
        expect(typeof artisan.kokuho_count).toBe('number');
        expect(typeof artisan.jubun_count).toBe('number');
        expect(typeof artisan.jubi_count).toBe('number');
        expect(typeof artisan.gyobutsu_count).toBe('number');
        expect(typeof artisan.tokuju_count).toBe('number');
        expect(typeof artisan.juyo_count).toBe('number');
        expect(typeof artisan.elite_factor).toBe('number');
        expect(artisan.slug).toBeTruthy();
      }
    });

    it('related artisans should be sorted by elite_factor descending', async () => {
      const res = await fetch(`${API_BASE}/api/artisan/${TEST_CODE}?rich=1`);
      const data = await res.json();
      const related = data.related || [];

      if (related.length < 2) return;

      for (let i = 1; i < related.length; i++) {
        expect(
          related[i - 1].elite_factor,
          `Related ${related[i - 1].code} should rank >= ${related[i].code}`
        ).toBeGreaterThanOrEqual(related[i].elite_factor);
      }
    });
  });

  describe('Legacy API (no ?rich=1) is unaffected', () => {
    it('should still return the legacy ArtisanDetails shape', async () => {
      const res = await fetch(`${API_BASE}/api/artisan/${TEST_CODE}`);
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.artisan).toBeDefined();
      expect(data.artisan.code).toBe(TEST_CODE);

      // Legacy response should NOT have lineage or related
      expect(data.lineage).toBeUndefined();
      expect(data.related).toBeUndefined();

      // Should have standard certification fields
      expect(typeof data.artisan.kokuho_count).toBe('number');
      expect(typeof data.artisan.total_items).toBe('number');
    });
  });

  describe('Cross-artisan enrichment test', () => {
    // Test with a few different artisan types
    const testCodes = [
      { code: 'MAS590', name: 'Masamune' },
      { code: 'SAD154', name: 'Sadamune' },
    ];

    for (const { code, name } of testCodes) {
      it(`${code} (${name}): students and related should have enriched fields`, async () => {
        const res = await fetch(`${API_BASE}/api/artisan/${code}?rich=1`);
        if (!res.ok) {
          console.warn(`${code} not available — skipping`);
          return;
        }

        const data = await res.json();

        // Lineage should exist
        expect(data.lineage).toBeDefined();
        expect(Array.isArray(data.lineage.students)).toBe(true);

        // Students (if any) should have enriched fields
        for (const student of data.lineage.students) {
          expect(typeof student.elite_factor).toBe('number');
          expect(student.slug).toBeTruthy();
          expect(typeof student.kokuho_count).toBe('number');
          expect(typeof student.juyo_count).toBe('number');
        }

        // Related (if any) should have certification data
        for (const rel of data.related || []) {
          expect(typeof rel.elite_factor).toBe('number');
          expect(rel.slug).toBeTruthy();
        }
      });
    }
  });
});
