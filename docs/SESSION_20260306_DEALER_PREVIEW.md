# Session: Dealer Profile Preview Page

**Date:** 2026-03-06
**Commits:** `a261566`, `eb36cc7`, `d42b76c`

## Goal

Give dealers a way to see what their profile looks like to collectors. The public dealer page (`/dealers/[slug]`) only shows a minimal inventory summary. The new preview page renders the full rich profile using all the fields from the profile editor.

## Architecture

```
/dealer/preview  (auth-gated client page)
    │
    ├── fetches /api/dealer/profile  → dealer data + completeness
    ├── fetches /api/dealer/preview  → inventory stats + top 8 listings
    │
    └── renders <DealerProfileView>  (pure presentational component)
              + <ProfileCompleteness> (preview-only, bottom of page)
```

**Key design decision:** `DealerProfileView` is a pure presentational component that takes data as props. No auth, no fetching. The preview page wraps it with auth + a preview banner. The eventual public `/dealers/[slug]` page can reuse the same component with zero changes.

## Files Created

| File | Purpose |
|------|---------|
| `src/app/api/dealer/preview/route.ts` | API: inventory stats + top 8 featured listings for authenticated dealer |
| `src/app/dealer/preview/page.tsx` | Next.js page wrapper |
| `src/app/dealer/preview/DealerPreviewClient.tsx` | Client component: parallel fetch, amber preview banner, completeness bar |
| `src/components/dealer/DealerProfileView.tsx` | Reusable presentational component — all profile sections |

## Files Modified

| File | Change |
|------|--------|
| `src/app/dealer/profile/DealerProfileClient.tsx` | Added eye icon + "Preview" link in sticky header bar |
| `src/i18n/locales/en.json` | 16 new i18n keys for preview sections |
| `src/i18n/locales/ja.json` | 16 matching Japanese i18n keys |
| `src/app/api/dealer/listings/route.ts` | Fixed pre-existing type error (`artisan_id as string`) |

## DealerProfileView Sections

All sections conditionally render — hidden entirely when no data:

1. **Hero** — Banner (full-width 16:9, gradient fallback) + circular logo overlap (-mt-10, 80px) + name + flag + domain + founded year
2. **Empty state** — Document icon + "Edit Profile" link when dealer has no content at all
3. **Specializations** — Gold read-only pills from `SPECIALIZATIONS` constant
4. **About** — Bio text (locale-appropriate), translation toggle when both EN/JA exist
5. **Credentials** — Green checkmark list (NBTHK, Zentosho, Kobutsusho)
6. **Inventory** — Proportional color bar + type badge links (exact pattern from `/dealers/[slug]`)
7. **Featured Listings** — 2-col mobile / 4-col desktop grid of `ListingCard` via `listingToDisplayItem()`
8. **Browse All CTA** — Gold button linking to `/?dealer={id}`
9. **Contact** — Icons for email, phone, LINE, Instagram, Facebook. Full address when `address_visible=true`
10. **Policies** — Ships international, English support, payment methods (pills), return policy
11. **Shop Photo** — 4:3 aspect with "Our Shop" section header

## Preview API

```
GET /api/dealer/preview
Authorization: Cookie-based (verifyDealer)

Response: {
  stats: {
    totalListings: number,
    typeCounts: [{ type: string, count: number }]
  },
  featuredListings: Listing[]  // top 8 by featured_score, with dealer join
}
```

- Excludes dealer-portal listings when `NEXT_PUBLIC_DEALER_LISTINGS_LIVE !== 'true'`
- Type counts sorted descending, limited to 8

## Preview Page UX

- **Preview banner**: Sticky amber bar with eye icon + "This is a preview of your dealer page" + "Edit Profile" link
- **ProfileCompleteness**: Shown at the bottom (preview-only — will not appear on the eventual public page)
- **Loading**: Gold spinner centered on screen
- **Error**: Centered muted text with error message

## i18n Keys Added

