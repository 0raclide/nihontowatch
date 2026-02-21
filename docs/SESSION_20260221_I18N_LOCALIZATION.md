# Japanese Localization — Implementation Handoff

**Date:** 2026-02-21
**Status:** Complete (5 phases shipped)
**Final test count:** 4,076 passing, 0 failing (145 test files)

---

## What Was Built

A complete Japanese localization system for NihontoWatch: UI translation (527 keys), cookie-based locale switching, IP-based auto-detection, kanji search, and localized email templates. No external i18n dependencies.

### Scope

| In Scope | Out of Scope |
|----------|-------------|
| All public UI strings (27 components) | Admin pages (English-only) |
| Email templates (3 templates) | Legal pages (need professional translation) |
| Kanji search (semantic parser + CJK ILIKE) | SEO meta tags / hreflang |
| IP-based auto-detection (JP → Japanese) | URL-based routing (`/ja/browse`) |
| Cookie-based locale persistence | Hiragana/katakana input conversion |
| Domain terms in pure kanji (`刀`, `重要`, `備前`) | Full CJK morphological analysis |

---

## Architecture

### Translation System

Custom lightweight system — no `next-intl`, no `i18next`. The app has ~500 strings, no translated routes, and no Japanese SEO, so a 70-line custom system is simpler than any library.

```
src/i18n/
  index.ts              # t(locale, key, params?) function, Locale type, constants
  LocaleContext.tsx      # React context + useLocale() hook (client-side)
  server.ts             # getServerLocale() reads cookie server-side
  locales/en.json       # 527 English keys (source of truth)
  locales/ja.json       # 527 Japanese translations (1:1 parity)
```

**`t()` function** — Fallback chain: `ja.json` → `en.json` → raw key. Supports `{param}` interpolation.

**`useLocale()` hook** — Returns `{ locale, setLocale, t }`. The `t` is pre-bound to the current locale. `setLocale('ja')` writes cookie + triggers React re-render with no page reload.

**`getServerLocale()`** — Reads `nw-locale` cookie via Next.js `cookies()` for server components and layout.

### Locale Detection Flow

```
Request → middleware.ts
  ├─ Cookie `nw-locale` exists? → Use it
  └─ No cookie → Read x-vercel-ip-country header
       ├─ "JP" → set locale=ja, write cookie
       └─ Other → set locale=en, write cookie
  ↓
layout.tsx reads cookie → <html lang={locale}>
  ↓
LocaleProvider wraps app → useLocale() available in all client components
```

### Language Switcher

`src/components/ui/LocaleSwitcher.tsx` — Simple toggle in Header (desktop) and MobileNavDrawer (mobile):
- Shows `日本語` when `en` (click to switch to Japanese)
- Shows `EN` when `ja` (click to switch to English)
- Calls `setLocale()` which writes cookie + re-renders instantly

---

## Files Created

| File | Purpose |
|------|---------|
| `src/i18n/index.ts` | Core `t()` function, `Locale` type, `LOCALE_COOKIE`, `isLocale()` |
| `src/i18n/LocaleContext.tsx` | `LocaleProvider` + `useLocale()` hook |
| `src/i18n/server.ts` | `getServerLocale()` for server components |
| `src/i18n/locales/en.json` | 527 English translation keys |
| `src/i18n/locales/ja.json` | 527 Japanese translations |
| `src/components/ui/LocaleSwitcher.tsx` | EN/日本語 toggle button |
| `tests/i18n/translations.test.ts` | 18 tests: key parity, fallback, interpolation |

## Files Modified (30)

### Infrastructure
- `src/middleware.ts` — IP detection + cookie auto-set
- `src/app/layout.tsx` — `<html lang={locale}>`, LocaleProvider, Noto Sans JP font
- `src/app/globals.css` — Japanese font stack rules

### Layout & Navigation
- `src/components/layout/Header.tsx` — Nav links, search placeholder, LocaleSwitcher
- `src/components/layout/MobileNavDrawer.tsx` — Nav links, section headers, LocaleSwitcher

