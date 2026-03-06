import { describe, it, expect } from 'vitest';
import { computeProfileCompleteness } from '@/lib/dealer/profileCompleteness';
import type { Dealer } from '@/types';

function makeDealer(overrides: Partial<Dealer> = {}): Partial<Dealer> {
  return { ...overrides };
}

describe('computeProfileCompleteness', () => {
  it('returns 0 for an empty dealer', () => {
    const result = computeProfileCompleteness(makeDealer());
    expect(result.score).toBe(0);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('returns 100 for a fully complete dealer', () => {
    const result = computeProfileCompleteness(makeDealer({
      logo_url: 'https://example.com/logo.jpg',
      banner_url: 'https://example.com/banner.jpg',
      bio_en: 'We specialize in koto swords.',
      bio_ja: '古刀を専門としています。',
      contact_email: 'info@example.com',
      phone: '+81-3-1234-5678',
      founded_year: 1985,
      city: 'Tokyo',
      specializations: ['nihonto', 'tosogu'],
      return_policy: '7-day returns accepted.',
      accepts_wire_transfer: true,
      is_nbthk_member: true,
    }));
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it('awards 15 points for logo', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withLogo = computeProfileCompleteness(makeDealer({ logo_url: 'https://example.com/logo.jpg' }));
    expect(withLogo.score - without.score).toBe(15);
  });

  it('awards 15 points for banner', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withBanner = computeProfileCompleteness(makeDealer({ banner_url: 'https://example.com/banner.jpg' }));
    expect(withBanner.score - without.score).toBe(15);
  });

  it('awards 15 points for single-language bio', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withBio = computeProfileCompleteness(makeDealer({ bio_en: 'About us' }));
    expect(withBio.score - without.score).toBe(15);
  });

  it('awards 5 bonus points for bilingual bio', () => {
    const enOnly = computeProfileCompleteness(makeDealer({ bio_en: 'About us' }));
    const bilingual = computeProfileCompleteness(makeDealer({ bio_en: 'About us', bio_ja: '私たちについて' }));
    expect(bilingual.score - enOnly.score).toBe(5);
  });

  it('awards 10 points for contact email', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withEmail = computeProfileCompleteness(makeDealer({ contact_email: 'test@example.com' }));
    expect(withEmail.score - without.score).toBe(10);
  });

  it('awards 10 points for phone', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withPhone = computeProfileCompleteness(makeDealer({ phone: '+81-3-1234-5678' }));
    expect(withPhone.score - without.score).toBe(10);
  });

  it('awards 10 points for LINE ID (alternative to phone)', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withLine = computeProfileCompleteness(makeDealer({ line_id: '@myshop' }));
    expect(withLine.score - without.score).toBe(10);
  });

  it('does not double-count phone and LINE', () => {
    const phoneOnly = computeProfileCompleteness(makeDealer({ phone: '123' }));
    const both = computeProfileCompleteness(makeDealer({ phone: '123', line_id: '@shop' }));
    expect(both.score).toBe(phoneOnly.score);
  });

  it('awards 5 points for founded_year', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withYear = computeProfileCompleteness(makeDealer({ founded_year: 1990 }));
    expect(withYear.score - without.score).toBe(5);
  });

  it('awards 5 points for city', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withCity = computeProfileCompleteness(makeDealer({ city: 'Tokyo' }));
    expect(withCity.score - without.score).toBe(5);
  });

  it('awards 5 points for specializations', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withSpecs = computeProfileCompleteness(makeDealer({ specializations: ['nihonto'] }));
    expect(withSpecs.score - without.score).toBe(5);
  });

  it('does not award points for empty specializations array', () => {
    const empty = computeProfileCompleteness(makeDealer({ specializations: [] }));
    const none = computeProfileCompleteness(makeDealer());
    expect(empty.score).toBe(none.score);
  });

  it('awards 5 points for return_policy', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withPolicy = computeProfileCompleteness(makeDealer({ return_policy: '7-day returns' }));
    expect(withPolicy.score - without.score).toBe(5);
  });

  it('awards 5 points for any payment method', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withPaypal = computeProfileCompleteness(makeDealer({ accepts_paypal: true }));
    expect(withPaypal.score - without.score).toBe(5);
  });

  it('missing list includes logo, banner, bio, and contact prompts for empty dealer', () => {
    const result = computeProfileCompleteness(makeDealer());
    expect(result.missing).toContain('dealer.addLogoPrompt');
    expect(result.missing).toContain('dealer.addBannerPrompt');
    expect(result.missing).toContain('dealer.addBioPrompt');
    expect(result.missing).toContain('dealer.addContactPrompt');
  });

  it('handles whitespace-only bio as empty', () => {
    const result = computeProfileCompleteness(makeDealer({ bio_en: '   ' }));
    expect(result.missing).toContain('dealer.addBioPrompt');
  });

  it('awards 5 points for any credential boolean', () => {
    const without = computeProfileCompleteness(makeDealer());
    const withNbthk = computeProfileCompleteness(makeDealer({ is_nbthk_member: true }));
    expect(withNbthk.score - without.score).toBe(5);

    const withZentosho = computeProfileCompleteness(makeDealer({ is_zentosho_member: true }));
    expect(withZentosho.score - without.score).toBe(5);

    const withKobutsusho = computeProfileCompleteness(makeDealer({ has_kobutsusho_license: true }));
    expect(withKobutsusho.score - without.score).toBe(5);
  });

  it('does not double-count multiple credential booleans', () => {
    const one = computeProfileCompleteness(makeDealer({ is_nbthk_member: true }));
    const all = computeProfileCompleteness(makeDealer({ is_nbthk_member: true, is_zentosho_member: true, has_kobutsusho_license: true }));
    expect(all.score).toBe(one.score);
  });

  it('caps score at 100', () => {
    const result = computeProfileCompleteness(makeDealer({
      logo_url: 'logo', banner_url: 'banner',
      bio_en: 'en', bio_ja: 'ja',
      contact_email: 'e@e.com', phone: '123', line_id: '@l',
      founded_year: 2000, city: 'NYC',
      specializations: ['nihonto'], return_policy: 'ok',
      accepts_wire_transfer: true, accepts_paypal: true, accepts_credit_card: true,
      is_nbthk_member: true,
    }));
    expect(result.score).toBe(100);
  });
});
