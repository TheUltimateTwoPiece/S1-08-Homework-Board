export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="hb-skeleton h-8 w-48 rounded-lg" />
        <div className="hb-skeleton mt-2 h-4 w-64 rounded-lg" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="hb-skeleton h-5 w-5 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <div className="hb-skeleton mb-3 h-5 w-3/4 rounded-lg" />
                <div className="hb-skeleton h-3 w-1/3 rounded-lg" />
                <div className="hb-skeleton mt-3 h-3 w-full rounded-lg" />
                <div className="hb-skeleton mt-2 h-3 w-2/3 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
