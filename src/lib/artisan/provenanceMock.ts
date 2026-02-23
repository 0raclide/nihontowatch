/**
 * MOCK provenance prestige scoring for front-end prototype.
 *
 * This file will be REPLACED by DB-backed prestige scores from
 * denrai_canonical_names.prestige_score once the backend is built.
 *
 * Scoring: 10 = Imperial, 9 = Shogunal, 8 = Premier Daimyō (500K+ koku),
 * 6 = Major Daimyō (200K+), 4 = Other Daimyō, 3.5 = Zaibatsu, 3 = Institutions, 2 = Named
 */

export interface CollectorMeta {
  score: number;
  koku?: number;
  domain?: string;
  domain_ja?: string;
  type?: string; // shinpan, tozama, fudai, gosanke, gosankyo, imperial, shogunal, institution, shrine, zaibatsu, merchant
  name_ja?: string;
}

// ─── PRESTIGE MAPPING ──────────────────────────────────────────────────────
// Keys must match canonical owner names from denrai_canonical_names

const PRESTIGE: Record<string, CollectorMeta> = {
  // Score 10 — Imperial
  'Imperial Family':               { score: 10, type: 'imperial', name_ja: '皇室' },

  // Score 9 — Shogunal
  'Tokugawa Family':               { score: 9, type: 'shogunal', name_ja: '徳川家' },
  'Tokugawa Shogun Family':        { score: 9, type: 'shogunal', name_ja: '徳川将軍家' },
  'Ashikaga Family':               { score: 9, type: 'shogunal', name_ja: '足利家' },
  'Toyotomi Family':               { score: 9, type: 'shogunal', name_ja: '豊臣家' },

  // Score 8 — Premier Daimyō (500K+ koku or Gosanke/Gosankyō political status)
  'Maeda Family':                  { score: 8, koku: 1025000, domain: 'Kaga', domain_ja: '加賀', type: 'tozama', name_ja: '前田家' },
  'Shimazu Family':                { score: 8, koku: 770000, domain: 'Satsuma', domain_ja: '薩摩', type: 'tozama', name_ja: '島津家' },
  'Echizen Matsudaira Family':     { score: 8, koku: 680000, domain: 'Echizen', domain_ja: '越前', type: 'shinpan', name_ja: '越前松平家' },
  'Date Family':                   { score: 8, koku: 625000, domain: 'Sendai', domain_ja: '仙台', type: 'tozama', name_ja: '伊達家' },
  'Owari Tokugawa Family':         { score: 8, koku: 619500, domain: 'Owari', domain_ja: '尾張', type: 'gosanke', name_ja: '尾張徳川家' },
  'Kishu Tokugawa Family':         { score: 8, koku: 555000, domain: 'Kishū', domain_ja: '紀州', type: 'gosanke', name_ja: '紀州徳川家' },
  'Hosokawa Family':               { score: 8, koku: 540000, domain: 'Kumamoto', domain_ja: '熊本', type: 'tozama', name_ja: '細川家' },
  'Mito Tokugawa Family':          { score: 8, koku: 350000, domain: 'Mito', domain_ja: '水戸', type: 'gosanke', name_ja: '水戸徳川家' },
  'Tayasu Tokugawa Family':        { score: 8, type: 'gosankyo', name_ja: '田安徳川家' },
  'Hitotsubashi Tokugawa Family':  { score: 8, type: 'gosankyo', name_ja: '一橋徳川家' },

  // Score 6 — Major Daimyō (200K-499K koku)
  'Kuroda Family':                 { score: 6, koku: 473000, domain: 'Fukuoka', domain_ja: '福岡', type: 'tozama', name_ja: '黒田家' },
  'Asano Family':                  { score: 6, koku: 426500, domain: 'Hiroshima', domain_ja: '広島', type: 'tozama', name_ja: '浅野家' },
  'Mori Family':                   { score: 6, koku: 369000, domain: 'Chōshū', domain_ja: '長州', type: 'tozama', name_ja: '毛利家' },
  'Nabeshima Family':              { score: 6, koku: 357000, domain: 'Saga', domain_ja: '佐賀', type: 'tozama', name_ja: '鍋島家' },
  'Ii Family':                     { score: 6, koku: 350000, domain: 'Hikone', domain_ja: '彦根', type: 'fudai', name_ja: '井伊家' },
  'Ikeda Family':                  { score: 6, koku: 325000, domain: 'Okayama', domain_ja: '岡山', type: 'tozama', name_ja: '池田家' },
  'Hachisuka Family':              { score: 6, koku: 257000, domain: 'Tokushima', domain_ja: '徳島', type: 'tozama', name_ja: '蜂須賀家' },
  'Yamauchi Family':               { score: 6, koku: 242000, domain: 'Tosa', domain_ja: '土佐', type: 'tozama', name_ja: '山内家' },
  'Aizu Matsudaira Family':        { score: 6, koku: 230000, domain: 'Aizu', domain_ja: '会津', type: 'shinpan', name_ja: '会津松平家' },
  'Uesugi Family':                 { score: 6, koku: 300000, domain: 'Yonezawa', domain_ja: '米沢', type: 'tozama', name_ja: '上杉家' },
  'Satake Family':                 { score: 6, koku: 200000, domain: 'Akita', domain_ja: '秋田', type: 'tozama', name_ja: '佐竹家' },
  'Todo Family':                   { score: 6, koku: 323000, domain: 'Tsu', domain_ja: '津', type: 'tozama', name_ja: '藤堂家' },
  'Oda Family':                    { score: 6, type: 'tozama', name_ja: '織田家' },

  // Score 4 — Mid Daimyō / Institutions / Shrines
  'Sakai Family':                  { score: 4, koku: 140000, domain: 'Shōnai', domain_ja: '庄内', type: 'fudai', name_ja: '酒井家' },
  'Ogasawara Family':              { score: 4, koku: 150000, domain: 'Kokura', domain_ja: '小倉', type: 'fudai', name_ja: '小笠原家' },
  'Matsudaira Family':             { score: 4, koku: 186000, domain: 'various', domain_ja: '諸藩', type: 'shinpan', name_ja: '松平家' },
  'Arima Family':                  { score: 4, koku: 210000, domain: 'Kurume', domain_ja: '久留米', type: 'tozama', name_ja: '有馬家' },
  'Matsue Matsudaira Family':      { score: 4, koku: 186000, domain: 'Matsue', domain_ja: '松江', type: 'shinpan', name_ja: '松江松平家' },
  'Saijo Matsudaira Family':       { score: 4, koku: 30000, domain: 'Saijō', domain_ja: '西条', type: 'shinpan', name_ja: '西条松平家' },
  'Takasu Matsudaira Family':      { score: 4, koku: 30000, domain: 'Takasu', domain_ja: '高須', type: 'shinpan', name_ja: '高須松平家' },
  'Hisamatsu Matsudaira Family':   { score: 4, type: 'shinpan', name_ja: '久松松平家' },
  'Honda Family':                  { score: 4, koku: 100000, domain: 'various', domain_ja: '諸藩', type: 'fudai', name_ja: '本多家' },
  'Inaba Family':                  { score: 4, type: 'fudai', name_ja: '稲葉家' },
  'Makino Family':                 { score: 4, type: 'fudai', name_ja: '牧野家' },
  'Yanagisawa Family':             { score: 4, type: 'fudai', name_ja: '柳沢家' },
  'Naito Family':                  { score: 4, type: 'fudai', name_ja: '内藤家' },
  'Okudaira Family':               { score: 4, type: 'fudai', name_ja: '奥平家' },
  'Okubo Family':                  { score: 4, type: 'fudai', name_ja: '大久保家' },
  'Tsuchiya Family':               { score: 4, type: 'fudai', name_ja: '土屋家' },
  'Mizuno Family':                 { score: 4, type: 'fudai', name_ja: '水野家' },
  'Naruse Family':                 { score: 4, koku: 35000, domain: 'Inuyama', domain_ja: '犬山', type: 'fudai', name_ja: '成瀬家' },
  'Tachibana Family':              { score: 4, koku: 120000, domain: 'Yanagawa', domain_ja: '柳川', type: 'tozama', name_ja: '立花家' },
  'Nanbu Family':                  { score: 4, koku: 200000, domain: 'Morioka', domain_ja: '盛岡', type: 'tozama', name_ja: '南部家' },
  'Tsugaru Family':                { score: 4, koku: 100000, domain: 'Hirosaki', domain_ja: '弘前', type: 'tozama', name_ja: '津軽家' },
  'Sanada Family':                 { score: 4, koku: 100000, domain: 'Matsushiro', domain_ja: '松代', type: 'tozama', name_ja: '真田家' },
  'Hojo Family':                   { score: 4, type: 'tozama', name_ja: '北条家' },
  'Kyogoku Family':                { score: 4, type: 'tozama', name_ja: '京極家' },
  'Akimoto Family':                { score: 4, type: 'fudai', name_ja: '秋元家' },
  'Kamei Family':                  { score: 4, type: 'tozama', name_ja: '亀井家' },
  'Takeda Family':                 { score: 4, type: 'tozama', name_ja: '武田家' },
  'Konoe Family':                  { score: 4, type: 'court', name_ja: '近衛家' },
  // Score 3.5 — Zaibatsu / Major Merchants (own tier, unscored)
  'Iwasaki Family':                { score: 3.5, type: 'zaibatsu', name_ja: '岩崎家' },  // Mitsubishi
  'Mitsui Family':                 { score: 3.5, type: 'zaibatsu', name_ja: '三井家' },
  'Sumitomo Family':               { score: 3.5, type: 'zaibatsu', name_ja: '住友家' },
  'Konoike Family':                { score: 3.5, type: 'merchant', name_ja: '鴻池家' },  // Major Osaka merchant

  // Score 3 — Institutions & Shrines (own tier, unscored)
  'Seikado Bunko':                 { score: 3, type: 'institution', name_ja: '静嘉堂文庫' },
  'Eisei Bunko':                   { score: 3, type: 'institution', name_ja: '永青文庫' },
  'Nezu Museum':                   { score: 3, type: 'institution', name_ja: '根津美術館' },
  'Sano Art Museum':               { score: 3, type: 'institution', name_ja: '佐野美術館' },
  'Kurokawa Institute':            { score: 3, type: 'institution', name_ja: '黒川古文化研究所' },
  'Tokugawa Reimeikai Foundation': { score: 3, type: 'institution', name_ja: '徳川黎明会' },
  'Kasuga Taisha':                 { score: 3, type: 'shrine', name_ja: '春日大社' },
  'Atsuta Shrine':                 { score: 3, type: 'shrine', name_ja: '熱田神宮' },
  'Tanzan Shrine':                 { score: 3, type: 'shrine', name_ja: '談山神社' },
  'Yasukuni Shrine':               { score: 3, type: 'shrine', name_ja: '靖国神社' },
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

/** Format koku for display. EN: "1,025,000", JA: "102.5" (displayed as "102.5万石" via i18n key) */
export function formatKoku(koku: number, locale?: string): string {
  if (locale === 'ja') {
    const man = koku / 10000;
    return man % 1 === 0 ? man.toFixed(0) : man.toFixed(1);
  }
  return koku.toLocaleString('en-US');
}

// ─── TIER DEFINITIONS ──────────────────────────────────────────────────────

export const PROVENANCE_TIERS = [
  { key: 'imperial',    label: 'Imperial',          labelKey: 'provenance.imperial',        score: 10,  indent: 0, scored: true },
  { key: 'shogunal',    label: 'Shogunal',          labelKey: 'provenance.shogunal',        score: 9,   indent: 0, scored: true },
  { key: 'premier',     label: 'Premier Daimyō',    labelKey: 'provenance.premierDaimyo',   score: 8,   indent: 1, scored: true },
  { key: 'major',       label: 'Major Daimyō',      labelKey: 'provenance.majorDaimyo',     score: 6,   indent: 2, scored: true },
  { key: 'mid',         label: 'Other Daimyō',      labelKey: 'provenance.otherDaimyo',     score: 4,   indent: 3, scored: false },
  { key: 'zaibatsu',    label: 'Zaibatsu',          labelKey: 'provenance.zaibatsu',        score: 3.5, indent: 3, scored: false },
  { key: 'institution', label: 'Institutions',       labelKey: 'provenance.institutions',    score: 3,   indent: 3, scored: false },
  { key: 'minor',       label: 'Named Collectors',   labelKey: 'provenance.namedCollectors', score: 2,   indent: 3, scored: false },
] as const;

export type TierKey = typeof PROVENANCE_TIERS[number]['key'];

export interface TierCollector {
  name: string;
  name_ja: string | null;
  works: number;
  meta: CollectorMeta;
  children?: Array<{ name: string; name_ja: string | null; works: number }>;
  isGroup: boolean;
}

export interface ProvenanceTierData {
  key: TierKey;
  labelKey: string;
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

/** Bayesian prior constants — V4: weighted average of ALL observations */
const PRIOR_STRENGTH = 20;  // phantom observations (heavier than elite_factor's effective C=10)
const PRIOR_MEAN = 2;       // Named Collector baseline = population mean

function scoreToTier(score: number): TierKey {
  if (score >= 10)  return 'imperial';
  if (score >= 9)   return 'shogunal';
  if (score >= 8)   return 'premier';
  if (score >= 6)   return 'major';
  if (score >= 4)   return 'mid';
  if (score >= 3.5) return 'zaibatsu';
  if (score >= 3)   return 'institution';
  return 'minor';
}

/**
 * Compute provenance analysis from denraiGrouped data.
 * Uses mock prestige scores — will be replaced by DB-backed scores.
 */
export function computeProvenanceAnalysis(
  denraiGrouped: Array<{
    parent: string;
    parent_ja: string | null;
    totalCount: number;
    children: Array<{ owner: string; owner_ja: string | null; count: number }>;
    isGroup: boolean;
  }>
): ProvenanceAnalysis | null {
  if (!denraiGrouped || denraiGrouped.length === 0) return null;

  // Build tier buckets
  const tierMap: Record<TierKey, TierCollector[]> = {
    imperial: [], shogunal: [], premier: [], major: [], mid: [], zaibatsu: [], institution: [], minor: [],
  };
  const tierCounts: Record<TierKey, number> = {
    imperial: 0, shogunal: 0, premier: 0, major: 0, mid: 0, zaibatsu: 0, institution: 0, minor: 0,
  };

  // V4: ALL observations contribute to the weighted average
  let totalObservations = 0;  // every owner-item pair
  let weightedSum = 0;        // Σ(prestige_score × count)
  let totalWorks = 0;         // all tiers (for display — same as totalObservations in grouped view)
  let apex = 0;

  for (const group of denraiGrouped) {
    const parentMeta = getPrestigeScore(group.parent);
    const tierKey = scoreToTier(parentMeta.score);

    tierMap[tierKey].push({
      name: group.parent,
      name_ja: group.parent_ja,
      works: group.totalCount,
      meta: parentMeta,
      children: group.isGroup
        ? group.children.map(c => ({ name: c.owner, name_ja: c.owner_ja, works: c.count }))
        : undefined,
      isGroup: group.isGroup,
    });

    tierCounts[tierKey] += group.totalCount;
    totalWorks += group.totalCount;

    // V4: every observation counts — weighted by prestige score
    totalObservations += group.totalCount;
    weightedSum += parentMeta.score * group.totalCount;
    apex = Math.max(apex, parentMeta.score);
  }

  if (totalWorks === 0) return null;

  // V4 Bayesian smoothed weighted average over ALL observations
  // (C × m + Σ(prestige_score × count)) / (C + Σ(count))
  const factor = (PRIOR_STRENGTH * PRIOR_MEAN + weightedSum) / (PRIOR_STRENGTH + totalObservations);

  // Build tier data, sorted by score descending, collectors by works descending
  const tiers: ProvenanceTierData[] = PROVENANCE_TIERS.map(t => ({
    key: t.key,
    labelKey: t.labelKey,
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
