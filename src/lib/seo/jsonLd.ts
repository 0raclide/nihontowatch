/**
 * JSON-LD Structured Data Generators for SEO
 *
 * These functions generate schema.org compliant JSON-LD markup
 * for rich results in Google Search.
 */

import type { Listing, Dealer, ItemType } from '@/types';
import { getAttributionName, getAttributionSchool } from '@/lib/listing/attribution';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ProductJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  description?: string;
  image?: string[];
  sku: string;
  category: string;
  brand?: {
    '@type': 'Brand';
    name: string;
  };
  offers: {
    '@type': 'Offer';
    url: string;
    priceCurrency: string;
    price: number | string;
    availability: string;
    itemCondition: string;
    seller?: {
      '@type': 'Organization';
      name: string;
      url?: string;
    };
  };
  additionalProperty?: Array<{
    '@type': 'PropertyValue';
    name: string;
    value: string | number;
    unitCode?: string;
  }>;
}

export interface BreadcrumbJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }>;
}

export interface OrganizationJsonLd {
  '@context': 'https://schema.org';
  '@type': 'Organization';
  name: string;
  url: string;
  logo: string;
  description: string;
  sameAs?: string[];
}

export interface WebsiteJsonLd {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  name: string;
  url: string;
  description: string;
  potentialAction?: {
    '@type': 'SearchAction';
    target: {
      '@type': 'EntryPoint';
      urlTemplate: string;
    };
    'query-input': string;
  };
}

export interface LocalBusinessJsonLd {
  '@context': 'https://schema.org';
  '@type': 'LocalBusiness';
  name: string;
  url: string;
  description?: string;
  address?: {
    '@type': 'PostalAddress';
    addressCountry: string;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get human-readable category for item type
 */
function getCategoryFromItemType(itemType: ItemType): string {
  const bladeTypes: ItemType[] = [
    'katana', 'wakizashi', 'tanto', 'tachi', 'kodachi',
    'naginata', 'naginata naoshi', 'yari', 'ken', 'daisho'
  ];

  const tosoguTypes: ItemType[] = [
    'tsuba', 'menuki', 'kozuka', 'kogai', 'fuchi', 'kashira',
    'fuchi_kashira', 'futatokoro', 'mitokoromono', 'tosogu'
  ];

  if (bladeTypes.includes(itemType)) {
    return 'Japanese Swords > Nihonto';
  }

  if (tosoguTypes.includes(itemType)) {
    return 'Japanese Swords > Tosogu (Sword Fittings)';
  }

  if (itemType === 'koshirae') {
    return 'Japanese Swords > Koshirae (Sword Mounts)';
  }

  if (itemType === 'armor' || itemType === 'helmet') {
    return 'Japanese Armor';
  }

  return 'Japanese Swords & Antiques';
}

/**
 * Get schema.org availability URL
 */
function getAvailability(isSold: boolean): string {
  return isSold
    ? 'https://schema.org/SoldOut'
    : 'https://schema.org/InStock';
}

/**
 * Format price for schema.org (number or "0" for Ask pricing)
 */
function formatSchemaPrice(priceValue: number | undefined | null): number | string {
  if (priceValue === undefined || priceValue === null || priceValue === 0) {
    return 0; // Schema.org requires a number; 0 indicates "Ask"
  }
  return priceValue;
}

// =============================================================================
// SCHEMA GENERATORS
// =============================================================================

/**
 * Generate Product JSON-LD for a listing page
 */
export function generateProductJsonLd(listing: Listing, dealer?: Dealer): ProductJsonLd {
  const artisan = getAttributionName(listing);
  const images = listing.stored_images || listing.images || [];

  // Build a descriptive name — Google requires a non-empty 'name' field
  const productName = listing.title
    || [
        listing.item_type?.charAt(0).toUpperCase() + (listing.item_type?.slice(1) || ''),
        artisan,
        listing.cert_type,
      ].filter(Boolean).join(' - ')
    || `Listing #${listing.id}`;

  const product: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productName,
    sku: listing.id.toString(),
    category: getCategoryFromItemType(listing.item_type),
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/listing/${listing.id}`,
      priceCurrency: listing.price_currency || 'JPY',
      price: formatSchemaPrice(listing.price_value),
      availability: getAvailability(listing.is_sold),
      itemCondition: 'https://schema.org/UsedCondition',
    },
  };

  // Description
  if (listing.description) {
    product.description = listing.description.slice(0, 500);
  } else if (listing.title_en || listing.description_en) {
    product.description = (listing.description_en || listing.title_en || '').slice(0, 500);
  }

  // Images
  if (images.length > 0) {
    product.image = images.slice(0, 5); // Limit to 5 images
  }

  // Brand (artisan)
  if (artisan) {
    product.brand = {
      '@type': 'Brand',
      name: artisan,
    };
  }

  // Seller (dealer)
  if (dealer || listing.dealer) {
    const dealerInfo = dealer || listing.dealer;
    if (dealerInfo) {
      product.offers.seller = {
        '@type': 'Organization',
        name: dealerInfo.name,
        url: `https://${dealerInfo.domain}`,
      };
    }
  }

  // Additional properties (sword specs)
  const additionalProps: ProductJsonLd['additionalProperty'] = [];

  if (listing.cert_type) {
    additionalProps.push({
      '@type': 'PropertyValue',
      name: 'Certification',
      value: listing.cert_type,
    });
  }

  if (listing.nagasa_cm) {
    additionalProps.push({
      '@type': 'PropertyValue',
      name: 'Nagasa (Blade Length)',
      value: listing.nagasa_cm,
      unitCode: 'CMT',
    });
  }

  if (listing.sori_cm) {
    additionalProps.push({
      '@type': 'PropertyValue',
      name: 'Sori (Curvature)',
      value: listing.sori_cm,
      unitCode: 'CMT',
    });
  }

  if (listing.era) {
    additionalProps.push({
      '@type': 'PropertyValue',
      name: 'Era',
      value: listing.era,
    });
  }

  if (listing.province) {
    additionalProps.push({
      '@type': 'PropertyValue',
      name: 'Province',
      value: listing.province,
    });
  }

  const attributionSchool = getAttributionSchool(listing);
  if (attributionSchool) {
    additionalProps.push({
      '@type': 'PropertyValue',
      name: 'School',
      value: attributionSchool,
    });
  }

  if (listing.mei_type) {
    additionalProps.push({
      '@type': 'PropertyValue',
      name: 'Signature',
      value: listing.mei_type,
    });
  }

  if (additionalProps.length > 0) {
    product.additionalProperty = additionalProps;
  }

  return product;
}

