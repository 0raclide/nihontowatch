import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock Supabase before importing modules
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

import { getPrestigeScore, PROVENANCE_TIERS, computeProvenanceAnalysis } from '@/lib/artisan/provenanceMock';

/**
 * Cross-repo consistency tests: verify that the SQL migration (oshi-v2)
 * and the frontend mock (nihontowatch) agree on prestige scores.
 *
 * These tests parse the actual SQL migration file and validate every
 * UPDATE statement against the frontend getPrestigeScore() function.
 *
 * If these tests break, the backend and frontend are out of sync.
 */

const MIGRATION_PATH = join(
  process.cwd(),
  '..', 'oshi-v2', 'supabase', 'migrations', '287_denrai_prestige_scores.sql'
);

/** Parse "UPDATE ... SET prestige_score = X WHERE canonical_name IN (...)" from SQL */
function parseMigrationScores(sql: string): Map<string, number> {
  const scores = new Map<string, number>();

  // Match: SET prestige_score = <number> WHERE canonical_name IN (...)
  const updatePattern = /SET prestige_score\s*=\s*([\d.]+)\s*WHERE canonical_name\s*(?:=\s*'([^']+)'|IN\s*\(([\s\S]*?)\))/g;
  let match: RegExpExecArray | null;

  while ((match = updatePattern.exec(sql)) !== null) {
    const score = parseFloat(match[1]);

    if (match[2]) {
      // Single canonical_name = '...'
      scores.set(match[2], score);
    } else if (match[3]) {
      // IN (...) — extract quoted strings
      const names = match[3].match(/'([^']+)'/g);
      if (names) {
        for (const quoted of names) {
          const name = quoted.replace(/'/g, '');
          scores.set(name, score);
        }
      }
    }
  }

  return scores;
}

describe('SQL Migration 287 ↔ Frontend Prestige Mapping', () => {
  let sqlScores: Map<string, number>;
  let sqlContent: string;

  try {
    sqlContent = readFileSync(MIGRATION_PATH, 'utf-8');
    sqlScores = parseMigrationScores(sqlContent);
  } catch {
    sqlContent = '';
    sqlScores = new Map();
  }

  it('migration file exists and is parseable', () => {
    if (!sqlContent) {
      // If oshi-v2 isn't available (e.g., CI), skip gracefully
      console.warn('Skipping migration consistency test: oshi-v2 not found at expected path');
      return;
    }
    expect(sqlScores.size).toBeGreaterThan(0);
  });

  it('migration contains all tier-representative families', () => {
    if (!sqlContent) return;

    // One family from each score tier should be in the migration
    const representatives = [
      ['Imperial Family', 10],
      ['Tokugawa Family', 9],
      ['Maeda Family', 8],
      ['Kuroda Family', 6],
      ['Sakai Family', 4],
      ['Iwasaki Family', 3.5],
      ['Seikado Bunko', 3],
    ] as const;

    for (const [name, expectedScore] of representatives) {
      expect(sqlScores.get(name)).toBe(expectedScore);
    }
  });

  it('every SQL score matches frontend getPrestigeScore()', () => {
    if (!sqlContent) return;

    const mismatches: string[] = [];
    for (const [name, sqlScore] of sqlScores) {
      const frontendScore = getPrestigeScore(name).score;
      if (frontendScore !== sqlScore) {
        mismatches.push(
          `"${name}": SQL=${sqlScore}, frontend=${frontendScore}`
        );
      }
    }

    if (mismatches.length > 0) {
      throw new Error(
        `Frontend/backend score mismatches:\n${mismatches.join('\n')}`
      );
    }
  });

  it('migration has correct score tiers (no unexpected values)', () => {
    if (!sqlContent) return;

    const validScores = new Set([10, 9, 8, 6, 4, 3.5, 3]);
    for (const [name, score] of sqlScores) {
      expect(validScores.has(score)).toBe(true);
    }
  });
});

