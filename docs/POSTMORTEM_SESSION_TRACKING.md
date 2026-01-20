# Postmortem: Anonymous Session Tracking Fix

**Date:** 2026-01-21
**Severity:** Medium
**Impact:** Session data (sessions, duration) not being recorded for anonymous visitors

## Summary

Anonymous visitor sessions were not being tracked in the database, causing the admin dashboard to show `sessions=0` and `total time: —` for all visitors despite activity events being recorded correctly.

## Root Cause

Three issues prevented anonymous session tracking:

### 1. Wrong Column Name in Session API

The session API was using `id` (UUID auto-generated) instead of `session_id` (TEXT identifier we track):

```typescript
// BEFORE (broken)
.from('user_sessions').insert({ id: sessionId, ... })
.eq('id', sessionId)

// AFTER (fixed)
.from('user_sessions').insert({ session_id: sessionId, ... })
.eq('session_id', sessionId)
```

### 2. NOT NULL Constraint on user_id

The `user_sessions` table required `user_id NOT NULL`, but anonymous visitors don't have a user ID:

```sql
-- Migration 031 fix
ALTER TABLE user_sessions ALTER COLUMN user_id DROP NOT NULL;
```

### 3. RLS Policy Blocked Inserts

Row Level Security policy required `auth.uid() = user_id`, which anonymous requests can't satisfy. Fixed by using `createServiceClient()` to bypass RLS.

## Detection

User reported seeing `sessions=0` and `total time: —` in the admin visitor detail modal despite extensive activity data being visible.

## Resolution

1. **Session API** (`src/app/api/activity/session/route.ts`):
   - Changed from `createClient()` to `createServiceClient()`
   - Fixed column name from `id` to `session_id` in both POST and PATCH

2. **Visitor Detail API** (`src/app/api/admin/visitors/[visitorId]/route.ts`):
   - Fixed session query to use `.in('session_id', sessionIds)` instead of `.in('id', sessionIds)`

3. **Database Migration** (`supabase/migrations/031_fix_anonymous_sessions.sql`):
   - Dropped NOT NULL constraint on `user_id`
   - Added index for anonymous sessions

## Testing

Added comprehensive tests in `tests/api/activity/session.test.ts`:
- Session creation (POST) validation and success paths
- Session ending (PATCH) validation and success paths
- Service client usage verification
- Column name verification (`session_id` not `id`)
- Full lifecycle test (create → end)

## Lessons Learned

1. **Schema Documentation**: The difference between `id` (UUID PK) and `session_id` (TEXT identifier) wasn't clear. Better column naming or documentation would help.

2. **RLS Considerations**: When designing APIs for anonymous users, consider RLS implications early. Service role bypass is the standard pattern.

3. **Silent Failures**: The session API returned success even when inserts failed (best-effort tracking). This made the bug harder to detect. Consider logging failed inserts more prominently.

## Related Files

- `src/app/api/activity/session/route.ts` - Session create/end API
- `src/app/api/admin/visitors/[visitorId]/route.ts` - Visitor detail API
- `supabase/migrations/031_fix_anonymous_sessions.sql` - Schema fix
- `tests/api/activity/session.test.ts` - Session API tests
