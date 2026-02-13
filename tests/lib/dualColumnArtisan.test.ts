/**
 * GOLDEN TESTS: Dual-Column Artisan Query (HIT041 Bug)
 *
 * Root cause: synthesize_object() routed some tosogu forms (mitsudogu,
 * daishō-soroi-kanagu, tosogu) to gold_smith_id instead of gold_maker_id.
 * Query functions that only checked one column based on entityType missed
 * these objects, causing undercounted stats and incomplete data.
 *
 * Fix: All gold_values queries now use .or() across both columns.
 *
 * DO NOT revert these functions to single-column .eq() queries.
 * If new functions are added that query gold_values by artisan code,
 * they MUST use the .or() dual-column pattern.
 *
 * REGRESSION: 2026-02-12 — HIT041 showed 7 Juyo instead of 11.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock ───────────────────────────────────────────────────────────

type QueryResult = { data: unknown[] | null; error: unknown; count?: number };
const queryResults = new Map<string, QueryResult[]>();
const tableCallCount = new Map<string, number>();

/** Track .or() calls to verify dual-column queries */
const orCallArgs: string[] = [];

function mockQueryBuilder(table: string, callIndex: number): Record<string, unknown> {
  const builder: Record<string, unknown> = {};

  const methods = [
    'select', 'eq', 'neq', 'in', 'not', 'gt', 'lt', 'order',
    'range', 'limit', 'single', 'maybeSingle', 'is',
  ];
  for (const method of methods) {
    builder[method] = vi.fn(() => builder);
  }

  // Track .or() calls for structural verification
  builder.or = vi.fn((arg: string) => {
    orCallArgs.push(arg);
    return builder;
  });

  // Make it thenable
  builder.then = (resolve: (val: unknown) => void) => {
    const results = queryResults.get(table) || [{ data: [], error: null }];
    const result = results[Math.min(callIndex, results.length - 1)];
    resolve(result);
  };

  return builder;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const idx = tableCallCount.get(table) || 0;
      tableCallCount.set(table, idx + 1);
      return mockQueryBuilder(table, idx);
    },
  }),
}));

// Must import AFTER mock
import {
  getArtisanDistributions,
  getArtisanHeroImage,
  getDenraiForArtisan,
} from '@/lib/supabase/yuhinkai';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function registerResults(table: string, ...results: QueryResult[]) {
  queryResults.set(table, results);
}

