'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { CreateAlertModal } from '@/components/alerts/CreateAlertModal';
import { LoginModal } from '@/components/auth/LoginModal';
import { InquiryModal } from '@/components/inquiry/InquiryModal';
import { useAlerts } from '@/hooks/useAlerts';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAllImages } from '@/lib/images';
import { useValidatedImages } from '@/hooks/useValidatedImages';
import { shouldShowNewBadge } from '@/lib/newListing';
import { getAttributionName, getAttributionSchool } from '@/lib/listing/attribution';
import { SetsumeiZufuBadge } from '@/components/ui/SetsumeiZufuBadge';
import { AdminSetsumeiWidget } from '@/components/listing/AdminSetsumeiWidget';
import { useActivityTrackerOptional } from '@/lib/tracking/ActivityTracker';
import { trackListingView, getViewReferrer } from '@/lib/tracking/viewTracker';
import { getSessionId } from '@/lib/activity/sessionManager';
import type { Listing, CreateAlertInput } from '@/types';
import { isSetsumeiEligibleCert } from '@/types';
import type { EnrichedListingDetail } from '@/lib/listing/getListingDetail';
import { getValidatedCertInfo } from '@/lib/cert/validation';
import { getItemTypeUrl, getCertUrl, getDealerUrl } from '@/lib/seo/categories';
import { generateArtisanSlug } from '@/lib/artisan/slugs';

// Use EnrichedListingDetail as the canonical listing type for this page
type ListingDetail = EnrichedListingDetail;

interface ListingDetailPageProps {
  initialData?: EnrichedListingDetail | null;
}

// CERT_LABELS and defense-in-depth logic in src/lib/cert/validation.ts

// Item type labels
const ITEM_TYPE_LABELS: Record<string, string> = {
  katana: 'Katana',
  wakizashi: 'Wakizashi',
  tanto: 'Tanto',
  tachi: 'Tachi',
  naginata: 'Naginata',
  yari: 'Yari',
  tsuba: 'Tsuba',
  'fuchi-kashira': 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
};

