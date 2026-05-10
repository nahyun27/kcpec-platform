export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Top nav skeleton */}
      <div className="border-b border-slate-200/60 bg-white/80 sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        </div>
      </div>

      {/* Hero skeleton */}
      <section className="bg-white border-b border-slate-200/60 pt-10 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
              <div className="space-y-3">
                <div className="h-10 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-10 w-1/2 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-5 w-5/6 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="flex gap-6 pt-4">
                <div className="h-10 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-10 w-32 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
            <div className="aspect-video w-full animate-pulse rounded-3xl bg-slate-200" />
          </div>
        </div>
      </section>

      {/* Body skeleton — left main / right sidebar */}
      <div className="mx-auto max-w-6xl px-6 pt-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-10">
            <div className="space-y-4">
              <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 w-full animate-pulse rounded bg-slate-100"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-5">
              <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
              <div className="space-y-3">
                <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
