export default function ArtistsLoading() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header placeholder — real Header is in the layout/page above */}
      <header className="hidden lg:block sticky top-0 z-40 bg-cream">
        <div className="max-w-[1600px] mx-auto px-4 py-3 lg:px-6 lg:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-linen/50 animate-pulse" />
              <div className="h-6 w-40 bg-linen/50 animate-pulse rounded" />
            </div>
            <div className="flex-1 max-w-md mx-10">
              <div className="h-10 bg-linen/50 animate-pulse rounded" />
            </div>
            <div className="flex items-center gap-6">
              <div className="h-3 w-12 bg-linen/50 animate-pulse rounded" />
              <div className="h-3 w-12 bg-linen/50 animate-pulse rounded" />
              <div className="h-3 w-14 bg-linen/50 animate-pulse rounded" />
              <div className="h-3 w-10 bg-linen/50 animate-pulse rounded" />
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-8 lg:px-6">
        {/* Page Header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-48 bg-linen/60 animate-pulse rounded" />
          <div className="mt-2 h-4 w-80 bg-linen/40 animate-pulse rounded" />
        </div>

        {/* Filter bar skeleton */}
        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 max-w-md h-10 bg-linen/40 animate-pulse rounded" />
            <div className="flex">
              <div className="h-10 w-24 bg-linen/40 animate-pulse rounded-l" />
              <div className="h-10 w-24 bg-linen/40 animate-pulse rounded-r" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="h-9 w-28 bg-linen/40 animate-pulse rounded" />
            <div className="h-9 w-28 bg-linen/40 animate-pulse rounded" />
            <div className="h-9 w-28 bg-linen/40 animate-pulse rounded" />
            <div className="h-9 w-32 bg-linen/40 animate-pulse rounded" />
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="p-4 bg-cream border border-border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-32 bg-linen/50 animate-pulse rounded" />
                  <div className="h-3 w-16 bg-linen/40 animate-pulse rounded" />
                </div>
                <div className="h-5 w-12 bg-linen/40 animate-pulse rounded" />
              </div>
              <div className="mt-2.5 h-3 w-40 bg-linen/40 animate-pulse rounded" />
              <div className="mt-3 flex gap-3">
                <div className="h-3 w-16 bg-linen/40 animate-pulse rounded" />
                <div className="h-3 w-14 bg-linen/40 animate-pulse rounded" />
              </div>
              <div className="mt-3 h-1.5 w-full bg-linen/30 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