describe('SQL Migration 288 — Column Definitions', () => {
  let sqlContent: string;

  try {
    const path = join(
      process.cwd(),
      '..', 'oshi-v2', 'supabase', 'migrations', '288_provenance_factor_columns.sql'
    );
    sqlContent = readFileSync(path, 'utf-8');
  } catch {
    sqlContent = '';
  }

  it('adds provenance_factor to smith_entities', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('smith_entities');
    expect(sqlContent).toContain('provenance_factor');
    expect(sqlContent).toContain('NUMERIC(4,2)');
  });

  it('adds provenance_factor to tosogu_makers', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('tosogu_makers');
    expect(sqlContent).toContain('provenance_factor');
  });

  it('adds provenance_count to both tables', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('provenance_count INTEGER');
  });

  it('adds provenance_apex to both tables', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('provenance_apex');
    expect(sqlContent).toContain('NUMERIC(3,1)');
  });

  it('creates descending indexes', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('DESC NULLS LAST');
  });
});

describe('SQL Migration 289 — Compute Function', () => {
  let sqlContent: string;

  try {
    const path = join(
      process.cwd(),
      '..', 'oshi-v2', 'supabase', 'migrations', '289_compute_provenance_factor.sql'
    );
    sqlContent = readFileSync(path, 'utf-8');
  } catch {
    sqlContent = '';
  }

  it('creates compute_provenance_factor() function', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION compute_provenance_factor()');
  });

  it('creates recompute_provenance_factor() function', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION recompute_provenance_factor(p_codes TEXT[])');
  });

  it('uses C=20 Bayesian prior', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('v_C NUMERIC := 20');
  });

  it('uses m=2.0 prior mean', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('v_m NUMERIC := 2.0');
  });

  it('uses default score 2.0 for unmapped owners', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('v_default NUMERIC := 2.0');
  });

  it('filters non_provenance entries', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain("dcn.category != 'non_provenance'");
  });

  it('uses parent fallback for prestige resolution', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('dcn_parent.prestige_score');
    expect(sqlContent).toContain('dcn.parent_canonical');
  });

  it('processes both smith_entities and tosogu_makers', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('gold_smith_id');
    expect(sqlContent).toContain('gold_maker_id');
    expect(sqlContent).toContain('smith_entities');
    expect(sqlContent).toContain('tosogu_makers');
  });

  it('uses CROSS JOIN LATERAL unnest for array expansion', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('CROSS JOIN LATERAL unnest');
  });

  it('applies the V4 formula: (C*m + weighted_sum) / (C + observation_count)', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('v_C * v_m + weighted_sum');
    expect(sqlContent).toContain('v_C + observation_count');
  });

  it('executes batch computation at end', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('SELECT * FROM compute_provenance_factor()');
  });

  it('sets provenance_factor to NULL for artisans with 0 observations', () => {
    if (!sqlContent) return;
    expect(sqlContent).toContain('provenance_factor = NULL');
  });
});

describe('Frontend PROVENANCE_TIERS matches SQL tier boundaries', () => {
  it('tier score values match the prestige score tiers in the SQL', () => {
    // These scores define the tier boundaries used by scoreToTier()
    const expectedTiers = [
      { key: 'imperial', score: 10 },
      { key: 'shogunal', score: 9 },
      { key: 'premier', score: 8 },
      { key: 'major', score: 6 },
      { key: 'mid', score: 4 },
      { key: 'zaibatsu', score: 3.5 },
      { key: 'institution', score: 3 },
      { key: 'minor', score: 2 },
    ];

    for (const expected of expectedTiers) {
      const tier = PROVENANCE_TIERS.find(t => t.key === expected.key);
      expect(tier).toBeDefined();
      expect(tier!.score).toBe(expected.score);
    }
  });

  it('C=20 in frontend matches SQL DECLARE', () => {
    // The PRIOR_STRENGTH constant in provenanceMock.ts must match v_C in SQL
    // We test this indirectly: compute with known data and verify the result
    // matches the formula with C=20

    const data = [{
      parent: 'Tokugawa Family',
      parent_ja: null,
      totalCount: 20,
      children: [{ owner: 'Tokugawa Family', owner_ja: null, count: 20 }],
      isGroup: false,
    }];

    const result = computeProvenanceAnalysis(data);
    // If C=20: (20*2 + 9*20) / (20+20) = (40+180)/40 = 220/40 = 5.50
    // If C=5:  (5*2 + 9*20) / (5+20)  = (10+180)/25 = 190/25 = 7.60
    // If C=10: (10*2 + 9*20) / (10+20) = (20+180)/30 = 200/30 = 6.67

    expect(result.factor).toBeCloseTo(5.5, 1); // Only matches C=20
  });
});