| Key | EN | JA |
|-----|----|----|
| `dealer.previewBanner` | This is a preview of your dealer page | ディーラーページのプレビューです |
| `dealer.previewEditProfile` | Edit Profile | プロフィールを編集 |
| `dealer.previewButton` | Preview | プレビュー |
| `dealer.aboutSection` | About | ショップについて |
| `dealer.credentialsSection` | Credentials | 資格・免許 |
| `dealer.inventorySection` | Inventory | 在庫 |
| `dealer.featuredSection` | Featured Listings | 注目の商品 |
| `dealer.contactSection` | Contact | お問い合わせ |
| `dealer.policiesSection` | Policies | ポリシー |
| `dealer.browseAllDealerListings` | Browse all {count} listings | 全{count}件を閲覧 |
| `dealer.shipsIntlYes` | Ships internationally | 海外発送可 |
| `dealer.shipsIntlNo` | Japan only | 国内のみ |
| `dealer.englishSupportYes` | English support available | 英語対応可 |
| `dealer.showTranslation` | Show translation | 翻訳を表示 |
| `dealer.showOriginal` | Show original | 原文を表示 |
| `dealer.shopPhotoSection` | Our Shop | 店舗紹介 |

## Reuse Map

| What | From | Usage |
|------|------|-------|
| Proportional bar + type badges | `/dealers/[slug]/page.tsx` | Inventory section |
| `ListingCard` | `src/components/browse/ListingCard.tsx` | Featured listings grid |
| `listingToDisplayItem()` | `src/lib/displayItem/fromListing.ts` | Map listings for cards |
| `getDealerDisplayName()` | `src/lib/dealers/displayName.ts` | Locale-aware name |
| `getCountryFlag()` | `src/lib/dealers/utils.ts` | Flag emoji |
| `formatItemType()` | `src/lib/dealers/utils.ts` | Type labels |
| `ProfileCompleteness` | `src/components/dealer/ProfileCompleteness.tsx` | Bottom of preview |
| `verifyDealer()` | `src/lib/dealer/auth.ts` | API auth |
| `SPECIALIZATIONS` | `src/lib/dealer/specializations.ts` | Pill label lookup |

## Bugs Fixed During Implementation

### 1. Banner image escaped container
`<Image fill>` positions against nearest `relative` ancestor. Banner div was missing `relative`, so the image filled the entire hero section (including logo area). Fixed by adding `relative` to the banner container.

### 2. Logo shape mismatch
Profile editor renders logos as circles (`rounded-full`). Preview initially used `rounded-xl` (rounded squares). Fixed to match editor.

### 3. Inventory redundant label
Section header said "INVENTORY" and the card interior also said "Inventory". Removed the inner label.

### 4. Contact section always visible
`hasContact` included `dealer.domain` (which every dealer has), so the section rendered even with no contact info. Domain is already shown in the hero. Removed from guard.

### 5. Policies undefined/null mismatch
`hasPolicies` checked `!== null` but Supabase returns `undefined` for unset fields. Could show an empty Policies section header. Fixed to check both.

### 6. Pre-existing type error
`dealer/listings/route.ts` line 251: `artisan_id` destructured from `Record<string, unknown>` was typed as `{}`, not `string`. Added `as string` cast.

## Post-Audit Fixes

An automated audit identified several additional issues:

| Issue | Fix |
|-------|-----|
| Empty state (blank page when no data) | Added document icon + "Edit Profile" link |
| Only city+country shown in address | Now shows full `address, city, country` when `address_visible=true` |
| Facebook URL ignored | Added to contact section with Facebook icon |
| Shop photo had no context | Added "Our Shop" / "店舗紹介" section header |

### Audit False Positives (not real issues)

| Claim | Why wrong |
|-------|-----------|
| "Accent color not used" | `AccentColorPicker` was never built. Dead DB field. |
| "ListingCard type mismatch (P0!)" | `listingToDisplayItem()` handles `dealers` join objects correctly. Same `as any` pattern as ArtisanListings. |
| "About label inconsistency" | Intentionally different — editor instructive, preview concise. |
| "API validation gap (P0!)" | `verifyDealer()` already validates dealer_id. Empty results are fine. |
| "Browse link param wrong" | Confirmed correct — browse API reads `searchParams.get('dealer')`. |

## Future: Public Dealer Page

When building the public `/dealers/[slug]` page:

1. Reuse `<DealerProfileView>` directly — it's pure presentational
2. Server-render the stats/listings (SSR, not client fetch)
3. Don't include `ProfileCompleteness` (that's preview-only)
4. Don't include the amber preview banner
5. Add JSON-LD structured data, breadcrumbs, meta tags (SEO)
6. Consider adding `accent_color` support if `AccentColorPicker` is ever built
