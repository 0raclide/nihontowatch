# Handoff: Debug Images Completeness Card on Scraper Admin

## What Was Done

An "Images" MetricCard was added to the scraper admin dashboard (`/admin/scrapers`) to show image upload completeness. Two files were changed and pushed in commit `673dcb0`:

### 1. API: `src/app/api/admin/scrapers/stats/route.ts`

Added 5 parallel Supabase queries for image upload status counts, returned as a new `images` field:

```json
{
  "images": {
    "completed": 214,
    "partial": 51,
    "pending": 0,
    "failed": 0,
    "total": 265,
    "rate": 81
  }
}
```

All queries filter `not('images', 'is', null).neq('images', '[]')` so counts are consistent. Wrapped in try/catch so the card degrades gracefully if the column doesn't exist.

### 2. Frontend: `src/app/admin/scrapers/page.tsx`

- Added `ImageStats` interface and `images: ImageStats` to `ScraperStats`
- Changed grid from `lg:grid-cols-4` to `lg:grid-cols-5`
- Added an Images `MetricCard` between QA Pass Rate and Pending URLs
- Color: green >= 95%, yellow >= 80%, red < 80%
- Subtitle shows `214/265 complete · 51 partial` (partial/pending/failed only shown when non-zero)

## The Problem

The card is not appearing on the live site at https://nihontowatch.com/admin/scrapers despite:
- Commit `673dcb0` pushed to `main`
- `npx next build` succeeds locally with zero errors
- `npx tsc --noEmit` passes with zero errors
- Code is confirmed present in current HEAD (a later commit `09ea3d8` sits on top)

## Debugging Steps

1. **Check if Vercel deployed**: Look at Vercel dashboard for the NihontoWatch project — is the latest deployment from commit `673dcb0` or later? Did it succeed?

2. **Check if API returns images data**: From browser console while on `/admin/scrapers`:
   ```js
   fetch('/api/admin/scrapers/stats').then(r => r.json()).then(d => console.log(d.images))
   ```
   - If `images` field exists → deployment is live, issue is frontend caching
   - If no `images` field → Vercel hasn't deployed or build failed

3. **Hard refresh**: `Cmd+Shift+R` to bypass cached JS bundle

4. **If Vercel build failed**: Check build logs. The only new dependency is the `images` field — no new packages. Possible issue: the `images_upload_status` column queries might fail differently in production Supabase vs local, but they're wrapped in try/catch so shouldn't break the endpoint.

5. **If still not working**: Trigger a manual redeploy from Vercel dashboard.

## Files Changed

| File | What |
|------|------|
| `src/app/api/admin/scrapers/stats/route.ts` | Added `images` stats (5 queries + response field) |
| `src/app/admin/scrapers/page.tsx` | Added `ImageStats` type, 5-col grid, Images MetricCard |

## Context

This is part of a larger effort in the `Oshi-scrapper` repo (session 50) to parallelize image uploads. The backend sweep in `scripts/daily_scrape.py` was rewritten to use ThreadPoolExecutor with per-domain semaphores and a time budget. The admin card provides observability into image upload health.
