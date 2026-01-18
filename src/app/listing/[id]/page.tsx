'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { CreateAlertModal } from '@/components/alerts/CreateAlertModal';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAlerts } from '@/hooks/useAlerts';
import { useAuth } from '@/lib/auth/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getAllImages } from '@/lib/images';
import type { Listing, CreateAlertInput } from '@/types';

// Extended listing type for this page
interface ListingDetail extends Listing {
  stored_images?: string[] | null;
  dealers: {
    id: number;
    name: string;
    domain: string;
  };
}

// Certification display config
const CERT_LABELS: Record<string, { label: string; tier: 'tokuju' | 'juyo' | 'tokuho' | 'hozon' }> = {
  // Tokubetsu Juyo - highest tier (purple)
  Tokuju: { label: 'Tokubetsu Juyo', tier: 'tokuju' },
  tokuju: { label: 'Tokubetsu Juyo', tier: 'tokuju' },
  tokubetsu_juyo: { label: 'Tokubetsu Juyo', tier: 'tokuju' },
  // Juyo - high tier (blue)
  Juyo: { label: 'Juyo', tier: 'juyo' },
  juyo: { label: 'Juyo', tier: 'juyo' },
  // Tokubetsu Hozon - mid tier (brown)
  TokuHozon: { label: 'Tokubetsu Hozon', tier: 'tokuho' },
  tokubetsu_hozon: { label: 'Tokubetsu Hozon', tier: 'tokuho' },
  // Hozon - standard tier (yellow)
  Hozon: { label: 'Hozon', tier: 'hozon' },
  hozon: { label: 'Hozon', tier: 'hozon' },
};

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

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;
  const { user } = useAuth();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { createAlert, isCreating } = useAlerts({ autoFetch: false });

  // Fetch listing data
  useEffect(() => {
    const fetchListing = async () => {
      if (!listingId) return;

      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('listings')
          .select(`
            *,
            dealers (
              id,
              name,
              domain
            )
          `)
          .eq('id', parseInt(listingId))
          .single();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (!data) {
          throw new Error('Listing not found');
        }

        setListing(data as ListingDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listing');
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [listingId]);

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
  const certInfo = listing.cert_type ? CERT_LABELS[listing.cert_type] : null;
  const images = getAllImages(listing);
  const artisan = listing.smith || listing.tosogu_maker;
  const school = listing.school || listing.tosogu_school;

  return (
    <div className="min-h-screen bg-cream transition-colors">
      <Header />

      <main className="max-w-[1200px] mx-auto px-4 py-4 lg:px-6 lg:py-8">
        {/* Breadcrumb */}
        <nav className="mb-4 lg:mb-6">
          <ol className="flex items-center gap-2 text-[12px] text-muted">
            <li>
              <Link href="/" className="hover:text-gold transition-colors">
                Collection
              </Link>
            </li>
            <li>/</li>
            <li className="text-charcoal truncate max-w-[200px]">
              {listing.title}
            </li>
          </ol>
        </nav>

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
                      alt={`Image ${index + 1}`}
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
            <div className="flex items-center gap-3 mb-4">
              {certInfo && (
                <span className={`text-[11px] uppercase tracking-wider font-medium px-2.5 py-1 rounded ${
                  certInfo.tier === 'tokuju'
                    ? 'bg-tokuju-bg text-tokuju'
                    : certInfo.tier === 'juyo'
                    ? 'bg-juyo-bg text-juyo'
                    : certInfo.tier === 'tokuho'
                    ? 'bg-toku-hozon-bg text-toku-hozon'
                    : 'bg-hozon-bg text-hozon'
                }`}>
                  {certInfo.label}
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
                {itemType}
              </p>
            )}

            {/* Price */}
            <div className="mb-6 pb-6 border-b border-border">
              {listing.price_value ? (
                <p className="text-2xl lg:text-3xl font-semibold text-ink tabular-nums">
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
                    <p className="text-[15px] text-ink font-medium">{artisan}</p>
                  </div>
                )}
                {school && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-muted">School</span>
                    <p className="text-[15px] text-ink font-medium">{school}</p>
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

            {/* Dealer */}
            <div className="mb-6 pb-6 border-b border-border">
              <span className="text-[11px] uppercase tracking-wider text-muted">Dealer</span>
              <p className="text-[15px] text-ink font-medium">{listing.dealers?.name}</p>
              <p className="text-[12px] text-muted">{listing.dealers?.domain}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* View on Dealer Site */}
              <a
                href={listing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-[14px] font-medium text-white bg-gold hover:bg-gold-light rounded-lg transition-colors"
              >
                View on {listing.dealers?.name}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

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

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      <BottomTabBar activeFilterCount={0} />
    </div>
  );
}