### Browse & Listings
- `src/components/browse/FilterContent.tsx` — All label maps (item types, certs, periods, signatures, categories), section titles, sort options, availability labels (~80 strings)
- `src/components/browse/ListingCard.tsx` — Badge text, status labels, item type labels
- `src/components/browse/SaveSearchModal.tsx` — Form labels, buttons
- `src/app/page.tsx` / `HomeClient.tsx` — Hero heading, description

### Listing Detail
- `src/components/listing/QuickViewContent.tsx` — Spec labels, buttons, sections
- `src/components/listing/MetadataGrid.tsx` — All metadata row labels

### Auth
- `src/components/auth/LoginModal.tsx` — Form labels, errors, buttons

### Inquiry
- `src/components/inquiry/InquiryModal.tsx` — ResultStep, EmailPanel, TabButtons
- `src/components/inquiry/CopyButton.tsx` — Copy/Copied labels

### Favorites & Sharing
- `src/components/favorites/FavoriteButton.tsx` — Watchlist labels, signup prompts
- `src/components/share/ShareButton.tsx` — Share text, aria-labels

### Consent
- `src/components/consent/CookieBanner.tsx` — Banner text, buttons
- `src/components/consent/ConsentPreferences.tsx` — Preference labels

### Collection (13 files)
- `src/app/collection/CollectionPageClient.tsx`
- `src/components/collection/AddItemCard.tsx`
- `src/components/collection/CatalogSearchBar.tsx`
- `src/components/collection/CollectionBottomBar.tsx`
- `src/components/collection/CollectionCard.tsx`
- `src/components/collection/CollectionFilterContent.tsx`
- `src/components/collection/CollectionFilterDrawer.tsx`
- `src/components/collection/CollectionFormContent.tsx`
- `src/components/collection/CollectionItemContent.tsx`
- `src/components/collection/CollectionMobileSheet.tsx`
- `src/components/collection/CollectionQuickView.tsx`
- `src/components/collection/ImageUploadZone.tsx`

### Email Templates
- `src/lib/email/templates/price-drop.ts` — Locale parameter, all strings translated
- `src/lib/email/templates/saved-search.ts` — Locale parameter, all strings translated
- `src/lib/email/templates/back-in-stock.ts` — Locale parameter, all strings translated

### Search (Kanji Support)
- `src/lib/search/semanticQueryParser.ts` — Kanji maps for certs, item types, provinces
- `src/app/api/browse/route.ts` — CJK-aware ILIKE fallback + variant expansion
- `src/app/api/search/suggestions/route.ts` — CJK search suggestions

### Tests (9 files updated with LocaleContext mock)
- `tests/auth/LoginModal.test.tsx`
- `tests/components/inquiry/CopyButton.test.tsx`
- `tests/components/inquiry/InquiryModal.test.tsx`
- `tests/components/listing/QuickViewContent.test.tsx`
- `tests/components/listing/QuickViewMobileSheet.test.tsx`
- `tests/components/browse/VirtualListingGrid.scroll.test.tsx`
- `tests/components/layout/Header.test.tsx`
- `tests/components/browse/FilterContent.test.tsx`
- `tests/components/browse/ListingCard.test.tsx`

---

## Translation Key Conventions

Keys follow a flat dot-separated namespace pattern:

```
nav.browse              → "Browse" / "一覧"
filter.itemType         → "Item Type" / "種類"
itemType.katana         → "Katana" / "刀"
cert.Juyo               → "Juyo" / "重要"
email.newMatchesFound   → "New matches found!" / "新しいマッチが見つかりました！"
collection.addItem      → "Add Item" / "アイテム追加"
inquiry.howToSend       → "How to send" / "送信方法"
```

Domain terms use pure kanji in Japanese: `刀` not `Katana`, `重要` not `Juyo`, `備前` not `Bizen`.

### Adding New Translations

