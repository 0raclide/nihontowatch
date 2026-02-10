export default function ArtistsLoading() {
  return (
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

      {/* Grid skeleton — matches ArtistCard layout */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="bg-cream border border-border flex flex-row overflow-hidden">
            {/* Thumbnail placeholder */}
            <div className="w-20 sm:w-28 shrink-0 bg-white/[0.04] border-r border-border/50 flex items-center justify-center p-2 sm:p-3">
              <div className="w-full h-16 sm:h-20 bg-linen/40 animate-pulse rounded" />
            </div>
            {/* Content */}
            <div className="flex-1 p-4 flex flex-col min-w-0">
              {/* Row 1: Name + Works */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-4 w-28 bg-linen/50 animate-pulse rounded" />
                  <div className="h-3 w-14 bg-linen/40 animate-pulse rounded" />
                </div>
                <div className="shrink-0 text-center space-y-1">
                  <div className="h-5 w-8 bg-linen/40 animate-pulse rounded mx-auto" />
                  <div className="h-2 w-10 bg-linen/30 animate-pulse rounded" />
                </div>
              </div>
              {/* Row 2: School / Period / Province */}
              <div className="mt-1.5 h-3 w-36 bg-linen/40 animate-pulse rounded" />
              {/* Row 3: Cert badges */}
              <div className="mt-2.5 flex items-center gap-3">
                <div className="h-3 w-14 bg-linen/40 animate-pulse rounded" />
                <div className="h-3 w-12 bg-linen/40 animate-pulse rounded" />
                <div className="h-3 w-14 bg-linen/40 animate-pulse rounded" />
              </div>
              {/* Elite bar */}
              <div className="mt-auto pt-2.5">
                <div className="h-1 w-full bg-linen/30 animate-pulse rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
