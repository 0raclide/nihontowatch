/**
 * Format a timestamp as relative time (e.g. "3h ago" / "3時間前").
 * Uses i18n keys: card.justNow, card.minutesAgo, card.hoursAgo, card.daysAgo
 */
export function formatRelativeTime(
  isoDate: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 0) return t('card.justNow'); // future date → treat as "just now"
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return t('card.justNow');
  if (diffMin < 60) return t('card.minutesAgo', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('card.hoursAgo', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  return t('card.daysAgo', { n: diffD });
}
