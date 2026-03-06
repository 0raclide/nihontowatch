import type { Dealer } from '@/types';

interface CompletenessResult {
  score: number;
  missing: string[];
}

/**
 * Compute how complete a dealer's profile is.
 * Returns a score 0-100 and a list of missing items (i18n keys).
 */
export function computeProfileCompleteness(dealer: Partial<Dealer>): CompletenessResult {
  let score = 0;
  const missing: string[] = [];

  // Logo — 15 points
  if (dealer.logo_url) {
    score += 15;
  } else {
    missing.push('dealer.addLogoPrompt');
  }

  // Banner — 15 points
  if (dealer.banner_url) {
    score += 15;
  } else {
    missing.push('dealer.addBannerPrompt');
  }

  // Bio — 15 points (+ 5 bilingual bonus)
  const hasBioEn = !!dealer.bio_en?.trim();
  const hasBioJa = !!dealer.bio_ja?.trim();
  if (hasBioEn || hasBioJa) {
    score += 15;
    if (hasBioEn && hasBioJa) {
      score += 5;
    }
  } else {
    missing.push('dealer.addBioPrompt');
  }

  // Contact email — 10 points
  if (dealer.contact_email) {
    score += 10;
  } else {
    missing.push('dealer.addContactPrompt');
  }

  // Phone or LINE — 10 points
  if (dealer.phone || dealer.line_id) {
    score += 10;
  }

  // Founded year — 5 points
  if (dealer.founded_year) {
    score += 5;
  }

  // City — 5 points
  if (dealer.city?.trim()) {
    score += 5;
  }

  // Specializations — 5 points
  if (dealer.specializations && dealer.specializations.length > 0) {
    score += 5;
  }

  // Return policy — 5 points
  if (dealer.return_policy?.trim()) {
    score += 5;
  }

  // Payment methods — 5 points (any of the 3)
  if (dealer.accepts_wire_transfer || dealer.accepts_paypal || dealer.accepts_credit_card) {
    score += 5;
  }

  // Memberships — 5 points
  if (dealer.memberships && dealer.memberships.length > 0) {
    score += 5;
  }

  return { score: Math.min(score, 100), missing };
}
