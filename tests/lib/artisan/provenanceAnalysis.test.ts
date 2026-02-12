import { describe, it, expect, vi } from 'vitest';

// Mock Supabase before importing modules that depend on it
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}));

import {
  computeProvenanceAnalysis,
  getPrestigeScore,
  PROVENANCE_TIERS,
  type ProvenanceAnalysis,
} from '@/lib/artisan/provenanceMock';

// ─── HELPERS ────────────────────────────────────────────────────────────────

type DenraiGroupInput = Array<{
  parent: string;
  totalCount: number;
  children: Array<{ owner: string; count: number }>;
  isGroup: boolean;
}>;

/** Build a simple denraiGrouped from owner→count pairs (no hierarchy). */
function flat(entries: Array<[string, number]>): DenraiGroupInput {
  return entries.map(([owner, count]) => ({
    parent: owner,
    totalCount: count,
    children: [{ owner, count }],
    isGroup: false,
  }));
}

/** Build a grouped denrai entry (family with children). */
function group(
  parent: string,
  children: Array<[string, number]>
): DenraiGroupInput[0] {
  const childEntries = children.map(([name, count]) => ({ owner: name, count }));
  return {
    parent,
    totalCount: childEntries.reduce((sum, c) => sum + c.count, 0),
    children: childEntries,
    isGroup: children.length > 1,
  };
}

/** V4 formula reference implementation for verification.
 *  factor = (C * m + Σ(score * count)) / (C + Σ count)
 *  C=20, m=2
 */
function v4Reference(observations: Array<{ score: number; count: number }>): number {
  const C = 20;
  const m = 2;
  const totalCount = observations.reduce((s, o) => s + o.count, 0);
  const weightedSum = observations.reduce((s, o) => s + o.score * o.count, 0);
  return Math.round(((C * m + weightedSum) / (C + totalCount)) * 100) / 100;
}

// ─── getPrestigeScore() ─────────────────────────────────────────────────────

describe('getPrestigeScore', () => {
  describe('exact matches', () => {
    it('returns 10 for Imperial Family', () => {
      expect(getPrestigeScore('Imperial Family').score).toBe(10);
    });

    it('returns 9 for Tokugawa Family', () => {
      expect(getPrestigeScore('Tokugawa Family').score).toBe(9);
    });

    it('returns 8 for Maeda Family (Premier Daimyō)', () => {
      expect(getPrestigeScore('Maeda Family').score).toBe(8);
    });

    it('returns 6 for Kuroda Family (Major Daimyō)', () => {
      expect(getPrestigeScore('Kuroda Family').score).toBe(6);
    });

    it('returns 4 for Sakai Family (Other Daimyō)', () => {
      expect(getPrestigeScore('Sakai Family').score).toBe(4);
    });

    it('returns 3.5 for Iwasaki Family (Zaibatsu)', () => {
      expect(getPrestigeScore('Iwasaki Family').score).toBe(3.5);
    });

    it('returns 3 for Seikado Bunko (Institution)', () => {
      expect(getPrestigeScore('Seikado Bunko').score).toBe(3);
    });
  });

  describe('parent family fallback', () => {
    it('resolves "Tokugawa Ieyasu" to Tokugawa Family (score 9)', () => {
      const result = getPrestigeScore('Tokugawa Ieyasu');
      expect(result.score).toBe(9);
    });

    it('resolves "Maeda Toshiie" to Maeda Family (score 8)', () => {
      const result = getPrestigeScore('Maeda Toshiie');
      expect(result.score).toBe(8);
    });

    it('resolves "Shimazu Nariakira" to Shimazu Family (score 8)', () => {
      const result = getPrestigeScore('Shimazu Nariakira');
      expect(result.score).toBe(8);
    });
  });

  describe('default (Named Collector)', () => {
    it('returns score 2 for unknown owners', () => {
      expect(getPrestigeScore('Unknown Person').score).toBe(2);
    });

    it('returns type "person" for unknown owners', () => {
      expect(getPrestigeScore('Random Collector').type).toBe('person');
    });

    it('returns score 2 for empty-ish names', () => {
      expect(getPrestigeScore('A').score).toBe(2);
    });
  });

  describe('type annotations', () => {
    it('Imperial has type imperial', () => {
      expect(getPrestigeScore('Imperial Family').type).toBe('imperial');
    });

    it('Tokugawa has type shogunal', () => {
      expect(getPrestigeScore('Tokugawa Family').type).toBe('shogunal');
    });

    it('Owari Tokugawa has type gosanke', () => {
      expect(getPrestigeScore('Owari Tokugawa Family').type).toBe('gosanke');
    });

    it('Kasuga Taisha has type shrine', () => {
      expect(getPrestigeScore('Kasuga Taisha').type).toBe('shrine');
    });
  });
});

