export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="hb-skeleton h-8 w-32 animate-pulse rounded" />
          <div className="hb-skeleton mt-2 h-4 w-64 animate-pulse rounded" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="hb-card p-5">
            <div className="hb-skeleton h-6 w-1/2 animate-pulse rounded" />
            <div className="hb-skeleton mt-3 h-4 w-full animate-pulse rounded" />
            <div className="hb-skeleton mt-2 h-4 w-2/3 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
