export default function ArtistProfileLoading() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header placeholder */}
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

      <div className="max-w-[1200px] mx-auto px-4 py-8 lg:px-6">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-3 w-12 bg-linen/40 animate-pulse rounded" />
          <div className="h-3 w-2 bg-linen/30 rounded" />
          <div className="h-3 w-14 bg-linen/40 animate-pulse rounded" />
          <div className="h-3 w-2 bg-linen/30 rounded" />
          <div className="h-3 w-28 bg-linen/40 animate-pulse rounded" />
        </div>

        {/* Hero section skeleton */}
        <div className="flex flex-col lg:flex-row gap-8 mb-10">
          {/* Image placeholder */}
          <div className="w-full lg:w-64 h-48 lg:h-72 bg-linen/40 animate-pulse rounded" />

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div className="h-8 w-64 bg-linen/60 animate-pulse rounded" />
            <div className="h-4 w-40 bg-linen/40 animate-pulse rounded" />
            <div className="h-4 w-56 bg-linen/40 animate-pulse rounded" />
            <div className="mt-4 flex gap-4">
              <div className="h-16 w-20 bg-linen/30 animate-pulse rounded" />
              <div className="h-16 w-20 bg-linen/30 animate-pulse rounded" />
              <div className="h-16 w-20 bg-linen/30 animate-pulse rounded" />
            </div>
          </div>
        </div>

        {/* Content sections skeleton */}
        <div className="space-y-8">
          <div>
            <div className="h-5 w-32 bg-linen/50 animate-pulse rounded mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-linen/30 animate-pulse rounded" />
              <div className="h-3 w-5/6 bg-linen/30 animate-pulse rounded" />
              <div className="h-3 w-4/6 bg-linen/30 animate-pulse rounded" />
            </div>
          </div>

          <div>
            <div className="h-5 w-40 bg-linen/50 animate-pulse rounded mb-4" />
            <div className="h-40 w-full bg-linen/20 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
