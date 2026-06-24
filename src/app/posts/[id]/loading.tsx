export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 h-4 w-24 animate-pulse rounded bg-slate-200" />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="h-5 w-5 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
        <div className="mb-6 flex gap-3">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-8">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="h-24 w-full animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
