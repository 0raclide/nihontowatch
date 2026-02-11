/**
 * MOCK provenance prestige scoring for front-end prototype.
 *
 * This file will be REPLACED by DB-backed prestige scores from
 * denrai_canonical_names.prestige_score once the backend is built.
 *
 * Scoring: 10 = Imperial/Shogunal, 8 = Premier Daimyō (500K+ koku),
 * 6 = Major Daimyō (200K+), 4 = Mid Daimyō/Institution, 2 = Minor/Named
 */

export interface CollectorMeta {
  score: number;
  koku?: number;
  domain?: string;
  type?: string; // shinpan, tozama, fudai, gosanke, gosankyo, imperial, shogunal, institution, shrine, merchant
}

// ─── PRESTIGE MAPPING ──────────────────────────────────────────────────────
// Keys must match canonical owner names from denrai_canonical_names

const PRESTIGE: Record<string, CollectorMeta> = {
  // Score 10 — Imperial & Shogunal
  'Imperial Family':               { score: 10, type: 'imperial' },
  'Tokugawa Family':               { score: 10, type: 'shogunal' },
  'Tokugawa Shogun Family':        { score: 10, type: 'shogunal' },
  'Ashikaga Family':               { score: 10, type: 'shogunal' },
  'Toyotomi Family':               { score: 10, type: 'shogunal' },

  // Score 8 — Premier Daimyō (500K+ koku or Gosanke/Gosankyō political status)
  'Maeda Family':                  { score: 8, koku: 1025000, domain: 'Kaga', type: 'tozama' },
  'Shimazu Family':                { score: 8, koku: 770000, domain: 'Satsuma', type: 'tozama' },
  'Echizen Matsudaira Family':     { score: 8, koku: 680000, domain: 'Echizen', type: 'shinpan' },
  'Date Family':                   { score: 8, koku: 625000, domain: 'Sendai', type: 'tozama' },
  'Owari Tokugawa Family':         { score: 8, koku: 619500, domain: 'Owari', type: 'gosanke' },
  'Kishu Tokugawa Family':         { score: 8, koku: 555000, domain: 'Kishū', type: 'gosanke' },
  'Hosokawa Family':               { score: 8, koku: 540000, domain: 'Kumamoto', type: 'tozama' },
  'Mito Tokugawa Family':          { score: 8, koku: 350000, domain: 'Mito', type: 'gosanke' },
  'Tayasu Tokugawa Family':        { score: 8, type: 'gosankyo' },
  'Hitotsubashi Tokugawa Family':  { score: 8, type: 'gosankyo' },

  // Score 6 — Major Daimyō (200K-499K koku)
  'Kuroda Family':                 { score: 6, koku: 473000, domain: 'Fukuoka', type: 'tozama' },
  'Asano Family':                  { score: 6, koku: 426500, domain: 'Hiroshima', type: 'tozama' },
  'Mori Family':                   { score: 6, koku: 369000, domain: 'Chōshū', type: 'tozama' },
  'Nabeshima Family':              { score: 6, koku: 357000, domain: 'Saga', type: 'tozama' },
  'Ii Family':                     { score: 6, koku: 350000, domain: 'Hikone', type: 'fudai' },
  'Ikeda Family':                  { score: 6, koku: 325000, domain: 'Okayama', type: 'tozama' },
  'Hachisuka Family':              { score: 6, koku: 257000, domain: 'Tokushima', type: 'tozama' },
  'Yamauchi Family':               { score: 6, koku: 242000, domain: 'Tosa', type: 'tozama' },
  'Aizu Matsudaira Family':        { score: 6, koku: 230000, domain: 'Aizu', type: 'shinpan' },
  'Uesugi Family':                 { score: 6, koku: 300000, domain: 'Yonezawa', type: 'tozama' },
  'Satake Family':                 { score: 6, koku: 200000, domain: 'Akita', type: 'tozama' },
  'Todo Family':                   { score: 6, koku: 323000, domain: 'Tsu', type: 'tozama' },
  'Oda Family':                    { score: 6, type: 'tozama' },

  // Score 4 — Mid Daimyō / Institutions / Shrines
  'Sakai Family':                  { score: 4, koku: 140000, domain: 'Shōnai', type: 'fudai' },
  'Ogasawara Family':              { score: 4, koku: 150000, domain: 'Kokura', type: 'fudai' },
  'Matsudaira Family':             { score: 4, koku: 186000, domain: 'various', type: 'shinpan' },
  'Arima Family':                  { score: 4, koku: 210000, domain: 'Kurume', type: 'tozama' },
  'Matsue Matsudaira Family':      { score: 4, koku: 186000, domain: 'Matsue', type: 'shinpan' },
  'Saijo Matsudaira Family':       { score: 4, koku: 30000, domain: 'Saijō', type: 'shinpan' },
  'Takasu Matsudaira Family':      { score: 4, koku: 30000, domain: 'Takasu', type: 'shinpan' },
  'Hisamatsu Matsudaira Family':   { score: 4, type: 'shinpan' },
  'Honda Family':                  { score: 4, koku: 100000, domain: 'various', type: 'fudai' },
  'Inaba Family':                  { score: 4, type: 'fudai' },
  'Makino Family':                 { score: 4, type: 'fudai' },
  'Yanagisawa Family':             { score: 4, type: 'fudai' },
  'Naito Family':                  { score: 4, type: 'fudai' },
  'Okudaira Family':               { score: 4, type: 'fudai' },
  'Okubo Family':                  { score: 4, type: 'fudai' },
  'Tsuchiya Family':               { score: 4, type: 'fudai' },
  'Mizuno Family':                 { score: 4, type: 'fudai' },
  'Naruse Family':                 { score: 4, koku: 35000, domain: 'Inuyama', type: 'fudai' },
  'Tachibana Family':              { score: 4, koku: 120000, domain: 'Yanagawa', type: 'tozama' },
  'Nanbu Family':                  { score: 4, koku: 200000, domain: 'Morioka', type: 'tozama' },
  'Tsugaru Family':                { score: 4, koku: 100000, domain: 'Hirosaki', type: 'tozama' },
  'Sanada Family':                 { score: 4, koku: 100000, domain: 'Matsushiro', type: 'tozama' },
  'Hojo Family':                   { score: 4, type: 'tozama' },
  'Kyogoku Family':                { score: 4, type: 'tozama' },
  'Akimoto Family':                { score: 4, type: 'fudai' },
  'Kamei Family':                  { score: 4, type: 'tozama' },
  'Takeda Family':                 { score: 4, type: 'tozama' },
  'Konoe Family':                  { score: 4, type: 'court' },
  // Institutions
  'Seikado Bunko':                 { score: 4, type: 'institution' },
  'Eisei Bunko':                   { score: 4, type: 'institution' },
  'Nezu Museum':                   { score: 4, type: 'institution' },
  'Sano Art Museum':               { score: 4, type: 'institution' },
  'Kurokawa Institute':            { score: 4, type: 'institution' },
  'Tokugawa Reimeikai Foundation': { score: 4, type: 'institution' },
  'Iwasaki Family':                { score: 4, type: 'merchant' },
  'Mitsui Family':                 { score: 4, type: 'merchant' },
  'Konoike Family':                { score: 4, type: 'merchant' },
  // Shrines
  'Kasuga Taisha':                 { score: 4, type: 'shrine' },
  'Atsuta Shrine':                 { score: 4, type: 'shrine' },
  'Tanzan Shrine':                 { score: 4, type: 'shrine' },
  'Yasukuni Shrine':               { score: 4, type: 'shrine' },
};

