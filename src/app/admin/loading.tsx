export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="hb-skeleton h-8 w-32 animate-pulse rounded" />
        <div className="hb-skeleton mt-2 h-4 w-80 animate-pulse rounded" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="hb-card p-5">
          <div className="hb-skeleton h-6 w-40 animate-pulse rounded" />
          <div className="hb-skeleton mt-4 h-10 w-full animate-pulse rounded" />
          <div className="hb-skeleton mt-4 h-32 w-full animate-pulse rounded" />
        </div>
        <div className="hb-card p-5">
          <div className="hb-skeleton h-6 w-32 animate-pulse rounded" />
          <div className="hb-skeleton mt-4 h-10 w-full animate-pulse rounded" />
          <div className="hb-skeleton mt-4 h-32 w-full animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