/**
 * Generate BreadcrumbList JSON-LD
 */
export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url?: string }>
): BreadcrumbJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      // Google requires a non-empty 'name' in every ListItem
      name: item.name || 'Page',
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

/**
 * Generate Organization JSON-LD (site-wide)
 */
export function generateOrganizationJsonLd(dealerCount?: number): OrganizationJsonLd {
  const dealerPhrase = dealerCount ? `${dealerCount} trusted dealers` : 'trusted dealers worldwide';
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NihontoWatch',
    url: BASE_URL,
    logo: `${BASE_URL}/logo-mon.png`,
    description:
      `The premier aggregator for Japanese swords (nihonto) and sword fittings (tosogu) from dealers worldwide. Find katana, wakizashi, tsuba, and more from ${dealerPhrase}.`,
  };
}

/**
 * Generate WebSite JSON-LD with SearchAction (site-wide)
 */
export function generateWebsiteJsonLd(): WebsiteJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'NihontoWatch',
    url: BASE_URL,
    description:
      'The premier aggregator for Japanese swords and sword fittings from dealers worldwide.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate LocalBusiness JSON-LD for a dealer
 */
export function generateDealerJsonLd(dealer: Dealer): LocalBusinessJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: dealer.name,
    url: `https://${dealer.domain}`,
    description: `Japanese sword dealer specializing in nihonto and tosogu.`,
    address: {
      '@type': 'PostalAddress',
      addressCountry: dealer.country || 'JP',
    },
  };
}

/**
 * Generate CollectionPage JSON-LD for the artist directory
 */
export function generateArtistDirectoryJsonLd(
  topArtists: Array<{ name: string; url: string }>
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Japanese Swordsmith & Tosogu Maker Directory',
    description:
      'Comprehensive directory of Japanese swordsmiths and tosogu makers with certification statistics and elite rankings.',
    url: `${BASE_URL}/artists`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'NihontoWatch',
      url: BASE_URL,
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: topArtists.length,
      itemListElement: topArtists.map((artist, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Person',
          name: artist.name,
          url: artist.url,
        },
      })),
    },
  };
}

// =============================================================================
// REACT COMPONENT HELPERS
// =============================================================================

/**
 * Serialize JSON-LD object to script tag content.
 * Escapes HTML-special characters to prevent XSS via </script> injection.
 */
export function jsonLdScriptProps(jsonLd: object): {
  type: 'application/ld+json';
  dangerouslySetInnerHTML: { __html: string };
} {
  const serialized = JSON.stringify(jsonLd)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: {
      __html: serialized,
    },
  };
}

/**
 * Generate ItemList JSON-LD for category pages.
 * Shows preview listings as a structured list in search results.
 */
export function generateItemListJsonLd(
  items: Array<{ id: number; title: string; price_value: number | null; price_currency: string | null; images: string[] | null; stored_images: string[] | null }>,
  listName: string,
  listUrl: string
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    url: listUrl,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => {
      const imageUrl = item.stored_images?.[0] || item.images?.[0];
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: `${BASE_URL}/listing/${item.id}`,
        name: item.title,
        ...(imageUrl ? { image: imageUrl } : {}),
      };
    }),
  };
}

/**
 * Generate item type label for breadcrumbs
 */
export function getItemTypeBreadcrumbLabel(itemType: ItemType): string {
  const labels: Partial<Record<ItemType, string>> = {
    katana: 'Katana',
    wakizashi: 'Wakizashi',
    tanto: 'Tanto',
    tachi: 'Tachi',
    naginata: 'Naginata',
    yari: 'Yari',
    tsuba: 'Tsuba',
    menuki: 'Menuki',
    kozuka: 'Kozuka',
    fuchi_kashira: 'Fuchi-Kashira',
    koshirae: 'Koshirae',
    armor: 'Armor',
    helmet: 'Helmet',
  };

  return labels[itemType] || itemType.charAt(0).toUpperCase() + itemType.slice(1);
}