// ─── HELPERS ───────────────────────────────────────────────────────────────

/** Resolve prestige score for an owner name. Default = 2 (minor/named). */
export function getPrestigeScore(owner: string): CollectorMeta {
  // Exact match
  if (PRESTIGE[owner]) return PRESTIGE[owner];

  // Try parent family match (e.g., "Tokugawa Iemitsu" → check "Tokugawa Family")
  // This handles individual people whose family is in the mapping
  for (const [key, meta] of Object.entries(PRESTIGE)) {
    if (key.endsWith(' Family')) {
      const familyName = key.replace(' Family', '');
      if (owner.startsWith(familyName + ' ') || owner === familyName) {
        return meta;
      }
    }
  }

  return { score: 2, type: 'person' };
}

/** Format koku for display: 1025000 → "1,025,000" */
export function formatKoku(koku: number): string {
  return koku.toLocaleString('en-US');
}

// ─── TIER DEFINITIONS ──────────────────────────────────────────────────────

export const PROVENANCE_TIERS = [
  { key: 'imperial', label: 'Imperial & Shogunal', score: 10, indent: 0 },
  { key: 'premier',  label: 'Premier Daimyō', score: 8, indent: 1 },
  { key: 'major',    label: 'Major Daimyō', score: 6, indent: 2 },
  { key: 'mid',      label: 'Institutions & Daimyō', score: 4, indent: 3 },
  { key: 'minor',    label: 'Named Collectors', score: 2, indent: 3 },
] as const;

