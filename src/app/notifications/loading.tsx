export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="hb-skeleton h-8 w-32 rounded-lg" />
          <div className="hb-skeleton mt-2 h-4 w-64 rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="hb-skeleton h-6 w-1/2 rounded-lg" />
            <div className="hb-skeleton mt-3 h-4 w-full rounded-lg" />
            <div className="hb-skeleton mt-2 h-4 w-2/3 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
