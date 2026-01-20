import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Certification tier colors
const CERT_COLORS: Record<string, { bg: string; text: string }> = {
  tokuju: { bg: '#4c1d95', text: '#ffffff' },
  'tokubetsu_juyo': { bg: '#4c1d95', text: '#ffffff' },
  'Tokubetsu Juyo': { bg: '#4c1d95', text: '#ffffff' },
  juyo: { bg: '#1e40af', text: '#ffffff' },
  'Juyo': { bg: '#1e40af', text: '#ffffff' },
  tokuho: { bg: '#78350f', text: '#ffffff' },
  'tokubetsu_hozon': { bg: '#78350f', text: '#ffffff' },
  'Tokubetsu Hozon': { bg: '#78350f', text: '#ffffff' },
  'TokuHozon': { bg: '#78350f', text: '#ffffff' },
  hozon: { bg: '#854d0e', text: '#ffffff' },
  'Hozon': { bg: '#854d0e', text: '#ffffff' },
};

// Human-readable certification labels
const CERT_LABELS: Record<string, string> = {
  tokuju: 'Tokubetsu Juyo',
  'tokubetsu_juyo': 'Tokubetsu Juyo',
  'Tokubetsu Juyo': 'Tokubetsu Juyo',
  juyo: 'Juyo',
  'Juyo': 'Juyo',
  tokuho: 'Tokubetsu Hozon',
  'tokubetsu_hozon': 'Tokubetsu Hozon',
  'Tokubetsu Hozon': 'Tokubetsu Hozon',
  'TokuHozon': 'Tokubetsu Hozon',
  hozon: 'Hozon',
  'Hozon': 'Hozon',
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
  fuchi_kashira: 'Fuchi-Kashira',
  kozuka: 'Kozuka',
  menuki: 'Menuki',
  koshirae: 'Koshirae',
};

function formatPrice(value: number | null, currency: string | null): string {
  if (!value) return 'Price on Request';

  const curr = currency || 'JPY';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  });

  return formatter.format(value);
}


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get('id');

  // Default OG image for non-listing pages
  if (!listingId) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            backgroundImage: 'radial-gradient(circle at 25% 25%, #2a2a2a 0%, transparent 50%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 40,
            }}
          >
            <span
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: '#c9a962',
                letterSpacing: '-0.02em',
              }}
            >
              Nihontowatch
            </span>
          </div>
          <span
            style={{
              fontSize: 32,
              color: '#a0a0a0',
              textAlign: 'center',
              maxWidth: 800,
            }}
          >
            The premier aggregator for Japanese swords and sword fittings from dealers worldwide
          </span>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }

  // Fetch listing data using REST API (edge-compatible)
  try {
    const listingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=id,title,price_value,price_currency,item_type,cert_type,smith,tosogu_maker,stored_images,images,dealers(name)`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!listingResponse.ok) {
      throw new Error(`Supabase error: ${listingResponse.status}`);
    }

    const listings = await listingResponse.json();
    const listing = listings[0];

    if (!listing) {
      throw new Error('Listing not found');
    }

    // Get certification info
    const certType = listing.cert_type as string | null;
    const certColors = certType ? CERT_COLORS[certType] : null;
    const certLabel = certType ? CERT_LABELS[certType] || certType : null;

    // Get item type label
    const itemType = listing.item_type as string | null;
    const itemTypeLabel = itemType ? ITEM_TYPE_LABELS[itemType.toLowerCase()] || itemType : null;

    // Get artisan name
    const artisan = listing.smith || listing.tosogu_maker;

    // Format price
    const priceDisplay = formatPrice(listing.price_value, listing.price_currency);

    // Dealer name
    const dealerName = listing.dealers?.name || 'Unknown Dealer';

    // Get image URL - prefer stored_images, then try constructed storage URL, then fall back to external images
    let imageUrl: string | null = null;
    const storedImages = listing.stored_images as string[] | null;
    const externalImages = listing.images as string[] | null;

    if (storedImages && storedImages.length > 0) {
      // Use stored_images if available
      imageUrl = storedImages[0];
    } else if (dealerName && dealerName !== 'Unknown Dealer') {
      // Try to construct storage URL from dealer name and listing ID
      // Storage pattern: listing-images/{dealer-slug}/L{listing_id}/00.jpg
      const dealerSlug = dealerName.toLowerCase().replace(/\s+/g, '-');
      const constructedUrl = `${SUPABASE_URL}/storage/v1/object/public/listing-images/${dealerSlug}/L${listingId}/00.jpg`;
      imageUrl = constructedUrl;
    } else if (externalImages && externalImages.length > 0) {
      // Fall back to external images (may not work due to CORS)
      imageUrl = externalImages[0];
    }

    // Return OG image with product image, title, price, and cert
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#1a1a1a',
          }}
        >
          {/* Left side - Product Image */}
          <div
            style={{
              width: 600,
              height: 630,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0f0f0f',
              overflow: 'hidden',
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                width={540}
                height={570}
                style={{
                  objectFit: 'contain',
                  objectPosition: 'center',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#444',
                  fontSize: 24,
                }}
              >
                No Image
              </div>
            )}
          </div>

          {/* Right side - Details */}
          <div
            style={{
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: 40,
              justifyContent: 'space-between',
            }}
          >
            {/* Top: Cert badge + Title */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {certLabel && (
                <div
                  style={{
                    display: 'flex',
                    alignSelf: 'flex-start',
                    backgroundColor: certColors?.bg || '#1e40af',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 16,
                  }}
                >
                  {certLabel}
                </div>
              )}
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1.3,
                }}
              >
                {String(listing.title || 'Listing').substring(0, 100)}
              </div>
              {artisan && (
                <div
                  style={{
                    fontSize: 20,
                    color: '#a0a0a0',
                    marginTop: 12,
                  }}
                >
                  {artisan}
                </div>
              )}
            </div>

            {/* Bottom: Price + Branding */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: '#c9a962',
                  marginBottom: 16,
                }}
              >
                {priceDisplay}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: '#c9a962',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: '#1a1a1a', fontSize: 16, fontWeight: 700 }}>N</span>
                </div>
                <span style={{ fontSize: 18, color: '#737373' }}>
                  nihontowatch.com
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (error) {
    // Fallback to default OG image on error - show error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#c9a962',
            }}
          >
            Nihontowatch
          </span>
          <span
            style={{
              fontSize: 32,
              color: '#a0a0a0',
              marginTop: 20,
            }}
          >
            Japanese Sword & Tosogu Marketplace
          </span>
          <span
            style={{
              fontSize: 14,
              color: '#ff6b6b',
              marginTop: 20,
            }}
          >
            Debug: {errorMessage}
          </span>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  }
}
