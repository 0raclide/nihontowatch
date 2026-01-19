# Postmortem: Trailing Slash URL Duplicates

**Date:** 2026-01-19
**Severity:** Medium (Data quality issue)
**Status:** Resolved

## Summary

Four duplicate listing pairs were discovered in the database where the same item existed with two different URLs differing only by a trailing slash. One duplicate (Tametsugu katana, IDs 6311 & 6317) was incorrectly showing a "NEW" badge despite being the same item.

## Timeline

| Time (UTC) | Event |
|------------|-------|
| 2026-01-16 09:34 | Listing 6311 scraped (URL with trailing `/`) |
| 2026-01-16 12:52 | Listing 6317 scraped (URL without trailing `/`) |
| 2026-01-16 14:47 | URL normalization fix committed (c92cf0f) |
| 2026-01-19 | Duplicate reported by user |
| 2026-01-19 | Root cause identified, fix deployed |

## Root Cause

1. **URL Normalization Gap**: The URL normalization code in `db/repository.py` was committed AFTER both duplicate listings were already in the database.

2. **Technical Details**:
   - Aoi Art's website serves identical content at both URL variants
   - Discovery crawler found the item via two different catalog pages
   - Database UNIQUE constraint on `url` worked correctly - the URLs were technically different strings
   - No content-based deduplication caught it because the `smith` field differed slightly ("Tametsugu" vs "Den Tametsugu")

3. **"NEW" Badge Confusion**: The `shouldShowNewBadge()` logic correctly identified listing 6317 as "new" based on its `first_seen_at` timestamp, but this was misleading because it was actually a duplicate of an older listing.

## Affected Data

| Duplicate Pair | IDs | Dealer |
|---------------|-----|--------|
| Hasebekunisige | 5241 & 5402 | Hyozaemon |
| Katsuya Naohide | 6303 & 6309 | Aoi Art |
| **Tametsugu** | **6311 & 6317** | **Aoi Art** |
| Yoshifusa | 5268 & 11265 | Hyozaemon |

## Resolution

### Immediate Fix (Data Cleanup)
- Merged foreign key references from newer to older listings
- Deleted 4 duplicate listings (IDs: 5402, 6309, 6317, 11265)
- Normalized all existing URLs (removed trailing slashes from 11 URLs)

### Prevention (Defense in Depth)

1. **Database Trigger** (`20260119000002_add_url_normalization_trigger.sql`):
   ```sql
   CREATE TRIGGER listing_url_normalize
   BEFORE INSERT OR UPDATE OF url ON listings
   FOR EACH ROW EXECUTE FUNCTION normalize_listing_url();
   ```
   Automatically strips trailing slashes on INSERT/UPDATE.

2. **Application-Level Normalization** (`db/repository.py`):
   - `add_urls()` - normalizes before storing in discovered_urls
   - `mark_scraped()` - normalizes for lookups
   - `_listing_to_db_row()` - normalizes before upserting listings
   - `get_by_url()` - normalizes for queries

### Files Changed

**Oshi-scrapper:**
- `db/repository.py` - Added normalization to `add_urls()` and `mark_scraped()`
- `supabase/migrations/20260119000001_fix_trailing_slash_duplicates.sql` - Data cleanup
- `supabase/migrations/20260119000002_add_url_normalization_trigger.sql` - Prevention trigger

## Lessons Learned

1. **Deploy normalization before data collection**: The fix was committed hours after the duplicates were created. Data quality fixes should be deployed immediately when discovered.

2. **Defense in depth**: Now have both application-level AND database-level URL normalization. Either layer can catch issues independently.

3. **Content-based deduplication limits**: The identity hash system (`smith + school + nagasa + cert_session`) didn't catch this because:
   - `smith` values differed ("Tametsugu" vs "Den Tametsugu")
   - No `cert_session` was extracted
   - Consider adding secondary checks based on `title + nagasa + price + dealer_id`

## Verification

```
Tametsugu listings after fix: 1
  ID 6311 | Tametsugu | 2026-01-16T09:34:17

URLs with trailing slashes: 0
Deleted duplicate IDs remaining: 0
Total listings: 4,966 (was 4,970)
```

## Future Improvements

1. **Monitoring**: Add weekly scan for potential URL duplicates to admin dashboard
2. **Content Similarity**: Implement fuzzy matching on title/price/nagasa for same-dealer items
3. **Discovery Deduplication**: Normalize URLs earlier in the discovery pipeline before storing in `discovered_urls`
