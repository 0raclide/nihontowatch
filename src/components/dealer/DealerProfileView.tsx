'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { useCurrency } from '@/hooks/useCurrency';
import { getDealerDisplayName } from '@/lib/dealers/displayName';
import { getCountryFlag, getCountryFromDomain, formatItemType } from '@/lib/dealers/utils';
import { ListingCard } from '@/components/browse/ListingCard';
import { listingToDisplayItem } from '@/lib/displayItem';
import { SPECIALIZATIONS } from '@/lib/dealer/specializations';
import type { Dealer, Listing } from '@/types';

interface DealerProfileViewProps {
  dealer: Dealer;
  stats: { totalListings: number; typeCounts: { type: string; count: number }[] };
  featuredListings: Listing[];
}

export function DealerProfileView({ dealer, stats, featuredListings }: DealerProfileViewProps) {
  const { t, locale } = useLocale();
  const { currency, exchangeRates } = useCurrency();
  const [showBioTranslation, setShowBioTranslation] = useState(false);

  const country = dealer.country || getCountryFromDomain(dealer.domain);
  const flag = getCountryFlag(country);
  const displayName = getDealerDisplayName(dealer, locale);

  // Bio logic: show locale-appropriate bio by default, toggle for translation
  const hasBioEn = !!dealer.bio_en?.trim();
  const hasBioJa = !!dealer.bio_ja?.trim();
  const hasBothBios = hasBioEn && hasBioJa;
  const primaryBio = locale === 'ja' ? (hasBioJa ? dealer.bio_ja : dealer.bio_en) : (hasBioEn ? dealer.bio_en : dealer.bio_ja);
  const secondaryBio = locale === 'ja' ? dealer.bio_en : dealer.bio_ja;

  const hasCredentials = dealer.is_nbthk_member || dealer.is_zentosho_member || dealer.has_kobutsusho_license;
  const hasContact = dealer.contact_email || dealer.phone || dealer.line_id || dealer.instagram_url || dealer.domain;
  const hasAddress = dealer.address_visible && dealer.city;
  const hasPolicies = dealer.ships_international !== null || dealer.english_support !== null ||
    dealer.accepts_wire_transfer || dealer.accepts_paypal || dealer.accepts_credit_card || dealer.return_policy?.trim();
  const hasSpecs = dealer.specializations && dealer.specializations.length > 0;

  const displayItems = featuredListings.map(l => listingToDisplayItem(l as any, locale));

  return (
    <div className="space-y-0">
      {/* Hero: Banner + Logo + Name */}
      <div className="relative">
        {/* Banner */}
        <div className="w-full aspect-[16/9] max-h-[280px] bg-gradient-to-br from-surface-elevated to-border/30 overflow-hidden">
          {dealer.banner_url && (
            <Image
              src={dealer.banner_url}
              alt=""
              fill
              className="object-cover"
              priority
            />
          )}
        </div>

        {/* Logo + Name */}
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-end gap-4 -mt-10 relative z-10">
            {dealer.logo_url ? (
              <div className="w-20 h-20 rounded-xl overflow-hidden border-4 border-surface shadow-lg bg-surface flex-shrink-0">
                <Image
                  src={dealer.logo_url}
                  alt={displayName}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl border-4 border-surface shadow-lg bg-surface-elevated flex-shrink-0 flex items-center justify-center">
                <span className="text-2xl font-serif text-muted">{displayName.charAt(0)}</span>
              </div>
            )}
            <div className="pb-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl md:text-3xl text-ink truncate">{displayName}</h1>
                <span className="text-2xl flex-shrink-0" title={country}>{flag}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {dealer.founded_year && (
                  <span className="text-[13px] text-muted">{t('dealer.established')} {dealer.founded_year}</span>
                )}
                <a
                  href={`https://${dealer.domain}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-[13px] text-muted hover:text-gold transition-colors inline-flex items-center gap-1"
                >
                  {dealer.domain}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 pb-12 space-y-8">
        {/* Specializations */}
        {hasSpecs && (
          <div className="flex flex-wrap gap-2">
            {dealer.specializations!.map((value) => {
              const spec = SPECIALIZATIONS.find(s => s.value === value);
              return (
                <span
                  key={value}
                  className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium bg-gold/10 text-gold border border-gold/20"
                >
                  {spec ? t(spec.labelKey) : value}
                </span>
              );
            })}
          </div>
        )}

        {/* About */}
        {primaryBio && (
          <section>
            <SectionHeader label={t('dealer.aboutSection')} />
            <p className="text-[14px] text-ink/80 leading-relaxed whitespace-pre-line">
              {showBioTranslation ? secondaryBio : primaryBio}
            </p>
            {hasBothBios && (
              <button
                onClick={() => setShowBioTranslation(!showBioTranslation)}
                className="mt-2 text-[12px] text-gold hover:text-gold-light transition-colors"
              >
                {showBioTranslation ? t('dealer.showOriginal') : t('dealer.showTranslation')}
              </button>
            )}
          </section>
        )}

        {/* Credentials */}
        {hasCredentials && (
          <section>
            <SectionHeader label={t('dealer.credentialsSection')} />
            <div className="space-y-2">
              {dealer.is_nbthk_member && (
                <CredentialRow label={t('dealer.nbthkMember')} />
              )}
              {dealer.is_zentosho_member && (
                <CredentialRow label={t('dealer.zentoshoMember')} />
              )}
              {dealer.has_kobutsusho_license && (
                <CredentialRow label={t('dealer.kobutsushoLicense')} />
              )}
            </div>
          </section>
        )}

        {/* Inventory */}
        {stats.totalListings > 0 && (
          <section>
            <SectionHeader label={t('dealer.inventorySection')} />
            <div className="bg-cream rounded-lg border border-border p-5">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-[13px] text-muted">{t('dealer.inventorySection')}</span>
                <span className="text-2xl font-serif text-ink tabular-nums">{stats.totalListings.toLocaleString()}</span>
              </div>

              {/* Proportional bar */}
              {stats.typeCounts.length > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden mb-4">
                  {stats.typeCounts.map(({ type, count }, i) => (
                    <div
                      key={type}
                      className="transition-all duration-300"
                      style={{
                        width: `${(count / stats.totalListings) * 100}%`,
                        backgroundColor: `color-mix(in srgb, var(--accent) ${90 - i * 10}%, var(--border))`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Type links */}
              <div className="flex flex-wrap gap-2">
                {stats.typeCounts.map(({ type, count }, i) => (
                  <Link
                    key={type}
                    href={`/?dealer=${dealer.id}&type=${type}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:border-gold/40 hover:bg-surface transition-colors group"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--accent) ${90 - i * 10}%, var(--border))`,
                      }}
                    />
                    <span className="text-[13px] text-ink capitalize group-hover:text-gold transition-colors">
                      {formatItemType(type)}
                    </span>
                    <span className="text-[11px] text-muted tabular-nums">{count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Listings */}
        {displayItems.length > 0 && (
          <section>
            <SectionHeader label={t('dealer.featuredSection')} />
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
              {displayItems.map((item) => (
                <ListingCard
                  key={item.id}
                  listing={item}
                  currency={currency}
                  exchangeRates={exchangeRates}
                  mobileView="grid"
                  fontSize="standard"
                  imageAspect="aspect-[3/4]"
                />
              ))}
            </div>

            {/* Browse all CTA */}
            {stats.totalListings > displayItems.length && (
              <div className="mt-5 text-center">
                <Link
                  href={`/?dealer=${dealer.id}`}
                  className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
                >
                  {t('dealer.browseAllDealerListings', { count: stats.totalListings.toLocaleString() })}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            )}
          </section>
        )}

        {/* Contact */}
        {(hasContact || hasAddress) && (
          <section>
            <SectionHeader label={t('dealer.contactSection')} />
            <div className="space-y-3">
              {dealer.contact_email && (
                <ContactRow
                  icon={<MailIcon />}
                  label={dealer.contact_email}
                  href={`mailto:${dealer.contact_email}`}
                />
              )}
              {dealer.phone && (
                <ContactRow
                  icon={<PhoneIcon />}
                  label={dealer.phone}
                  href={`tel:${dealer.phone}`}
                />
              )}
              {dealer.line_id && (
                <ContactRow icon={<LineIcon />} label={`LINE: ${dealer.line_id}`} />
              )}
              {dealer.instagram_url && (
                <ContactRow
                  icon={<InstagramIcon />}
                  label={extractInstagramHandle(dealer.instagram_url)}
                  href={dealer.instagram_url}
                  external
                />
              )}
              {hasAddress && (
                <ContactRow
                  icon={<LocationIcon />}
                  label={[dealer.city, country].filter(Boolean).join(', ')}
                />
              )}
            </div>
          </section>
        )}

        {/* Policies */}
        {hasPolicies && (
          <section>
            <SectionHeader label={t('dealer.policiesSection')} />
            <div className="space-y-3 text-[14px]">
              {dealer.ships_international !== null && dealer.ships_international !== undefined && (
                <PolicyRow
                  label={t('dealer.shipsInternational')}
                  value={dealer.ships_international ? t('dealer.shipsIntlYes') : t('dealer.shipsIntlNo')}
                  positive={dealer.ships_international}
                />
              )}
              {dealer.english_support !== null && dealer.english_support !== undefined && (
                <PolicyRow
                  label={t('dealer.englishSupport')}
                  value={dealer.english_support ? t('dealer.englishSupportYes') : '—'}
                  positive={dealer.english_support}
                />
              )}
              {(dealer.accepts_wire_transfer || dealer.accepts_paypal || dealer.accepts_credit_card) && (
                <div className="flex items-start gap-3">
                  <span className="text-muted text-[13px] min-w-[120px]">{t('dealer.paymentMethods')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {dealer.accepts_wire_transfer && <PaymentPill label={t('dealer.wireTransfer')} />}
                    {dealer.accepts_paypal && <PaymentPill label="PayPal" />}
                    {dealer.accepts_credit_card && <PaymentPill label="Credit Card" />}
                  </div>
                </div>
              )}
              {dealer.return_policy?.trim() && (
                <div>
                  <span className="text-muted text-[13px] block mb-1">{t('dealer.returnPolicy')}</span>
                  <p className="text-ink/80 text-[13px] whitespace-pre-line">{dealer.return_policy}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Shop Photo */}
        {dealer.shop_photo_url && (
          <section>
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="relative aspect-[4/3]">
                <Image
                  src={dealer.shop_photo_url}
                  alt={`${displayName} shop`}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ──── Sub-components ──── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-4">
      <div className="h-px bg-border/30 mb-4" />
      <h2 className="text-[13px] uppercase tracking-[0.1em] text-ink/50 font-medium">{label}</h2>
    </div>
  );
}

function CredentialRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[14px] text-ink/80">
      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {label}
    </div>
  );
}

function ContactRow({ icon, label, href, external }: { icon: React.ReactNode; label: string; href?: string; external?: boolean }) {
  const content = (
    <div className="flex items-center gap-3 text-[14px] text-ink/80">
      <span className="text-muted flex-shrink-0">{icon}</span>
      <span className={href ? 'hover:text-gold transition-colors' : ''}>{label}</span>
    </div>
  );

  if (href) {
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
        {content}
      </a>
    );
  }
  return content;
}

function PolicyRow({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted text-[13px] min-w-[120px]">{label}</span>
      <span className={`text-[13px] ${positive ? 'text-green-600' : 'text-muted'}`}>{value}</span>
    </div>
  );
}

function PaymentPill({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[11px] text-ink/70">
      {label}
    </span>
  );
}

function extractInstagramHandle(url: string): string {
  try {
    const match = url.match(/instagram\.com\/([^/?]+)/);
    return match ? `@${match[1]}` : url;
  } catch {
    return url;
  }
}

/* ──── SVG Icons ──── */

function MailIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 5.81 2 10.4c0 3.39 2.36 6.32 5.79 7.65l-.72 2.63c-.06.22.18.4.37.28l3.13-2.07c.46.05.93.08 1.43.08 5.52 0 10-3.81 10-8.57C22 5.81 17.52 2 12 2z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="5" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="5" strokeWidth={1.5} />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}
