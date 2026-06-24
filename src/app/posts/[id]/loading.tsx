export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="hb-skeleton mb-6 h-4 w-24 animate-pulse rounded" />
      <div className="hb-card p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="hb-skeleton h-5 w-5 animate-pulse rounded" />
            <div className="hb-skeleton h-8 w-3/4 animate-pulse rounded" />
          </div>
        </div>
        <div className="mb-6 flex gap-3">
          <div className="hb-skeleton h-4 w-24 animate-pulse rounded" />
          <div className="hb-skeleton h-4 w-4 animate-pulse rounded" />
        </div>
        <div className="space-y-2">
          <div className="hb-skeleton h-4 w-full animate-pulse rounded" />
          <div className="hb-skeleton h-4 w-full animate-pulse rounded" />
          <div className="hb-skeleton h-4 w-2/3 animate-pulse rounded" />
        </div>
      </div>
      <div className="mt-8">
        <div className="hb-skeleton mb-4 h-6 w-32 animate-pulse rounded" />
        <div className="hb-card mb-6 p-5">
          <div className="hb-skeleton h-24 w-full animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