1. Add key to `src/i18n/locales/en.json`
2. Add matching key to `src/i18n/locales/ja.json`
3. In the component: `const { t } = useLocale();` then `t('your.key')`
4. For server-side (email templates): `import { t } from '@/i18n';` then `t(locale, 'your.key')`
5. Run `npm test` — the `translations.test.ts` will catch missing keys

### Test Mock Pattern

Any test file for a component that uses `useLocale()` needs this mock:

```typescript
vi.mock('@/i18n/LocaleContext', async () => {
  const en = await import('@/i18n/locales/en.json').then(m => m.default);
  const t = (key: string, params?: Record<string, string | number>) => {
    let value: string = (en as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
  return {
    useLocale: () => ({ locale: 'en', setLocale: () => {}, t }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});
```

The `async` factory with `await import()` is required because vitest's mock factories run before module resolution, and the `@/` alias needs dynamic import to resolve correctly.

---

## Kanji Search Implementation

Three targeted changes, no DB schema modifications:

1. **Semantic parser** (`semanticQueryParser.ts`): Added kanji entries to existing term maps — `重要` → `Juyo`, `刀` → `katana`, `備前` → `Bizen`, etc. `parseSemanticQuery('重要 短刀')` extracts `cert=Juyo, type=tanto` exactly like the romanized query.