beforeEach(() => {
  queryResults.clear();
  tableCallCount.clear();
  orCallArgs.length = 0;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Dual-Column Artisan Queries (HIT041 regression)', () => {

  // ===========================================================================
  // TEST 1: getArtisanDistributions queries both columns
  // ===========================================================================
  describe('getArtisanDistributions', () => {
    it('queries both columns via .or() regardless of entityType', async () => {
      registerResults('gold_values', {
        data: [
          {
            gold_form_type: 'tsuba',
            gold_mei_status: 'signed',
            gold_collections: ['Juyo'],
            gold_nagasa: null,
            gold_sori: null,
            gold_motohaba: null,
            gold_sakihaba: null,
          },
        ],
        error: null,
      });

      // Call with 'tosogu' entityType
      const result = await getArtisanDistributions('HIT041', 'tosogu');

      // Verify .or() was used (not .eq())
      expect(orCallArgs.length).toBeGreaterThan(0);
      expect(orCallArgs[0]).toContain('gold_smith_id.eq.HIT041');
      expect(orCallArgs[0]).toContain('gold_maker_id.eq.HIT041');

      // Verify data is returned
      expect(result).not.toBeNull();
      expect(result!.form_distribution['tsuba']).toBe(1);
    });

    it('includes objects from both columns for the same artisan', async () => {
      // Simulate objects that might be in either column
      registerResults('gold_values', {
        data: [
          {
            gold_form_type: 'tsuba',
            gold_mei_status: 'signed',
            gold_collections: ['Juyo'],
            gold_nagasa: null,
            gold_sori: null,
            gold_motohaba: null,
            gold_sakihaba: null,
          },
          {
            gold_form_type: 'mitsudogu',
            gold_mei_status: 'unsigned',
            gold_collections: ['Juyo'],
            gold_nagasa: null,
            gold_sori: null,
            gold_motohaba: null,
            gold_sakihaba: null,
          },
          {
            gold_form_type: 'fuchi-kashira',
            gold_mei_status: 'signed',
            gold_collections: ['Tokuju'],
            gold_nagasa: null,
            gold_sori: null,
            gold_motohaba: null,
            gold_sakihaba: null,
          },
        ],
        error: null,
      });

      const result = await getArtisanDistributions('HIT041', 'tosogu');
      expect(result).not.toBeNull();
      // All 3 objects should be counted
      const totalForms = Object.values(result!.form_distribution).reduce((a, b) => a + b, 0);
      expect(totalForms).toBe(3);
    });

    it('uses .or() even when called with smith entityType', async () => {
      registerResults('gold_values', {
        data: [
          {
            gold_form_type: 'Katana',
            gold_mei_status: 'signed',
            gold_collections: ['Juyo'],
            gold_nagasa: 70.5,
            gold_sori: 1.8,
            gold_motohaba: 3.1,
            gold_sakihaba: 2.0,
          },
        ],
        error: null,
      });

      await getArtisanDistributions('MAS590', 'smith');

      expect(orCallArgs.length).toBeGreaterThan(0);
      expect(orCallArgs[0]).toContain('gold_smith_id.eq.MAS590');
      expect(orCallArgs[0]).toContain('gold_maker_id.eq.MAS590');
    });
  });

  // ===========================================================================
  // TEST 2: getArtisanHeroImage queries both columns
  // ===========================================================================
  describe('getArtisanHeroImage', () => {
    it('queries both columns via .or() regardless of entityType', async () => {
      registerResults('gold_values', {
        data: [
          {
            object_uuid: 'uuid-1',
            gold_collections: ['Juyo'],
            gold_form_type: 'tsuba',
          },
        ],
        error: null,
      });
      // catalog_records query
      registerResults('catalog_records', {
        data: [
          {
            object_uuid: 'uuid-1',
            collection: 'Juyo',
            volume: 55,
            item_number: 123,
          },
        ],
        error: null,
      });
      // linked_records query
      registerResults('linked_records', { data: [], error: null });

      // Mock fetch for image HEAD check
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      try {
        await getArtisanHeroImage('HIT041', 'tosogu');

        // Verify .or() was used on gold_values query
        const goldValuesOrCalls = orCallArgs.filter(arg => arg.includes('HIT041'));
        expect(goldValuesOrCalls.length).toBeGreaterThan(0);
        expect(goldValuesOrCalls[0]).toContain('gold_smith_id.eq.HIT041');
        expect(goldValuesOrCalls[0]).toContain('gold_maker_id.eq.HIT041');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // ===========================================================================
  // TEST 3: getDenraiForArtisan queries both columns
  // ===========================================================================
  describe('getDenraiForArtisan', () => {
    it('queries both columns via .or() regardless of entityType', async () => {
      registerResults('gold_values', {
        data: [
          {
            gold_denrai_owners: ['Tokugawa Family', 'Matsudaira Family'],
            gold_collections: ['Juyo'],
          },
        ],
        error: null,
      });
      registerResults('denrai_canonical_names', { data: [], error: null });

      const result = await getDenraiForArtisan('HIT041', 'tosogu');

      // Verify .or() was used
      const goldValuesOrCalls = orCallArgs.filter(arg => arg.includes('HIT041'));
      expect(goldValuesOrCalls.length).toBeGreaterThan(0);
      expect(goldValuesOrCalls[0]).toContain('gold_smith_id.eq.HIT041');
      expect(goldValuesOrCalls[0]).toContain('gold_maker_id.eq.HIT041');

      // Verify data is processed
      expect(result.itemCount).toBe(1);
      expect(result.owners.length).toBe(2);
    });

    it('returns empty result when no data in either column', async () => {
      registerResults('gold_values', { data: [], error: null });

      const result = await getDenraiForArtisan('NOEXIST', 'tosogu');
      expect(result.owners).toEqual([]);
      expect(result.itemCount).toBe(0);
    });

    it('uses .or() even when called with smith entityType', async () => {
      registerResults('gold_values', {
        data: [
          {
            gold_denrai_owners: ['Famous Collector'],
            gold_collections: ['Tokuju'],
          },
        ],
        error: null,
      });
      registerResults('denrai_canonical_names', { data: [], error: null });

      await getDenraiForArtisan('MAS590', 'smith');

      const goldValuesOrCalls = orCallArgs.filter(arg => arg.includes('MAS590'));
      expect(goldValuesOrCalls.length).toBeGreaterThan(0);
      expect(goldValuesOrCalls[0]).toContain('gold_smith_id.eq.MAS590');
      expect(goldValuesOrCalls[0]).toContain('gold_maker_id.eq.MAS590');
    });
  });

  // ===========================================================================
  // TEST 4: Structural — all functions use .or() pattern
  // ===========================================================================
  describe('Structural verification', () => {
    it('all three gold_values query functions use dual-column .or() pattern', async () => {
      // Set up mock data that will make each function query gold_values
      registerResults('gold_values', {
        data: [
          {
            object_uuid: 'uuid-test',
            gold_form_type: 'Katana',
            gold_mei_status: 'signed',
            gold_collections: ['Juyo'],
            gold_nagasa: 70,
            gold_sori: 1.5,
            gold_motohaba: 3.0,
            gold_sakihaba: 2.0,
            gold_denrai_owners: ['Test Owner'],
          },
        ],
        error: null,
      });
      registerResults('catalog_records', { data: [], error: null });
      registerResults('linked_records', { data: [], error: null });
      registerResults('denrai_canonical_names', { data: [], error: null });

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      try {
        // Call each function
        orCallArgs.length = 0;
        await getArtisanDistributions('TEST001', 'smith');
        const distOrCalls = [...orCallArgs];

        orCallArgs.length = 0;
        tableCallCount.clear();
        await getArtisanHeroImage('TEST001', 'smith');
        const heroOrCalls = [...orCallArgs];

        orCallArgs.length = 0;
        tableCallCount.clear();
        await getDenraiForArtisan('TEST001', 'smith');
        const denraiOrCalls = [...orCallArgs];

        // Each function must have called .or() with both columns
        for (const [name, calls] of [
          ['getArtisanDistributions', distOrCalls],
          ['getArtisanHeroImage', heroOrCalls],
          ['getDenraiForArtisan', denraiOrCalls],
        ] as const) {
          const relevantCalls = calls.filter(c => c.includes('TEST001'));
          expect(
            relevantCalls.length,
            `${name} must use .or() with artisan code`
          ).toBeGreaterThan(0);
          expect(
            relevantCalls[0],
            `${name} must query gold_smith_id`
          ).toContain('gold_smith_id.eq.TEST001');
          expect(
            relevantCalls[0],
            `${name} must query gold_maker_id`
          ).toContain('gold_maker_id.eq.TEST001');
        }
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
