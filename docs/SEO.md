# SEO Optimization

This document covers the SEO implementation for Nihontowatch, including technical SEO foundations, structured data, and best practices.

---

## Table of Contents

1. [Overview](#overview)
2. [Technical SEO](#technical-seo)
   - [robots.txt](#robotstxt)
   - [sitemap.xml](#sitemapxml)
   - [noindex Pages](#noindex-pages)
3. [Metadata](#metadata)
   - [Root Layout](#root-layout-metadata)
   - [Listing Pages](#listing-page-metadata)
   - [Canonical URLs](#canonical-urls)
4. [Structured Data (JSON-LD)](#structured-data-json-ld)
   - [Organization Schema](#organization-schema)
   - [WebSite Schema](#website-schema)
   - [Product Schema](#product-schema)
   - [BreadcrumbList Schema](#breadcrumblist-schema)
   - [LocalBusiness Schema](#localbusiness-schema)
5. [OpenGraph & Twitter Cards](#opengraph--twitter-cards)
6. [Image Optimization](#image-optimization)
7. [New SEO Pages](#new-seo-pages)
8. [Testing & Validation](#testing--validation)
9. [Google Search Console](#google-search-console)

---

## Overview

### What's Implemented

| Feature | Status | File |
|---------|--------|------|
| robots.txt | ✅ | `src/app/robots.ts` |
| sitemap.xml | ✅ | `src/app/sitemap.ts` |
| noindex (admin/auth) | ✅ | Various layout files |
| Organization JSON-LD | ✅ | `src/app/layout.tsx` |
| WebSite JSON-LD | ✅ | `src/app/layout.tsx` |
| Product JSON-LD | ✅ | `src/app/listing/[id]/page.tsx` |
| Breadcrumb JSON-LD | ✅ | `src/app/listing/[id]/page.tsx` |
| Canonical URLs | ✅ | Metadata in page files |
| OG Images | ✅ | `/api/og` dynamic generation |
| Dealer Directory | ✅ | `src/app/dealers/page.tsx` |
| Individual Dealer Pages | ✅ | `src/app/dealers/[slug]/page.tsx` |

### Key Files

```
src/
├── app/
│   ├── robots.ts              # robots.txt generation
│   ├── sitemap.ts             # Dynamic sitemap generation
│   ├── layout.tsx             # Root metadata + JSON-LD
│   ├── listing/[id]/page.tsx  # Product + Breadcrumb JSON-LD
│   ├── dealers/
│   │   ├── page.tsx           # Dealer directory
│   │   └── [slug]/page.tsx    # Individual dealer pages
│   ├── admin/layout.tsx       # noindex metadata
│   ├── saved/layout.tsx       # noindex metadata
│   └── profile/layout.tsx     # noindex metadata
└── lib/
    └── seo/
        └── jsonLd.ts          # JSON-LD schema generators
```

---

## Technical SEO

### robots.txt

**File:** `src/app/robots.ts`

Generates a robots.txt that:
- Allows crawling of all public content
- Blocks admin, API, and user-specific pages
- References the sitemap

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://nihontowatch.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/saved',
          '/profile',
          '/auth/',
          '/favorites',
          '/saved-searches',
          '/alerts',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

**Live URL:** https://nihontowatch.com/robots.txt

### sitemap.xml

**File:** `src/app/sitemap.ts`

Dynamic sitemap with:
- **ISR revalidation** every hour (`export const revalidate = 3600`)
- **Core pages**: Homepage, dealers directory
- **Dealer pages**: All 30 dealers with slugified URLs
- **Listing pages**: All available listings (not sold)
- **Batch fetching** to handle Supabase's 1000-row limit

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetches all dealers and listings
  // Returns ~1000+ URLs with lastModified, changeFreq, priority
}
```

**URL Structure:**
- `/` - priority 1.0, daily
- `/dealers` - priority 0.8, weekly
- `/dealers/[slug]` - priority 0.8, weekly
- `/listing/[id]` - priority 0.7, weekly

**Live URL:** https://nihontowatch.com/sitemap.xml

### noindex Pages

Pages that should not be indexed have `robots: { index: false, follow: false }` in their metadata:

| Page | Layout File |
|------|-------------|
| `/admin/*` | `src/app/admin/layout.tsx` |
| `/saved` | `src/app/saved/layout.tsx` |
| `/profile` | `src/app/profile/layout.tsx` |

```typescript
export const metadata: Metadata = {
  title: 'Admin Dashboard | Nihontowatch',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};
```

---

## Metadata

### Root Layout Metadata

**File:** `src/app/layout.tsx`

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Nihontowatch | Japanese Sword & Tosogu Marketplace",
  description: "The premier aggregator for Japanese swords...",
  keywords: ["nihonto", "japanese sword", "katana", ...],
  alternates: {
    canonical: baseUrl,
  },
  formatDetection: {
    telephone: false,
  },
  category: "shopping",
  icons: {
    icon: "/logo-mon.png",
    apple: "/logo-mon.png",
  },
  openGraph: { ... },
  twitter: { ... },
};
```

### Listing Page Metadata

**File:** `src/app/listing/[id]/page.tsx`

Dynamic metadata generated per listing:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch listing from Supabase
  // Build title: "Listing Title - Item Type | Nihontowatch"
  // Build description: "Title by Smith (Cert). Price. Available from Dealer."
  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/listing/${listingId}`,
    },
    openGraph: {
      images: [`${baseUrl}/api/og?id=${listingId}`], // Dynamic OG image
    },
    twitter: { ... },
  };
}
```

### Canonical URLs

All pages include canonical URLs via `alternates.canonical`:

- **Homepage:** `https://nihontowatch.com`
- **Listings:** `https://nihontowatch.com/listing/[id]`
- **Dealers:** `https://nihontowatch.com/dealers/[slug]`

This prevents duplicate content issues from query parameters (filters, pagination).

---

## Structured Data (JSON-LD)

### Helper Library

**File:** `src/lib/seo/jsonLd.ts`

Provides schema generators and a helper for rendering:

```typescript
// Render JSON-LD in React
export function jsonLdScriptProps(jsonLd: object) {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  };
}

// Usage in component:
<script {...jsonLdScriptProps(productJsonLd)} />
```

### Organization Schema

Added to root layout for site-wide authority signals:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Nihontowatch",
  "url": "https://nihontowatch.com",
  "logo": "https://nihontowatch.com/logo-mon.png",
  "description": "The premier aggregator for Japanese swords (nihonto) and sword fittings (tosogu) from dealers worldwide.",
  "sameAs": []
}
```

### WebSite Schema

Enables sitelinks search box in Google:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Nihontowatch",
  "url": "https://nihontowatch.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://nihontowatch.com/?search={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

### Product Schema

Added to listing detail pages (`/listing/[id]`):

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Katana by Kotetsu",
  "description": "Fine Edo period katana...",
  "image": ["https://..."],
  "sku": "12345",
  "brand": {
    "@type": "Brand",
    "name": "Kotetsu"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://nihontowatch.com/listing/12345",
    "priceCurrency": "JPY",
    "price": 5000000,
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "Aoi Art"
    }
  },
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "Certification", "value": "NBTHK Juyo" },
    { "@type": "PropertyValue", "name": "Era", "value": "Edo Period" },
    { "@type": "PropertyValue", "name": "Length", "value": "70.5 cm" }
  ]
}
```

### BreadcrumbList Schema

Navigation breadcrumbs for listing pages:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://nihontowatch.com" },
    { "@type": "ListItem", "position": 2, "name": "Katana", "item": "https://nihontowatch.com/?type=katana" },
    { "@type": "ListItem", "position": 3, "name": "Katana by Kotetsu" }
  ]
}
```

### LocalBusiness Schema

Added to dealer directory for each dealer:

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Aoi Art",
  "url": "https://aoijapan.com",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "JP"
  },
  "description": "Japanese sword and tosogu dealer",
  "priceRange": "$$$$"
}
```

---

## OpenGraph & Twitter Cards

### Dynamic OG Images

**Endpoint:** `/api/og`

Generates dynamic 1200x630 images with:
- Product image
- Price
- Title
- Branding

Usage in metadata:
```typescript
openGraph: {
  images: [{
    url: `${baseUrl}/api/og?id=${listingId}`,
    width: 1200,
    height: 630,
    alt: listing.title,
  }],
}
```

### Twitter Cards

All pages use `summary_large_image` card type:

```typescript
twitter: {
  card: 'summary_large_image',
  title: listing.title,
  description: `${price} - ${artisan}`,
  images: [`${baseUrl}/api/og?id=${listingId}`],
}
```

---

## Image Optimization

### Alt Text

Enhanced alt text generation in `ListingCard.tsx` and `QuickView.tsx`:

```typescript
const altText = [
  itemType,                              // "Katana"
  certInfo?.label,                       // "NBTHK Juyo"
  artisan ? `by ${artisan}` : null,      // "by Kotetsu"
  cleanedTitle !== itemType ? cleanedTitle : null
].filter(Boolean).join(' - ') || listing.title || 'Japanese sword listing';

// Result: "Katana - NBTHK Juyo - by Kotetsu - Fine example of Edo period"
```

### Image Formats

- AVIF/WebP with fallback
- Next.js Image optimization
- 30-day cache headers
- Lazy loading with skeleton placeholders

---

## New SEO Pages

### Dealer Directory

**URL:** `/dealers`

Server component showing all 27 dealers:
- Grouped by country (Japanese vs Western)
- Listing counts per dealer
- LocalBusiness JSON-LD for each

**Metadata:**
```typescript
title: "Japanese Sword Dealers | 27 Trusted Nihonto Dealers | Nihontowatch"
description: "Browse 27 verified Japanese sword and tosogu dealers..."
```

### Individual Dealer Pages

**URL:** `/dealers/[slug]`

Dynamic pages for each dealer:
- Dealer info and stats
- Sample listings
- Link to filtered browse view
- Breadcrumb JSON-LD

**Slug Generation:**
```typescript
function createDealerSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
// "Aoi Art" → "aoi-art"
```

---

## Testing & Validation

### Validate Structured Data

1. **Google Rich Results Test:**
   https://search.google.com/test/rich-results

   Test URLs:
   - `https://nihontowatch.com` (Organization, WebSite)
   - `https://nihontowatch.com/listing/123` (Product, Breadcrumb)
   - `https://nihontowatch.com/dealers` (LocalBusiness)

2. **Schema.org Validator:**
   https://validator.schema.org/

### Validate robots.txt

Visit: https://nihontowatch.com/robots.txt

Expected content:
```
User-Agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
...
Sitemap: https://nihontowatch.com/sitemap.xml
```

### Validate Sitemap

Visit: https://nihontowatch.com/sitemap.xml

Check:
- Valid XML structure
- All listings included
- All dealer pages included
- `lastmod` dates present

---

## Google Search Console

### Setup

1. Go to https://search.google.com/search-console
2. Add property for `nihontowatch.com`
3. Verify ownership (DNS or HTML file)

### Submit Sitemap

1. Navigate to **Sitemaps** in left sidebar
2. Enter `sitemap.xml`
3. Click **Submit**

Note: Initial fetch may show "Couldn't fetch" - this is normal. Google will crawl within 24-48 hours.

### Monitor

Check regularly for:
- **Coverage:** Indexed pages vs excluded
- **Enhancements:** Rich results eligibility
- **Core Web Vitals:** Performance metrics
- **Mobile Usability:** Mobile-friendly issues

---

## Maintenance

### Adding New Pages

When creating new public pages:
1. Add metadata with title, description, canonical
2. Add to sitemap if needed
3. Include appropriate JSON-LD schema

### Updating Schemas

When changing listing fields:
1. Update `generateProductJsonLd()` in `src/lib/seo/jsonLd.ts`
2. Test with Rich Results Test
3. Monitor Search Console for errors

### Sitemap Revalidation

The sitemap uses ISR with 1-hour revalidation. For immediate updates:
```bash
# Trigger revalidation via Vercel
curl -X POST "https://nihontowatch.com/api/revalidate?path=/sitemap.xml"
```

---

## SEO Checklist

### Per-Page Checklist

- [ ] Unique `<title>` (50-60 chars)
- [ ] Unique `<meta name="description">` (150-160 chars)
- [ ] Canonical URL set
- [ ] OpenGraph tags present
- [ ] Twitter card tags present
- [ ] Appropriate JSON-LD schema
- [ ] Images have descriptive alt text
- [ ] Mobile-friendly layout

### Site-Wide Checklist

- [ ] robots.txt accessible
- [ ] sitemap.xml accessible and valid
- [ ] Admin pages noindexed
- [ ] Core Web Vitals passing
- [ ] HTTPS enforced
- [ ] No broken internal links
- [ ] Structured data validated
