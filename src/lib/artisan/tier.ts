/**
 * Artisan tier classification based on certification counts.
 *
 * Highest tier wins: kokuho > elite > juyo > null
 */

export type ArtisanTier = 'kokuho' | 'elite' | 'juyo' | null;

export interface ArtisanCounts {
  kokuho_count: number;
  jubun_count: number;
  jubi_count: number;
  gyobutsu_count: number;
  tokuju_count: number;
  juyo_count: number;
}

export function getArtisanTier(counts: ArtisanCounts): ArtisanTier {
  if (counts.kokuho_count > 0) return 'kokuho';
  if (counts.tokuju_count > 0 || counts.jubun_count > 0 || counts.jubi_count > 0 || counts.gyobutsu_count > 0) return 'elite';
  if (counts.juyo_count > 0) return 'juyo';
  return null;
}