export type TierKey = typeof PROVENANCE_TIERS[number]['key'];

export interface TierCollector {
  name: string;
  works: number;
  meta: CollectorMeta;
  children?: Array<{ name: string; works: number }>;
  isGroup: boolean;
}

export interface ProvenanceTierData {
  key: TierKey;
  label: string;
  score: number;
  totalWorks: number;
  collectors: TierCollector[];
}

export interface ProvenanceAnalysis {
  factor: number;
  count: number;       // total provenanced works
  apex: number;        // highest tier reached
  tierCounts: Record<TierKey, number>;
  tiers: ProvenanceTierData[];
}

// ─── COMPUTATION ───────────────────────────────────────────────────────────

/** Bayesian prior constants — same philosophy as elite_factor */
const PRIOR_STRENGTH = 5;  // phantom observations
const PRIOR_MEAN = 2;      // "minor documented" baseline

function scoreToTier(score: number): TierKey {
  if (score >= 10) return 'imperial';
  if (score >= 8)  return 'premier';
  if (score >= 6)  return 'major';
  if (score >= 4)  return 'mid';
  return 'minor';
}

/**
 * Compute provenance analysis from denraiGrouped data.
 * Uses mock prestige scores — will be replaced by DB-backed scores.
 */
export function computeProvenanceAnalysis(
  denraiGrouped: Array<{
    parent: string;
    totalCount: number;
    children: Array<{ owner: string; count: number }>;
    isGroup: boolean;
  }>
): ProvenanceAnalysis | null {
  if (!denraiGrouped || denraiGrouped.length === 0) return null;

  // Build tier buckets
  const tierMap: Record<TierKey, TierCollector[]> = {
    imperial: [], premier: [], major: [], mid: [], minor: [],
  };
  const tierCounts: Record<TierKey, number> = {
    imperial: 0, premier: 0, major: 0, mid: 0, minor: 0,
  };

  let totalWorks = 0;
  let scoreSum = 0;
  let apex = 0;

  for (const group of denraiGrouped) {
    // For groups (families), score by the parent family name
    // For singletons, score by the individual owner
    const parentMeta = getPrestigeScore(group.parent);
    const tierKey = scoreToTier(parentMeta.score);

    tierMap[tierKey].push({
      name: group.parent,
      works: group.totalCount,
      meta: parentMeta,
      children: group.isGroup
        ? group.children.map(c => ({ name: c.owner, works: c.count }))
        : undefined,
      isGroup: group.isGroup,
    });

    tierCounts[tierKey] += group.totalCount;
    totalWorks += group.totalCount;
    scoreSum += parentMeta.score * group.totalCount;
    apex = Math.max(apex, parentMeta.score);
  }

  if (totalWorks === 0) return null;

  // Bayesian smoothed average: (C × m + Σscores) / (C + n)
  const factor = (PRIOR_STRENGTH * PRIOR_MEAN + scoreSum) / (PRIOR_STRENGTH + totalWorks);

  // Build tier data, sorted by score descending, collectors by works descending
  const tiers: ProvenanceTierData[] = PROVENANCE_TIERS.map(t => ({
    key: t.key,
    label: t.label,
    score: t.score,
    totalWorks: tierCounts[t.key],
    collectors: tierMap[t.key].sort((a, b) => b.works - a.works),
  }));

  return {
    factor: Math.round(factor * 100) / 100,
    count: totalWorks,
    apex,
    tierCounts,
    tiers,
  };
}
