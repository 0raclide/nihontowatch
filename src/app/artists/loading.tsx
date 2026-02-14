export default function ArtistsLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 lg:px-6">
      {/* Page header */}
      <div className="mb-8">
        <div className="hidden lg:block">
          <div className="h-7 w-24 img-loading rounded" />
          <div className="h-3.5 w-72 img-loading rounded mt-2" />
        </div>
        <div className="lg:hidden">
          <div className="h-7 w-24 img-loading rounded" />
          <div className="h-3.5 w-52 img-loading rounded mt-2" />
        </div>
      </div>

      {/* Sidebar + Grid layout */}
      <div className="flex flex-col lg:flex-row lg:gap-10">
        {/* Sidebar skeleton — desktop only */}
        <aside className="hidden lg:block w-[264px] flex-shrink-0 space-y-6">
          {/* Search */}
          <div className="h-10 w-full img-loading rounded" />
          {/* Type toggle */}
          <div className="flex border border-border divide-x divide-border">
            <div className="flex-1 h-10 img-loading" />
            <div className="flex-1 h-10 img-loading" />
          </div>
          {/* Filter groups */}
          <div className="space-y-4">
            <div className="h-3 w-16 img-loading rounded" />
            <div className="h-9 w-full img-loading rounded" />
            <div className="h-3 w-16 img-loading rounded" />
            <div className="h-9 w-full img-loading rounded" />
            <div className="h-3 w-16 img-loading rounded" />
            <div className="h-9 w-full img-loading rounded" />
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0 mt-8 lg:mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-cream border border-border flex flex-row overflow-hidden">
                {/* Thumbnail placeholder */}
                <div className="w-20 sm:w-28 shrink-0 bg-white/[0.04] border-r border-border/50 flex items-center justify-center p-2 sm:p-3">
                  <div className="w-full h-16 sm:h-20 img-loading rounded" />
                </div>
                {/* Content */}
                <div className="flex-1 p-4 flex flex-col min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="h-4 w-28 img-loading rounded" />
                      <div className="h-3 w-14 img-loading rounded" />
                    </div>
                    <div className="shrink-0 text-center space-y-1">
                      <div className="h-5 w-8 img-loading rounded mx-auto" />
                      <div className="h-2 w-10 img-loading rounded" />
                    </div>
                  </div>
                  <div className="mt-1.5 h-3 w-36 img-loading rounded" />
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="h-3 w-14 img-loading rounded" />
                    <div className="h-3 w-12 img-loading rounded" />
                    <div className="h-3 w-14 img-loading rounded" />
                  </div>
                  <div className="mt-auto pt-2.5">
                    <div className="h-1 w-full img-loading rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