2. **CJK-aware ILIKE** (`browse/route.ts`): `containsCJK()` regex gates a separate path. CJK queries skip PostgreSQL FTS (which can't tokenize CJK with the `simple` config) and use ILIKE on `title`, `smith`, `school`, `description`, with shinjitai↔kyujitai variant expansion from `textNormalization.ts`.

3. **Search suggestions** (`suggestions/route.ts`): CJK queries also search `description.ilike` and use kanji variant expansion.

**What this does NOT solve:** Full morphological analysis (would need pgroonga), hiragana/katakana-to-kanji conversion, fuzzy kanji matching.

---

## Known Gaps & Technical Debt

### 1. `labels.ts` not locale-aware (planned but not completed)

`src/lib/collection/labels.ts` still contains hardcoded English strings:
- `CERT_LABELS`, `STATUS_LABELS`, `CONDITION_LABELS`, `ITEM_TYPE_LABELS`, `SORT_OPTIONS`
- `formatPrice()` hardcodes `'en-US'` locale for `Intl.NumberFormat`
- `formatDate()` hardcodes `'en-US'` locale for `toLocaleDateString`
- `getItemTypeLabel()` returns English fallback

**Impact:** Low — collection components that import from labels.ts are now using `t()` directly via their own `useLocale()` hooks, so the labels.ts maps are mostly used as fallbacks or by non-translated code paths. But `formatPrice` and `formatDate` should ideally respect locale for number/date formatting.

**Fix:** Make these functions accept a `Locale` parameter and use `'ja-JP'` formatting when `locale === 'ja'`.

### 2. Legal pages not translated

`src/app/(legal)/*` (Terms, Privacy, Cookie Policy) remain in English. These are full legal documents that need professional translation, not machine translation.

### 3. Admin UI stays English (by design)

All `src/app/admin/*` pages remain English-only. Some aria-labels in admin-adjacent components are hardcoded English. This is intentional — the single admin user is English-speaking.

### 4. No locale switching tests

There are no integration tests verifying the full locale switching flow (cookie write → re-render → Japanese strings appear). The existing tests verify English rendering via the mock. Adding a test that renders with `locale: 'ja'` would be straightforward.

### 5. Email locale determination

Email templates accept a `locale` parameter (defaulting to `'en'`), but the cron jobs that send emails don't yet read the user's locale preference. The locale cookie is client-side only — to send Japanese emails, the cron job would need to read a stored `locale_preference` from the user's profile or a `user_preferences` table.

### 6. Untranslated components (~87 files)

Many files don't import `useLocale()`. Most are intentional (structural wrappers, admin, layout primitives). Some may contain minor hardcoded strings (aria-labels, error boundaries). A full audit would identify any remaining user-facing English.

---

## Design Retrospective

### What worked well

1. **Custom system over library** — 70 lines of code vs adding `next-intl` (which wants URL-based routing, has middleware opinions, and brings its own context system). The flat JSON + `t()` function is dead simple to understand and extend.

2. **Cookie-based locale** — No URL changes, no router complexity, no redirect chains. `setLocale()` writes cookie + re-renders instantly. The middleware auto-detects for first-time visitors.

3. **Parallel translation agents** — Using 3 concurrent agents to translate 13 collection components across ~250 strings was efficient. Each agent worked independently on a subset of files.

4. **Test mock pattern** — One consistent mock pattern across all 9 test files. The `async` factory with dynamic import was the key insight for vitest + path aliases.

### What I'd design differently

1. **A `useT()` helper or shared test factory from day one.** The same 15-line mock block is copy-pasted into 9 test files. A `tests/helpers/mockLocale.ts` file exporting `setupLocaleMock()` would eliminate this duplication and make adding the mock to new test files trivial:

   ```typescript
   // tests/helpers/mockLocale.ts
   export function setupLocaleMock() {
     vi.mock('@/i18n/LocaleContext', async () => { /* ... */ });
   }
   ```

2. **Make `labels.ts` locale-aware from the start.** The plan called for it, but the collection components were translated by adding `useLocale()` directly to each component rather than routing through `labels.ts`. This created a subtle split: some components use `t('itemType.katana')` directly, while others still call `getItemTypeLabel('katana')` which returns English. The cleaner architecture would have been to make `labels.ts` the single source of truth with locale support, and have components call it.

3. **Namespace the JSON keys more consistently.** The current keys are mostly well-organized (`nav.*`, `filter.*`, `itemType.*`, `collection.*`, `email.*`) but there are inconsistencies:
   - `cert.Juyo` uses the English romanization as the key suffix
   - `collection.status.owned` vs `collection.condition.mint` have different depths
   - Some email keys use camelCase (`viewMatchesButton`) while others are dot-separated

   A stricter convention upfront (e.g., always `{namespace}.{category}.{item}`, always lowercase keys) would have prevented drift.

4. **Store user locale preference server-side.** The cookie-only approach works for the web UI but creates a gap for email templates. The cron jobs that send saved search alerts and price drop emails can't read the user's cookie. Storing `locale_preference` in the `users` table (or `user_preferences`) during `setLocale()` would close this loop. This was a known gap in the plan but should have been addressed in Phase 5.

5. **Consider ICU MessageFormat for plurals.** The current system uses separate keys for singular/plural (`email.itemMatch` vs `email.itemsMatch`, `email.viewMatch` vs `email.viewMatches`). Japanese doesn't have grammatical plurals, so this works for the en/ja pair. But if a third language with complex plural rules were added (e.g., Russian, Arabic), the key-per-form approach would explode. ICU MessageFormat (`{count, plural, one {# match} other {# matches}}`) handles this natively. For two languages, the current approach is fine — but it's worth knowing the limitation.

---

## Quick Verification Checklist

```bash
# Run full test suite
npm test

# Verify locale switching (manual)
npm run dev
# 1. Visit localhost:3000 — English by default (non-JP IP)
# 2. Click language switcher → Japanese UI renders
# 3. Verify filters show kanji (刀, 重要, 備前)
# 4. Search "正宗" → returns Masamune results
# 5. Search "重要 短刀" → filters to Juyo + Tanto
# 6. Search "Masamune" → still works (romaji unchanged)
# 7. Switch back to EN → English restored
# 8. Check email preview (if available) for Japanese template

# Verify key parity
npm test -- tests/i18n/translations.test.ts
```

---

## Metrics

| Metric | Value |
|--------|-------|
| Translation keys | 527 per locale |
| Components using `useLocale()` | 27 |
| Server-side `t()` usage | 4 files (3 email templates + 1 API) |
| Test files with locale mock | 9 |
| New test file | 1 (`translations.test.ts`, 18 tests) |
| Total tests | 4,076 passing |
| Files created | 7 |
| Files modified | ~30 |
| External dependencies added | 0 |