// ─── PROVENANCE_TIERS configuration ─────────────────────────────────────────

describe('PROVENANCE_TIERS', () => {
  it('has exactly 8 tiers', () => {
    expect(PROVENANCE_TIERS).toHaveLength(8);
  });

  it('tiers are ordered by score descending', () => {
    for (let i = 1; i < PROVENANCE_TIERS.length; i++) {
      expect(PROVENANCE_TIERS[i].score).toBeLessThan(PROVENANCE_TIERS[i - 1].score);
    }
  });

  it('top 4 tiers are scored (contribute to factor)', () => {
    const scored = PROVENANCE_TIERS.filter(t => t.scored);
    expect(scored).toHaveLength(4);
    expect(scored.map(t => t.key)).toEqual(['imperial', 'shogunal', 'premier', 'major']);
  });

  it('bottom 4 tiers are unscored (display-only)', () => {
    const unscored = PROVENANCE_TIERS.filter(t => !t.scored);
    expect(unscored).toHaveLength(4);
    expect(unscored.map(t => t.key)).toEqual(['mid', 'zaibatsu', 'institution', 'minor']);
  });
});

// ─── computeProvenanceAnalysis() V4 formula ────────────────────────────────

describe('computeProvenanceAnalysis — V4 formula', () => {
  describe('null/empty cases', () => {
    it('returns null for empty array', () => {
      expect(computeProvenanceAnalysis([])).toBeNull();
    });

    it('returns null for null-ish input', () => {
      expect(computeProvenanceAnalysis(null as unknown as DenraiGroupInput)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(computeProvenanceAnalysis(undefined as unknown as DenraiGroupInput)).toBeNull();
    });
  });

  describe('single-tier cases', () => {
    it('single Imperial observation: heavy prior pulls toward 2.0', () => {
      const data = flat([['Imperial Family', 1]]);
      const result = computeProvenanceAnalysis(data)!;

      // (20*2 + 10*1) / (20 + 1) = 50/21 = 2.38
      expect(result.factor).toBeCloseTo(2.38, 1);
      expect(result.count).toBe(1);
      expect(result.apex).toBe(10);
    });

    it('single Named Collector: factor equals prior mean', () => {
      const data = flat([['Some Person', 1]]);
      const result = computeProvenanceAnalysis(data)!;

      // (20*2 + 2*1) / (20 + 1) = 42/21 = 2.00
      expect(result.factor).toBe(2);
      expect(result.count).toBe(1);
      expect(result.apex).toBe(2);
    });

    it('many Named Collectors: factor stays at 2.0', () => {
      const data = flat([['Collector A', 50], ['Collector B', 50]]);
      const result = computeProvenanceAnalysis(data)!;

      // (20*2 + 2*100) / (20 + 100) = 240/120 = 2.00
      expect(result.factor).toBe(2);
      expect(result.count).toBe(100);
    });
  });

  describe('reference artisan calculations', () => {
    it('Mitsutada-like: 46 observations, dense elite concentration', () => {
      // Simulated data matching Mitsutada (MIT281) from the design doc
      // ~46 observations with weighted sum ~259
      const data: DenraiGroupInput = [
        ...flat([['Tokugawa Family', 15]]),      // score 9 → 135
        ...flat([['Maeda Family', 8]]),           // score 8 → 64
        ...flat([['Hosokawa Family', 5]]),        // score 8 → 40
        ...flat([['Kuroda Family', 3]]),          // score 6 → 18
        ...flat([['Some Collector', 15]]),        // score 2 → 30
      ];
      // Weighted sum = 135 + 64 + 40 + 18 + 30 = 287
      // Total count = 15 + 8 + 5 + 3 + 15 = 46
      // Factor = (20*2 + 287) / (20 + 46) = 327/66 = 4.95

      const result = computeProvenanceAnalysis(data)!;
      const expected = v4Reference([
        { score: 9, count: 15 },
        { score: 8, count: 8 },
        { score: 8, count: 5 },
        { score: 6, count: 3 },
        { score: 2, count: 15 },
      ]);

      expect(result.factor).toBeCloseTo(expected, 1);
      expect(result.count).toBe(46);
      expect(result.apex).toBe(9);
    });

    it('Masamune-like: 188 observations, high volume dominance', () => {
      // Simulated data approximating Masamune (MAS590) profile
      const data: DenraiGroupInput = [
        ...flat([['Imperial Family', 5]]),        // score 10 → 50
        ...flat([['Tokugawa Family', 47]]),       // score 9 → 423
        ...flat([['Maeda Family', 12]]),          // score 8 → 96
        ...flat([['Shimazu Family', 8]]),         // score 8 → 64
        ...flat([['Hosokawa Family', 6]]),        // score 8 → 48
        ...flat([['Kuroda Family', 10]]),         // score 6 → 60
        ...flat([['Sakai Family', 5]]),           // score 4 → 20
        ...flat([['Iwasaki Family', 3]]),         // score 3.5 → 10.5
        ...flat([['Seikado Bunko', 2]]),          // score 3 → 6
        ...flat([['Named A', 40]]),               // score 2 → 80
        ...flat([['Named B', 50]]),               // score 2 → 100
      ];
      // Total count = 5+47+12+8+6+10+5+3+2+40+50 = 188
      // Weighted sum = 50+423+96+64+48+60+20+10.5+6+80+100 = 957.5
      // Factor = (40 + 957.5) / (20 + 188) = 997.5/208 = 4.80

      const result = computeProvenanceAnalysis(data)!;
      expect(result.factor).toBeGreaterThan(4.5);
      expect(result.count).toBe(188);
      expect(result.apex).toBe(10);
    });

    it('obscure smith: 2 observations, prior dominates', () => {
      // Artisan with minimal provenance — 1 daimyō + 1 named
      const data = flat([
        ['Arima Family', 1],   // score 4
        ['Some Person', 1],    // score 2
      ]);
      const result = computeProvenanceAnalysis(data)!;

      // (20*2 + 4*1 + 2*1) / (20 + 2) = 46/22 = 2.09
      expect(result.factor).toBeCloseTo(2.09, 1);
      expect(result.count).toBe(2);
      expect(result.apex).toBe(4);
    });
  });

  describe('V4: all observations count (not just scored tiers)', () => {
    it('Named Collectors dilute the score', () => {
      // 2 Imperial + 0 Named vs 2 Imperial + 100 Named
      const eliteOnly = flat([['Imperial Family', 2]]);
      const diluted: DenraiGroupInput = [
        ...flat([['Imperial Family', 2]]),
        ...flat([['Collector A', 50]]),
        ...flat([['Collector B', 50]]),
      ];

      const eliteResult = computeProvenanceAnalysis(eliteOnly)!;
      const dilutedResult = computeProvenanceAnalysis(diluted)!;

      // Elite-only: (40 + 20) / (20 + 2) = 60/22 = 2.73
      // Diluted: (40 + 20 + 200) / (20 + 102) = 260/122 = 2.13
      expect(eliteResult.factor).toBeGreaterThan(dilutedResult.factor);
      expect(dilutedResult.factor).toBeCloseTo(2.13, 1);
    });

    it('Other Daimyō (score 4) and Zaibatsu (score 3.5) contribute to factor', () => {
      // In V1 (scored-only), these would not affect the factor
      // In V4, they DO contribute
      const data: DenraiGroupInput = [
        ...flat([['Sakai Family', 10]]),          // score 4 → 40
        ...flat([['Iwasaki Family', 10]]),        // score 3.5 → 35
        ...flat([['Seikado Bunko', 10]]),         // score 3 → 30
      ];
      const result = computeProvenanceAnalysis(data)!;

      // (40 + 40 + 35 + 30) / (20 + 30) = 145/50 = 2.90
      // Without these (V1): factor would be PRIOR_MEAN = 2.0
      expect(result.factor).toBeGreaterThan(2.5);
      expect(result.factor).toBeCloseTo(2.9, 1);
    });

    it('Institutions (score 3) contribute to factor', () => {
      const data = flat([['Nezu Museum', 5]]);
      const result = computeProvenanceAnalysis(data)!;

      // (40 + 15) / (20 + 5) = 55/25 = 2.20
      expect(result.factor).toBeCloseTo(2.2, 1);
      expect(result.factor).toBeGreaterThan(2.0);
    });
  });

  describe('Bayesian prior behavior (C=20, m=2)', () => {
    it('1 observation: prior dominates heavily', () => {
      const data = flat([['Imperial Family', 1]]);
      const result = computeProvenanceAnalysis(data)!;

      // (40 + 10) / (20 + 1) = 50/21 ≈ 2.38
      expect(result.factor).toBeCloseTo(2.38, 1);
      // Despite Imperial score of 10, factor is only 2.38
    });

    it('20 observations: prior and data balanced equally', () => {
      const data = flat([['Tokugawa Family', 20]]);
      const result = computeProvenanceAnalysis(data)!;

      // (40 + 180) / (20 + 20) = 220/40 = 5.50
      expect(result.factor).toBeCloseTo(5.5, 1);
    });

    it('100 observations: data dominates', () => {
      const data = flat([['Tokugawa Family', 100]]);
      const result = computeProvenanceAnalysis(data)!;

      // (40 + 900) / (20 + 100) = 940/120 = 7.83
      expect(result.factor).toBeCloseTo(7.83, 1);
      // Approaches the raw score of 9 but prior still pulls down
    });

    it('1000 observations: factor approaches raw score', () => {
      const data = flat([['Tokugawa Family', 1000]]);
      const result = computeProvenanceAnalysis(data)!;

      // (40 + 9000) / (20 + 1000) = 9040/1020 = 8.86
      expect(result.factor).toBeCloseTo(8.86, 1);
      // Very close to raw score of 9 — prior effect is negligible
    });

    it('prior mean = 2.0: all-named-collector artisan scores exactly 2.0', () => {
      const data = flat([
        ['Person A', 10],
        ['Person B', 20],
        ['Person C', 30],
      ]);
      const result = computeProvenanceAnalysis(data)!;

      // All scores are 2, so: (40 + 2*60) / (20 + 60) = 160/80 = 2.00
      expect(result.factor).toBe(2.0);
    });
  });

  describe('tier classification and counts', () => {
    it('classifies collectors into correct tiers', () => {
      const data: DenraiGroupInput = [
        ...flat([['Imperial Family', 1]]),
        ...flat([['Tokugawa Family', 2]]),
        ...flat([['Maeda Family', 3]]),
        ...flat([['Kuroda Family', 4]]),
        ...flat([['Sakai Family', 5]]),
        ...flat([['Iwasaki Family', 6]]),
        ...flat([['Nezu Museum', 7]]),
        ...flat([['Random Person', 8]]),
      ];
      const result = computeProvenanceAnalysis(data)!;

      expect(result.tierCounts.imperial).toBe(1);
      expect(result.tierCounts.shogunal).toBe(2);
      expect(result.tierCounts.premier).toBe(3);
      expect(result.tierCounts.major).toBe(4);
      expect(result.tierCounts.mid).toBe(5);
      expect(result.tierCounts.zaibatsu).toBe(6);
      expect(result.tierCounts.institution).toBe(7);
      expect(result.tierCounts.minor).toBe(8);
    });

    it('reports correct apex', () => {
      const data = flat([['Kuroda Family', 1], ['Random', 5]]);
      const result = computeProvenanceAnalysis(data)!;
      expect(result.apex).toBe(6); // Kuroda = Major Daimyō = score 6
    });

    it('tiers array has entries for all 8 tiers', () => {
      const data = flat([['Tokugawa Family', 1]]);
      const result = computeProvenanceAnalysis(data)!;
      expect(result.tiers).toHaveLength(8);
      expect(result.tiers.map(t => t.key)).toEqual(
        PROVENANCE_TIERS.map(t => t.key)
      );
    });

    it('tiers with 0 works have empty collectors array', () => {
      const data = flat([['Imperial Family', 1]]);
      const result = computeProvenanceAnalysis(data)!;

      const shogunalTier = result.tiers.find(t => t.key === 'shogunal')!;
      expect(shogunalTier.totalWorks).toBe(0);
      expect(shogunalTier.collectors).toHaveLength(0);
    });
  });

  describe('grouped hierarchy (family with children)', () => {
    it('family group uses parent prestige for tier classification', () => {
      const data: DenraiGroupInput = [
        group('Tokugawa Family', [
          ['Tokugawa Ieyasu', 5],
          ['Tokugawa Hidetada', 3],
        ]),
      ];
      const result = computeProvenanceAnalysis(data)!;

      // Parent "Tokugawa Family" resolves to score 9 (shogunal)
      expect(result.tierCounts.shogunal).toBe(8);
      expect(result.count).toBe(8);
    });

    it('mixed groups compute correctly', () => {
      const data: DenraiGroupInput = [
        group('Tokugawa Family', [
          ['Tokugawa Ieyasu', 3],
          ['Tokugawa Iesato', 2],
        ]),
        ...flat([['Nezu Museum', 5]]),
        ...flat([['Unknown Person', 10]]),
      ];
      const result = computeProvenanceAnalysis(data)!;

      // Observations: 5 × score 9 = 45, 5 × score 3 = 15, 10 × score 2 = 20
      // Total: (40 + 45 + 15 + 20) / (20 + 20) = 120/40 = 3.00
      expect(result.factor).toBeCloseTo(3.0, 1);
      expect(result.count).toBe(20);
    });
  });

  describe('formula consistency with V4 reference', () => {
    it('matches reference implementation for diverse inputs', () => {
      const testCases: Array<{
        name: string;
        input: DenraiGroupInput;
        observations: Array<{ score: number; count: number }>;
      }> = [
        {
          name: 'all Imperial',
          input: flat([['Imperial Family', 10]]),
          observations: [{ score: 10, count: 10 }],
        },
        {
          name: 'mixed elite + common',
          input: [...flat([['Tokugawa Family', 5]]), ...flat([['Person', 15]])],
          observations: [{ score: 9, count: 5 }, { score: 2, count: 15 }],
        },
        {
          name: 'only institutions',
          input: flat([['Kasuga Taisha', 3], ['Atsuta Shrine', 4]]),
          observations: [{ score: 3, count: 3 }, { score: 3, count: 4 }],
        },
        {
          name: 'single zaibatsu',
          input: flat([['Mitsui Family', 7]]),
          observations: [{ score: 3.5, count: 7 }],
        },
      ];

      for (const tc of testCases) {
        const result = computeProvenanceAnalysis(tc.input)!;
        const expected = v4Reference(tc.observations);
        expect(result.factor).toBeCloseTo(expected, 1);
      }
    });
  });
});

// ─── Prestige score mapping consistency ─────────────────────────────────────

describe('Prestige mapping consistency', () => {
  it('Gosanke families all score 8', () => {
    const gosanke = ['Owari Tokugawa Family', 'Kishu Tokugawa Family', 'Mito Tokugawa Family'];
    for (const family of gosanke) {
      expect(getPrestigeScore(family).score).toBe(8);
    }
  });

  it('Gosankyō families all score 8', () => {
    const gosankyo = ['Tayasu Tokugawa Family', 'Hitotsubashi Tokugawa Family'];
    for (const family of gosankyo) {
      expect(getPrestigeScore(family).score).toBe(8);
    }
  });

  it('all explicitly mapped families have scores ≥ 3', () => {
    // No family should score less than Institution tier
    const families = [
      'Maeda Family', 'Shimazu Family', 'Date Family', 'Hosokawa Family',
      'Kuroda Family', 'Asano Family', 'Mori Family', 'Nabeshima Family',
      'Ii Family', 'Ikeda Family', 'Uesugi Family',
      'Sakai Family', 'Honda Family', 'Sanada Family', 'Takeda Family',
    ];
    for (const family of families) {
      expect(getPrestigeScore(family).score).toBeGreaterThanOrEqual(3);
    }
  });

  it('Shogunal score > Premier Daimyō > Major Daimyō > Other Daimyō > Zaibatsu > Institution > Named', () => {
    const hierarchy = [
      getPrestigeScore('Tokugawa Family').score,         // 9 (Shogunal)
      getPrestigeScore('Maeda Family').score,             // 8 (Premier)
      getPrestigeScore('Kuroda Family').score,            // 6 (Major)
      getPrestigeScore('Sakai Family').score,             // 4 (Other)
      getPrestigeScore('Iwasaki Family').score,           // 3.5 (Zaibatsu)
      getPrestigeScore('Seikado Bunko').score,            // 3 (Institution)
      getPrestigeScore('Random Person').score,            // 2 (Named)
    ];

    for (let i = 1; i < hierarchy.length; i++) {
      expect(hierarchy[i - 1]).toBeGreaterThan(hierarchy[i]);
    }
  });
});

// ─── SQL migration consistency ─────────────────────────────────────────────

describe('Prestige scores match SQL migration mapping', () => {
  // These are the values that Migration 287 will write to denrai_canonical_names.
  // If these tests fail, the frontend and backend are out of sync.

  const SQL_MIGRATION_SCORES: Record<string, number> = {
    'Imperial Family': 10,
    'Tokugawa Family': 9,
    'Tokugawa Shogun Family': 9,
    'Ashikaga Family': 9,
    'Toyotomi Family': 9,
    'Maeda Family': 8,
    'Shimazu Family': 8,
    'Echizen Matsudaira Family': 8,
    'Date Family': 8,
    'Owari Tokugawa Family': 8,
    'Kishu Tokugawa Family': 8,
    'Hosokawa Family': 8,
    'Mito Tokugawa Family': 8,
    'Tayasu Tokugawa Family': 8,
    'Hitotsubashi Tokugawa Family': 8,
    'Kuroda Family': 6,
    'Asano Family': 6,
    'Mori Family': 6,
    'Nabeshima Family': 6,
    'Ii Family': 6,
    'Ikeda Family': 6,
    'Hachisuka Family': 6,
    'Yamauchi Family': 6,
    'Aizu Matsudaira Family': 6,
    'Uesugi Family': 6,
    'Satake Family': 6,
    'Todo Family': 6,
    'Oda Family': 6,
    'Sakai Family': 4,
    'Ogasawara Family': 4,
    'Matsudaira Family': 4,
    'Honda Family': 4,
    'Sanada Family': 4,
    'Takeda Family': 4,
    'Konoe Family': 4,
    'Iwasaki Family': 3.5,
    'Mitsui Family': 3.5,
    'Sumitomo Family': 3.5,
    'Konoike Family': 3.5,
    'Seikado Bunko': 3,
    'Eisei Bunko': 3,
    'Nezu Museum': 3,
    'Sano Art Museum': 3,
    'Kasuga Taisha': 3,
    'Atsuta Shrine': 3,
  };

  for (const [name, expectedScore] of Object.entries(SQL_MIGRATION_SCORES)) {
    it(`${name} → ${expectedScore}`, () => {
      expect(getPrestigeScore(name).score).toBe(expectedScore);
    });
  }
});
