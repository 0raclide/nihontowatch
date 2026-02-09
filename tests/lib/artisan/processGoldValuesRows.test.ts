import { describe, it, expect, vi } from 'vitest';

// Mock Supabase to avoid module-level createClient requiring env vars
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

import { processGoldValuesRows, GoldValuesRow } from '@/lib/supabase/yuhinkai';

// Helper to build a gold_values row with defaults
function row(overrides: Partial<GoldValuesRow> = {}): GoldValuesRow {
  return {
    gold_form_type: null,
    gold_mei_status: null,
    gold_collections: null,
    gold_nagasa: null,
    gold_sori: null,
    gold_motohaba: null,
    gold_sakihaba: null,
    ...overrides,
  };
}

describe('processGoldValuesRows — JE_Koto exclusion', () => {
  it('keeps records with JE_Koto + another collection (cross-referenced items)', () => {
    // A Tokuju sword that also appears in JE_Koto should NOT be excluded
    const rows: GoldValuesRow[] = [
      row({ gold_form_type: 'Katana', gold_mei_status: 'signed', gold_collections: ['JE_Koto', 'Tokuju'] }),
      row({ gold_form_type: 'Tachi', gold_mei_status: 'mumei', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'signed', gold_collections: ['Juyo', 'JE_Koto'] }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();
    expect(result!.form_distribution).toEqual({ katana: 2, tachi: 1 });
    expect(result!.mei_distribution).toEqual({ signed: 2, mumei: 1 });
  });

  it('excludes orphaned JE_Koto-only records', () => {
    // A record only in JE_Koto (no other collection) is unreliable — exclude it
    const rows: GoldValuesRow[] = [
      row({ gold_form_type: 'Katana', gold_mei_status: 'signed', gold_collections: ['JE_Koto'] }),
      row({ gold_form_type: 'Tachi', gold_mei_status: 'mumei', gold_collections: ['Juyo'] }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();
    expect(result!.form_distribution).toEqual({ tachi: 1 });
    expect(result!.mei_distribution).toEqual({ mumei: 1 });
  });

  it('keeps records with no collections (null)', () => {
    const rows: GoldValuesRow[] = [
      row({ gold_form_type: 'Katana', gold_collections: null }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();
    expect(result!.form_distribution).toEqual({ katana: 1 });
  });

  it('keeps records with empty collections array', () => {
    const rows: GoldValuesRow[] = [
      row({ gold_form_type: 'Tanto', gold_collections: [] }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();
    expect(result!.form_distribution).toEqual({ tanto: 1 });
  });

  it('handles a realistic Mitsutada-like dataset where most items are cross-referenced', () => {
    // Simulates MIT281: 10 items, 8 in both Juyo+JE_Koto, 1 Tokuju+JE_Koto, 1 JE_Koto-only
    const rows: GoldValuesRow[] = [
      row({ gold_form_type: 'Tachi', gold_mei_status: 'signed', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Tachi', gold_mei_status: 'signed', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Tachi', gold_mei_status: 'mumei', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'signed', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'signed', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'mumei', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'signed', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Wakizashi', gold_mei_status: 'signed', gold_collections: ['JE_Koto', 'Juyo'] }),
      row({ gold_form_type: 'Tanto', gold_mei_status: 'kinzogan-mei', gold_collections: ['JE_Koto', 'Tokuju'] }),
      // This orphaned JE_Koto-only record should be excluded
      row({ gold_form_type: 'Katana', gold_mei_status: 'signed', gold_collections: ['JE_Koto'] }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();

    // 9 items counted (10 - 1 orphaned JE_Koto)
    const formTotal = Object.values(result!.form_distribution).reduce((s, v) => s + v, 0);
    expect(formTotal).toBe(9);

    expect(result!.form_distribution).toEqual({
      tachi: 3,
      katana: 4,
      wakizashi: 1,
      tanto: 1,
    });

    const meiTotal = Object.values(result!.mei_distribution).reduce((s, v) => s + v, 0);
    expect(meiTotal).toBe(9);
  });
});

describe('processGoldValuesRows — measurements', () => {
  it('collects measurements for smith entities', () => {
    const rows: GoldValuesRow[] = [
      row({
        gold_form_type: 'Katana',
        gold_collections: ['Juyo'],
        gold_nagasa: 68.4,
        gold_sori: 2.0,
        gold_motohaba: 2.9,
        gold_sakihaba: 1.9,
      }),
      row({
        gold_form_type: 'Katana',
        gold_collections: ['Juyo'],
        gold_nagasa: 70.1,
        gold_sori: 1.8,
        gold_motohaba: null,
        gold_sakihaba: null,
      }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();
    expect(result!.measurements_by_form.katana.nagasa).toEqual([68.4, 70.1]);
    expect(result!.measurements_by_form.katana.sori).toEqual([2.0, 1.8]);
    expect(result!.measurements_by_form.katana.motohaba).toEqual([2.9]);
    expect(result!.measurements_by_form.katana.sakihaba).toEqual([1.9]);
  });

  it('excludes zero and null measurements', () => {
    const rows: GoldValuesRow[] = [
      row({
        gold_form_type: 'Tachi',
        gold_collections: ['Tokuju'],
        gold_nagasa: 0,
        gold_sori: null,
        gold_motohaba: 3.1,
        gold_sakihaba: -1,
      }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();
    expect(result!.measurements_by_form.tachi.nagasa).toEqual([]);
    expect(result!.measurements_by_form.tachi.sori).toEqual([]);
    expect(result!.measurements_by_form.tachi.motohaba).toEqual([3.1]);
    expect(result!.measurements_by_form.tachi.sakihaba).toEqual([]);
  });

  it('does not collect measurements for tosogu entities', () => {
    const rows: GoldValuesRow[] = [
      row({
        gold_form_type: 'Tsuba',
        gold_collections: ['Juyo'],
        gold_nagasa: 8.0,
      }),
    ];

    const result = processGoldValuesRows(rows, 'tosogu');
    expect(result).not.toBeNull();
    expect(result!.form_distribution).toEqual({ tsuba: 1 });
    expect(result!.measurements_by_form).toEqual({});
  });
});

describe('processGoldValuesRows — mei normalization', () => {
  it('normalizes common mei status variants', () => {
    const rows: GoldValuesRow[] = [
      row({ gold_form_type: 'Katana', gold_mei_status: 'unsigned', gold_collections: ['Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'mumei', gold_collections: ['Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'mei', gold_collections: ['Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'Signed', gold_collections: ['Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'kinzogan-mei', gold_collections: ['Juyo'] }),
      row({ gold_form_type: 'Katana', gold_mei_status: 'kinzogan_mei', gold_collections: ['Juyo'] }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();
    expect(result!.mei_distribution).toEqual({
      mumei: 2,
      signed: 2,
      kinzogan_mei: 2,
    });
  });
});

describe('processGoldValuesRows — edge cases', () => {
  it('returns null for empty input', () => {
    expect(processGoldValuesRows([], 'smith')).toBeNull();
  });

  it('returns null when all rows are orphaned JE_Koto', () => {
    const rows: GoldValuesRow[] = [
      row({ gold_form_type: 'Katana', gold_collections: ['JE_Koto'] }),
      row({ gold_form_type: 'Tachi', gold_collections: ['JE_Koto'] }),
    ];

    expect(processGoldValuesRows(rows, 'smith')).toBeNull();
  });

  it('returns null when rows have no form or mei data', () => {
    const rows: GoldValuesRow[] = [
      row({ gold_collections: ['Juyo'] }),
    ];

    expect(processGoldValuesRows(rows, 'smith')).toBeNull();
  });

  it('classifies unknown form types as other', () => {
    const rows: GoldValuesRow[] = [
      row({ gold_form_type: 'nagamaki', gold_collections: ['Juyo'] }),
    ];

    const result = processGoldValuesRows(rows, 'smith');
    expect(result).not.toBeNull();
    expect(result!.form_distribution).toEqual({ other: 1 });
  });
});
