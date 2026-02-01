# Plan: Activity Overview Chart for /admin Dashboard

## Summary

Replace the "Activity Overview" placeholder on `/admin` with a 7-day stacked area chart showing daily views, searches, and favorites.

---

## Phase 1: API Endpoint

### File: `src/app/api/admin/stats/activity-chart/route.ts`

**Create new endpoint** that returns 7-day activity breakdown.

```typescript
// GET /api/admin/stats/activity-chart?days=7
// Returns: { dataPoints: [...], totals: {...} }
```

**Implementation:**

1. Verify admin authentication (reuse `verifyAdmin` from `@/lib/admin/auth`)
2. Parse `days` query param (default 7, max 30)
3. Query three tables in parallel:
   - `listing_views` grouped by `DATE(viewed_at)`
   - `user_searches` grouped by `DATE(searched_at)`
   - `user_favorites` grouped by `DATE(created_at)`
4. Merge results into date-keyed array
5. Fill missing dates with zeros (ensure all 7 days present)
6. Return with 5-minute cache header

**Response shape:**
```typescript
interface ActivityChartResponse {
  dataPoints: Array<{
    date: string;      // "2026-01-26"
    dayLabel: string;  // "Sun"
    views: number;
    searches: number;
    favorites: number;
  }>;
  totals: {
    views: number;
    searches: number;
    favorites: number;
  };
  period: string;  // "7d"
}
```

**Key considerations:**
- Use `createServiceClient()` for `listing_views` and `user_searches` (bypass RLS for anonymous data)
- Regular client for `user_favorites` (has proper RLS)

---

## Phase 2: Frontend Integration

### File: `src/app/admin/page.tsx`

**Modify existing file** to:

1. Add state for chart data:
```typescript
const [activityData, setActivityData] = useState<ActivityChartData | null>(null);
const [activityLoading, setActivityLoading] = useState(true);
```

2. Fetch chart data in existing `useEffect`:
```typescript
// Add to fetchStats or create separate fetch
const activityRes = await fetch('/api/admin/stats/activity-chart');
const activityJson = await activityRes.json();
setActivityData(activityJson);
```

3. Replace placeholder with chart:
```tsx
<div className="bg-cream rounded-xl border border-border p-6">
  <div className="flex items-center justify-between mb-4">
    <h2 className="font-serif text-lg text-ink">Activity Overview</h2>
    <span className="text-xs text-muted">Last 7 days</span>
  </div>
  {activityLoading ? (
    <div className="h-64 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  ) : activityData ? (
    <ActivityChart data={activityData.dataPoints} />
  ) : (
    <div className="h-64 flex items-center justify-center text-muted">
      No activity data available
    </div>
  )}
</div>
```

### Chart Component (inline or extract)

Using Recharts (already a dependency):

```tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function ActivityChart({ data }: { data: ActivityDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data}>
        <XAxis
          dataKey="dayLabel"
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          hide
        />
        <Tooltip
          content={<CustomTooltip />}
        />
        <Area
          type="monotone"
          dataKey="views"
          stackId="1"
          stroke="#3B82F6"
          fill="#3B82F6"
          fillOpacity={0.6}
          name="Views"
        />
        <Area
          type="monotone"
          dataKey="searches"
          stackId="1"
          stroke="#D4AF37"
          fill="#D4AF37"
          fillOpacity={0.6}
          name="Searches"
        />
        <Area
          type="monotone"
          dataKey="favorites"
          stackId="1"
          stroke="#EC4899"
          fill="#EC4899"
          fillOpacity={0.6}
          name="Favorites"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

**Custom tooltip:**
```tsx
function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload) return null;
  return (
    <div className="bg-paper border border-border rounded-lg shadow-lg p-3">
      <p className="text-xs text-muted mb-2">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}
```

---

## Phase 3: Tests

### File: `tests/api/admin/stats/activity-chart.test.ts`

**Test cases:**

1. **Authentication**
   - Returns 401 for unauthenticated
   - Returns 403 for non-admin
   - Returns 200 for admin

2. **Response structure**
   - Has `dataPoints` array with 7 items (default)
   - Each dataPoint has required fields (date, dayLabel, views, searches, favorites)
   - Has `totals` object
   - Has `period` string

3. **Data aggregation**
   - Correctly sums views per day
   - Correctly sums searches per day
   - Correctly sums favorites per day
   - Fills missing days with zeros

4. **Query parameters**
   - Accepts `days` param (7, 14, 30)
   - Defaults to 7 days
   - Caps at 30 days max

5. **Caching**
   - Response includes Cache-Control header

---

## File Summary

| File | Action | Lines (est) |
|------|--------|-------------|
| `src/app/api/admin/stats/activity-chart/route.ts` | CREATE | ~90 |
| `src/app/admin/page.tsx` | MODIFY | +80 |
| `tests/api/admin/stats/activity-chart.test.ts` | CREATE | ~120 |

**Total: ~290 lines**

---

## Implementation Order

1. Create API endpoint (`activity-chart/route.ts`)
2. Write tests for API endpoint
3. Verify tests pass
4. Modify admin page to fetch and display chart
5. Manual verification in browser
6. Run full test suite
7. Commit and deploy

---

## Dependencies

Already available:
- `recharts` - charting library
- `@/lib/admin/auth` - admin verification
- `@/lib/supabase/server` - database clients

No new dependencies needed.

---

## Rollback

If issues arise, the change is isolated:
- API endpoint is new (can delete)
- Page change is additive (can revert to placeholder)
- No database migrations required
