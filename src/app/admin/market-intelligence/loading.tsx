/**
 * Loading state for the Market Intelligence dashboard.
 * Displays skeleton placeholders while data is being fetched.
 */
export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-56 bg-linen rounded" />
          <div className="h-4 w-72 bg-linen rounded mt-2" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-10 w-32 bg-linen rounded" />
          <div className="h-10 w-28 bg-linen rounded" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-20 bg-linen border-r border-border last:border-r-0" />
          ))}
        </div>
        <div className="h-8 w-px bg-border hidden sm:block" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-10 w-32 bg-linen rounded-lg" />
          <div className="h-10 w-36 bg-linen rounded-lg" />
          <div className="h-10 w-28 bg-linen rounded-lg" />
        </div>
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-cream rounded-xl p-6 border border-border">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="h-3 w-24 bg-linen rounded" />
                <div className="h-9 w-32 bg-linen rounded mt-3" />
                <div className="h-3 w-20 bg-linen rounded mt-2" />
              </div>
              <div className="w-12 h-12 bg-linen rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Price Distribution skeleton */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <div className="h-6 w-40 bg-linen rounded mb-4" />
          <div className="h-[300px] bg-linen/50 rounded-lg flex items-end justify-between gap-2 px-10 pb-10 pt-5">
            {[65, 80, 45, 90, 55, 75, 40, 85, 60, 70].map((height, i) => (
              <div
                key={i}
                className="flex-1 bg-linen rounded-t"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          {/* Stats skeleton */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-12 bg-linen rounded" />
                  <div className="h-4 w-16 bg-linen rounded mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Breakdown skeleton */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <div className="h-6 w-44 bg-linen rounded mb-4" />
          <div className="h-[300px] flex flex-col items-center justify-center">
            <div className="relative">
              <div
                className="rounded-full border-[24px] border-linen"
                style={{ width: 160, height: 160 }}
              />
              <div
                className="absolute inset-0 m-auto rounded-full bg-cream"
                style={{ width: 112, height: 112 }}
              />
            </div>
            {/* Legend skeleton */}
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-linen" />
                  <div className="h-3 w-16 bg-linen rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Trend Line skeleton */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <div className="h-6 w-48 bg-linen rounded mb-4" />
          <div className="h-[300px] bg-linen/50 rounded-lg relative px-10 py-5">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-5 bottom-10 w-8 flex flex-col justify-between">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-3 w-6 bg-linen rounded" />
              ))}
            </div>
            {/* Grid lines */}
            <div className="ml-10 h-full relative">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-border/30"
                  style={{ top: `${(i / 3) * 100}%` }}
                />
              ))}
            </div>
            {/* X-axis labels */}
            <div className="absolute left-10 right-0 bottom-0 h-5 flex justify-between">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-3 w-8 bg-linen rounded" />
              ))}
            </div>
          </div>
          {/* Summary stats skeleton */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-linen rounded" />
                <div className="h-4 w-12 bg-linen rounded" />
              </div>
              <div className="flex gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className="h-3 w-8 bg-linen rounded" />
                    <div className="h-4 w-14 bg-linen rounded mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dealer Market Share skeleton */}
        <div className="bg-cream rounded-xl border border-border p-6">
          <div className="h-6 w-44 bg-linen rounded mb-4" />
          <div className="h-[400px] bg-linen/50 rounded-lg px-4 py-4">
            {/* Horizontal bars */}
            <div className="flex flex-col gap-3">
              {[80, 65, 55, 45, 40, 35, 30, 25, 20, 15].map((width, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-3 w-20 bg-linen rounded flex-shrink-0" />
                  <div
                    className="h-7 bg-linen rounded"
                    style={{ width: `${width}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Price Changes Table skeleton */}
      <div className="bg-cream rounded-xl border border-border">
        <div className="px-6 py-4 border-b border-border">
          <div className="h-6 w-44 bg-linen rounded" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left">
                  <div className="h-3 w-12 bg-linen rounded" />
                </th>
                <th className="px-4 py-3 text-left">
                  <div className="h-3 w-16 bg-linen rounded" />
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="h-3 w-20 bg-linen rounded ml-auto" />
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="h-3 w-20 bg-linen rounded ml-auto" />
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="h-3 w-16 bg-linen rounded ml-auto" />
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="h-3 w-16 bg-linen rounded ml-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="h-4 w-48 bg-linen rounded" />
                      <div className="h-3 w-24 bg-linen rounded" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 bg-linen rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-16 bg-linen rounded ml-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-16 bg-linen rounded ml-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-14 bg-linen rounded ml-auto" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 bg-linen rounded ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
