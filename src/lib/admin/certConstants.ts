// Shared cert constants for admin pill row (used by CertPillRow, AdminEditView, ArtisanTooltip)

export const CERT_OPTIONS: { value: string | null; label: string; tier: string }[] = [
  { value: 'Tokuju', label: 'Tokuju', tier: 'tokuju' },
  { value: 'Juyo', label: 'Jūyō', tier: 'juyo' },
  { value: 'TokuHozon', label: 'Tokuho', tier: 'tokuho' },
  { value: 'Hozon', label: 'Hozon', tier: 'hozon' },
  { value: 'juyo_bijutsuhin', label: 'Jubi', tier: 'jubi' },
  { value: 'TokuKicho', label: 'TokuKichō', tier: 'tokuho' },
  { value: null, label: 'None', tier: 'none' },
];

export const CERT_TIER_COLORS: Record<string, string> = {
  tokuju: 'bg-tokuju/20 text-tokuju ring-tokuju/50',
  jubi: 'bg-jubi/20 text-jubi ring-jubi/50',
  juyo: 'bg-juyo/20 text-juyo ring-juyo/50',
  tokuho: 'bg-toku-hozon/20 text-toku-hozon ring-toku-hozon/50',
  hozon: 'bg-hozon/20 text-hozon ring-hozon/50',
  none: 'bg-muted/20 text-muted ring-muted/50',
};

// Normalize cert_type from DB to the canonical value used in CERT_OPTIONS
export function normalizeCertValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    tokubetsu_juyo: 'Tokuju', tokuju: 'Tokuju', Tokuju: 'Tokuju',
    juyo: 'Juyo', Juyo: 'Juyo',
    tokubetsu_hozon: 'TokuHozon', TokuHozon: 'TokuHozon',
    hozon: 'Hozon', Hozon: 'Hozon',
    juyo_bijutsuhin: 'juyo_bijutsuhin', JuyoBijutsuhin: 'juyo_bijutsuhin', 'Juyo Bijutsuhin': 'juyo_bijutsuhin',
    TokuKicho: 'TokuKicho',
    nbthk: 'Hozon', nthk: 'Hozon',
  };
  return map[raw] ?? raw;
}
