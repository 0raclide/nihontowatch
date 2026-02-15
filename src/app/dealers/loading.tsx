export default function DealersLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8 lg:px-6">
      {/* Page header */}
      <div className="mb-8">
        <div className="hidden lg:block">
          <div className="h-7 w-28 img-loading rounded" />
          <div className="h-3.5 w-80 img-loading rounded mt-2" />
        </div>
        <div className="lg:hidden">
          <div className="h-7 w-28 img-loading rounded" />
          <div className="h-3.5 w-56 img-loading rounded mt-2" />
        </div>
      </div>

      {/* Sidebar + Grid layout */}
      <div className="flex flex-col lg:flex-row lg:gap-10">
        {/* Sidebar skeleton — desktop only */}
        <aside className="hidden lg:block w-[264px] flex-shrink-0 space-y-6">
          {/* Sort */}
          <div className="h-8 w-full img-loading rounded" />
          {/* Region toggle */}
          <div className="flex border border-border divide-x divide-border">
            <div className="flex-1 h-9 img-loading" />
            <div className="flex-1 h-9 img-loading" />
            <div className="flex-1 h-9 img-loading" />
          </div>
          {/* Search */}
          <div className="h-9 w-full img-loading rounded" />
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0 mt-8 lg:mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="bg-cream border border-border rounded-lg overflow-hidden shadow-sm"
              >
                {/* Proportion bar */}
                <div className="h-1 img-loading" />
                <div className="p-5 space-y-3">
                  {/* Name + flag */}
                  <div className="flex items-start justify-between">
                    <div className="h-5 w-32 img-loading rounded" />
                    <div className="h-5 w-5 img-loading rounded-full" />
                  </div>
                  {/* Domain */}
                  <div className="h-3 w-24 img-loading rounded" />
                  {/* Type badges */}
                  <div className="flex gap-2">
                    <div className="h-5 w-16 img-loading rounded" />
                    <div className="h-5 w-14 img-loading rounded" />
                    <div className="h-5 w-12 img-loading rounded" />
                  </div>
                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div className="h-3 w-20 img-loading rounded" />
                    <div className="h-3 w-24 img-loading rounded" />
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
