import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Supabase config
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Certification tier colors
const CERT_COLORS: Record<string, string> = {
  tokuju: '#7c3aed',
  tokubetsu_juyo: '#7c3aed',
  'Tokubetsu Juyo': '#7c3aed',
  juyo: '#2563eb',
  Juyo: '#2563eb',
  tokuho: '#b45309',
  tokubetsu_hozon: '#b45309',
  'Tokubetsu Hozon': '#b45309',
  TokuHozon: '#b45309',
  hozon: '#ca8a04',
  Hozon: '#ca8a04',
};

// Human-readable certification labels
const CERT_LABELS: Record<string, string> = {
  tokuju: 'TOKUBETSU JUYO',
  tokubetsu_juyo: 'TOKUBETSU JUYO',
  'Tokubetsu Juyo': 'TOKUBETSU JUYO',
  juyo: 'JUYO',
  Juyo: 'JUYO',
  tokuho: 'TOKUBETSU HOZON',
  tokubetsu_hozon: 'TOKUBETSU HOZON',
  'Tokubetsu Hozon': 'TOKUBETSU HOZON',
  TokuHozon: 'TOKUBETSU HOZON',
  hozon: 'HOZON',
  Hozon: 'HOZON',
};

function formatPrice(value: number | null, currency: string | null): string {
  if (!value) return 'Price on Request';
  const curr = currency || 'JPY';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  }).format(value);
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
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111111',
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, color: '#c9a962' }}>
            Nihontowatch
          </div>
          <div style={{ fontSize: 28, color: '#888888', marginTop: 20 }}>
            The premier aggregator for Japanese swords and sword fittings
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

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

    const certType = listing.cert_type as string | null;
    const certColor = certType ? CERT_COLORS[certType] || '#374151' : null;
    const certLabel = certType ? CERT_LABELS[certType] || certType.toUpperCase() : null;
    const artisan = listing.smith || listing.tosogu_maker || '';
    const priceDisplay = formatPrice(listing.price_value, listing.price_currency);
    const dealerName = listing.dealers?.name || 'Unknown Dealer';
    const title = String(listing.title || 'Listing').substring(0, 80);

    // Get image as base64 data URL to avoid Satori remote fetch issues
    let imageDataUrl: string | null = null;
    const storedImages = listing.stored_images as string[] | null;

    try {
      let imageUrl: string | null = null;

      if (storedImages && storedImages.length > 0) {
        // Use Supabase image transform for smaller size
        imageUrl = storedImages[0].replace(
          '/storage/v1/object/public/',
          '/storage/v1/render/image/public/'
        ) + '?width=660&height=630&resize=cover&quality=80';
      } else if (dealerName && dealerName !== 'Unknown Dealer') {
        const dealerSlug = dealerName.toLowerCase().replace(/\s+/g, '-');
        const basePath = `listing-images/${dealerSlug}/L${listingId}/00.jpg`;
        imageUrl = `${SUPABASE_URL}/storage/v1/render/image/public/${basePath}?width=660&height=630&resize=cover&quality=80`;
      }

      if (imageUrl) {
        // Fetch image and convert to base64
        const imageResponse = await fetch(imageUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          imageDataUrl = `data:${contentType};base64,${base64}`;
        }
      }
    } catch {
      // Silently fail - image is optional
    }

    // Clean text-focused design - no external images to avoid rendering issues
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 60,
            backgroundColor: '#0f0f0f',
            backgroundImage: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)',
          }}
        >
          {/* Top: Cert Badge */}
          <div style={{ display: 'flex' }}>
            {certLabel && (
              <div
                style={{
                  display: 'flex',
                  backgroundColor: certColor || '#374151',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: 8,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                }}
              >
                {certLabel}
              </div>
            )}
          </div>

          {/* Middle: Title + Artisan */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.2,
                marginBottom: 16,
              }}
            >
              {title}
            </div>
            {artisan && (
              <div style={{ fontSize: 28, color: '#9ca3af' }}>
                by {artisan}
              </div>
            )}
          </div>

          {/* Bottom: Price + Branding */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: '#c9a962',
              }}
            >
              {priceDisplay}
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#c9a962',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                <span style={{ color: '#0f0f0f', fontSize: 24, fontWeight: 700 }}>N</span>
              </div>
              <span style={{ fontSize: 24, color: '#6b7280' }}>nihontowatch.com</span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#111111',
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, color: '#c9a962' }}>
            Nihontowatch
          </div>
          <div style={{ fontSize: 28, color: '#888888', marginTop: 20 }}>
            Japanese Sword & Tosogu Marketplace
          </div>
          <div style={{ fontSize: 14, color: '#ef4444', marginTop: 16 }}>
            {errorMessage}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