export default function ListingDetailPage({ initialData }: ListingDetailPageProps) {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;
  const { user, isAdmin } = useAuth();

  const [listing, setListing] = useState<ListingDetail | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { createAlert, isCreating } = useAlerts({ autoFetch: false });
  const activity = useActivityTrackerOptional();
  const viewStartTime = useRef<number>(Date.now());

  // Track listing view when page loads and dwell time when leaving
  useEffect(() => {
    if (!listing || !listingId) return;

    viewStartTime.current = Date.now();

    // Track view to dedicated listing_views table for analytics (skip admins)
    if (!isAdmin) {
      const sessionId = getSessionId();
      trackListingView(Number(listingId), sessionId, user?.id, getViewReferrer());
    }

    // Track dwell time when user leaves the page
    return () => {
      const dwellMs = Date.now() - viewStartTime.current;
      if (dwellMs > 1000 && activity) {
        // Track as viewport_dwell for consistency with browse page tracking
        activity.trackViewportDwell(Number(listingId), dwellMs);
      }
    };
  }, [listing, listingId, activity, user?.id]);

  // Track external link click
  const handleExternalLinkClick = useCallback(() => {
    if (activity && listing) {
      activity.trackExternalLinkClick(
        listing.url,
        Number(listingId),
        listing.dealers?.name
      );
    }
  }, [activity, listing, listingId]);

  // Validate images - hook must be called unconditionally before any early returns
  const rawImages = listing ? getAllImages(listing) : [];
  const { validatedImages } = useValidatedImages(rawImages);

  // Reset selectedImageIndex if it's out of bounds after images are filtered
  useEffect(() => {
    if (validatedImages.length > 0 && selectedImageIndex >= validatedImages.length) {
      setSelectedImageIndex(0);
    }
  }, [validatedImages.length, selectedImageIndex]);

  // Fetch listing data via API route — skip when server-rendered initialData is available
  useEffect(() => {
    if (initialData) return;

    const fetchListing = async () => {
      if (!listingId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/listing/${listingId}?nocache=1`, { cache: 'no-store' });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load listing');
        }

        const data = await response.json();

        if (!data.listing) {
          throw new Error('Listing not found');
        }

        setListing(data.listing as ListingDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listing');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [listingId, initialData]);

  const handleCreateAlert = useCallback(async (input: CreateAlertInput): Promise<boolean> => {
    const result = await createAlert(input);
    return !!result;
  }, [createAlert]);

  const handleSetAlert = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setIsAlertModalOpen(true);
  };

  const handleInquire = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setIsInquiryModalOpen(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream transition-colors">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !listing) {
    return (
      <div className="min-h-screen bg-cream transition-colors">
        <Header />
        <main className="max-w-[1200px] mx-auto px-4 py-8 lg:px-6 lg:py-12">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="font-serif text-xl text-ink mb-2">Listing not found</h2>
            <p className="text-[14px] text-muted mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
            >
              Back to Collection
            </button>
          </div>
        </main>
        <BottomTabBar activeFilterCount={0} />
      </div>
    );
  }

  const isSold = listing.is_sold || listing.status === 'sold' || listing.status === 'presumed_sold';
  const itemType = listing.item_type ? (ITEM_TYPE_LABELS[listing.item_type.toLowerCase()] || listing.item_type) : null;
  const certInfo = getValidatedCertInfo(listing);
  const images = validatedImages; // Use validated images (filtered for minimum dimensions)

  // Pre-compute entity URLs for internal linking (avoids IIFEs in JSX)
  const certUrl = listing.cert_type ? getCertUrl(listing.cert_type) : null;
  const typeUrl = listing.item_type ? getItemTypeUrl(listing.item_type) : null;
  const certBadgeClass = certInfo ? `text-[11px] uppercase tracking-wider font-medium px-2.5 py-1 rounded ${
    certInfo.tier === 'tokuju' ? 'bg-tokuju-bg text-tokuju'
    : certInfo.tier === 'jubi' ? 'bg-jubi-bg text-jubi'
    : certInfo.tier === 'juyo' ? 'bg-juyo-bg text-juyo'
    : certInfo.tier === 'tokuho' ? 'bg-toku-hozon-bg text-toku-hozon'
    : 'bg-hozon-bg text-hozon'
  }` : '';

  // Artisan and school from listing data
  const artisan = getAttributionName(listing);
  const school = getAttributionSchool(listing);

  return (
    <div className="min-h-screen bg-cream transition-colors">
      <Header />

      <main className="max-w-[1200px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        <Breadcrumbs items={[
          { name: 'Browse', url: '/' },
          ...(itemType ? [{ name: itemType, url: (listing.item_type ? getItemTypeUrl(listing.item_type) : null) || `/?type=${listing.item_type}` }] : []),
          { name: listing.title },
        ]} />

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div>
            {/* Main Image */}
            <div className="relative aspect-[4/3] bg-linen rounded-lg overflow-hidden mb-4">
              {images.length > 0 ? (
                <Image
                  src={images[selectedImageIndex]}
                  alt={listing.title}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Sold Overlay */}
              {isSold && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="px-4 py-2 bg-black/70 text-white text-[12px] uppercase tracking-widest font-medium rounded">
                    Sold
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden ${
                      index === selectedImageIndex
                        ? 'ring-2 ring-gold'
                        : 'ring-1 ring-border hover:ring-gold/50'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${listing.title} - Photo ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            {/* Status & Certification */}
            <div className="flex items-center flex-wrap gap-3 mb-4">
              {certInfo && certUrl ? (
                <Link href={certUrl} className={certBadgeClass}>{certInfo.label}</Link>
              ) : certInfo ? (
                <span className={certBadgeClass}>{certInfo.label}</span>
              ) : null}
              {listing.setsumei_text_en && isSetsumeiEligibleCert(listing.cert_type) && (
                <SetsumeiZufuBadge />
              )}
              {shouldShowNewBadge(listing.first_seen_at, listing.dealer_earliest_seen_at, listing.is_initial_import) && (
                <span className="text-[11px] uppercase tracking-wider font-medium px-2.5 py-1 rounded bg-new-listing-bg text-new-listing">
                  New this week
                </span>
              )}
              {isSold && (
                <span className="text-[11px] uppercase tracking-wider font-medium px-2.5 py-1 rounded bg-muted/10 text-muted">
                  Sold
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-serif text-2xl lg:text-3xl text-ink mb-2">
              {listing.title}
            </h1>

            {/* Item Type */}
            {itemType && (
              <p className="text-[14px] text-charcoal mb-4">
                {typeUrl ? (
                  <Link href={typeUrl} className="hover:text-gold transition-colors">
                    {itemType}
                  </Link>
                ) : itemType}
              </p>
            )}

            {/* Price */}
            <div className="mb-6 pb-6 border-b border-border">
              {isSold && listing.price_value && (
                <p className="text-[11px] uppercase tracking-wider text-muted mb-1">
                  Sold price
                </p>
              )}
              {listing.price_value ? (
                <p className={`text-2xl lg:text-3xl font-semibold tabular-nums ${isSold ? 'text-muted' : 'text-ink'}`}>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: listing.price_currency || 'JPY',
                    maximumFractionDigits: 0,
                  }).format(listing.price_value)}
                </p>
              ) : (
                <p className="text-xl text-muted">Price on request</p>
              )}
            </div>

            {/* Artisan & School */}
            {(artisan || school) && (
              <div className="mb-6">
                {artisan && (
                  <div className="mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted">
                      {listing.smith ? 'Smith' : 'Maker'}
                    </span>
                    <p className="text-[15px] text-ink font-medium">
                      {listing.artisan_id && listing.artisan_display_name ? (
                        <Link
                          href={`/artists/${generateArtisanSlug(listing.artisan_display_name, listing.artisan_id)}`}
                          className="hover:text-gold transition-colors"
                        >
                          {artisan}
                        </Link>
                      ) : artisan}
                    </p>
                  </div>
                )}
                {school && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-muted">School</span>
                    <p className="text-[15px] text-ink font-medium">
                      <Link href={`/artists?school=${encodeURIComponent(school)}`} className="hover:text-gold transition-colors">
                        {school}
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Specifications */}
            {(listing.nagasa_cm || listing.sori_cm || listing.motohaba_cm) && (
              <div className="mb-6 pb-6 border-b border-border">
                <h3 className="text-[11px] uppercase tracking-wider text-muted mb-3">
                  Specifications
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {listing.nagasa_cm && (
                    <div>
                      <span className="text-[12px] text-muted">Nagasa</span>
                      <p className="text-[14px] text-ink">{listing.nagasa_cm} cm</p>
                    </div>
                  )}
                  {listing.sori_cm && (
                    <div>
                      <span className="text-[12px] text-muted">Sori</span>
                      <p className="text-[14px] text-ink">{listing.sori_cm} cm</p>
                    </div>
                  )}
                  {listing.motohaba_cm && (
                    <div>
                      <span className="text-[12px] text-muted">Motohaba</span>
                      <p className="text-[14px] text-ink">{listing.motohaba_cm} cm</p>
                    </div>
                  )}
                  {listing.sakihaba_cm && (
                    <div>
                      <span className="text-[12px] text-muted">Sakihaba</span>
                      <p className="text-[14px] text-ink">{listing.sakihaba_cm} cm</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Admin: Manual Yuhinkai Connection Widget */}
            {isAdmin && (
              <AdminSetsumeiWidget
                listing={listing as unknown as Listing}
                onConnectionChanged={() => {
                  // Refetch listing to show updated enrichment (bypass edge cache)
                  fetch(`/api/listing/${listingId}?nocache=1`, { cache: 'no-store' })
                    .then(res => res.json())
                    .then(data => {
                      if (data.listing) {
                        setListing(data.listing as ListingDetail);
                      }
                    })
                    .catch(console.error);
                }}
              />
            )}

            {/* Dealer */}
            <div className="mb-6 pb-6 border-b border-border">
              <span className="text-[11px] uppercase tracking-wider text-muted">Dealer</span>
              <p className="text-[15px] text-ink font-medium">
                {listing.dealers?.name ? (
                  <Link href={getDealerUrl(listing.dealers.name)} className="hover:text-gold transition-colors">
                    {listing.dealers.name}
                  </Link>
                ) : 'Unknown Dealer'}
              </p>
              <p className="text-[12px] text-muted">{listing.dealers?.domain}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {isSold ? (
                <>
                  {/* View Similar Items — primary CTA for sold listings */}
                  <Link
                    href={
                      listing.cert_type && listing.item_type
                        ? `/?type=${listing.item_type}&cert=${listing.cert_type}`
                        : listing.item_type
                          ? `/?type=${listing.item_type}`
                          : '/'
                    }
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
                  >
                    View Similar Items
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                  {/* Secondary: View on dealer site (may still exist) */}
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={handleExternalLinkClick}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-medium text-charcoal bg-paper border border-border hover:border-gold hover:text-gold rounded-lg transition-colors"
                  >
                    View on {listing.dealers?.name}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </>
              ) : (
                <>
                  {/* View on Dealer Site */}
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    onClick={handleExternalLinkClick}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
                  >
                    View on {listing.dealers?.name}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  {/* Inquire Button */}
                  <button
                    onClick={handleInquire}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-medium text-charcoal bg-paper border border-border hover:border-gold hover:text-gold rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Inquire
                  </button>

                  {/* Set Alert Button */}
                  <button
                    onClick={handleSetAlert}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-medium text-charcoal bg-paper border border-border hover:border-gold hover:text-gold rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Set Alert
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Create Alert Modal */}
      <CreateAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        onSubmit={handleCreateAlert}
        isSubmitting={isCreating}
        listing={listing as unknown as Listing}
      />

      {/* Inquiry Modal */}
      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        listing={listing as unknown as Listing}
      />

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      <Footer />
      <BottomTabBar activeFilterCount={0} />
    </div>
  );
}
