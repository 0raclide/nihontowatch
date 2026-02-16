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
        <aside className="hidden lg:block w-[264px] flex-shrink-0">
          <div className="bg-surface-elevated rounded-2xl border border-border/40 overflow-hidden"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)' }}>
            {/* Sort + Region */}
            <div className="px-4 pt-3.5 pb-3 border-b border-border/15 space-y-2.5">
              <div className="h-5 w-24 mx-auto img-loading rounded" />
              <div className="flex rounded-lg border border-border/30 overflow-hidden">
                <div className="flex-1 h-8 img-loading" />
                <div className="flex-1 h-8 img-loading" />
                <div className="flex-1 h-8 img-loading" />
              </div>
            </div>
            {/* Filter header */}
            <div className="px-4 py-2 border-b border-border/10">
              <div className="h-3 w-12 img-loading rounded" />
            </div>
            {/* Search */}
            <div className="px-4 py-2">
              <div className="h-7 w-full img-loading rounded-md" />
            </div>
            {/* Inventory Type section */}
            <div className="border-t border-border/10 px-4 py-2.5 space-y-2">
              <div className="h-3 w-24 img-loading rounded" />
              <div className="space-y-1.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-3 w-3 img-loading rounded-sm" />
                    <div className="h-3 flex-1 img-loading rounded" style={{ maxWidth: `${80 - i * 12}%` }} />
                    <div className="h-3 w-4 img-loading rounded" />
                  </div>
                ))}
              </div>
            </div>
            {/* Certification section */}
            <div className="border-t border-border/10 px-4 py-2.5 space-y-2">
              <div className="h-3 w-20 img-loading rounded" />
              <div className="space-y-1.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-3 w-3 img-loading rounded-sm" />
                    <div className="h-3 flex-1 img-loading rounded" style={{ maxWidth: `${70 - i * 10}%` }} />
                    <div className="h-3 w-4 img-loading rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
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
