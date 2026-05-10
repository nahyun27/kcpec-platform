export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Page header skeleton */}
      <div className="bg-white border-b border-slate-200/60 pb-8 pt-12 shadow-sm">
        <div className="mx-auto max-w-6xl px-6 space-y-6">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-9 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
          <div className="flex flex-wrap gap-3 pt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-20 animate-pulse rounded-full bg-slate-100"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Card grid skeleton */}
      <div className="mx-auto max-w-6xl px-6 pt-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm"
            >
              <div className="aspect-video w-full animate-pulse bg-slate-200" />
              <div className="space-y-3 p-6">
                <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-1/2 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-5">
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
