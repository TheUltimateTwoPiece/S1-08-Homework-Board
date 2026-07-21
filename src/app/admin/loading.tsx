export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="hb-skeleton h-8 w-32 rounded-lg" />
        <div className="hb-skeleton mt-2 h-4 w-80 rounded-lg" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="hb-skeleton h-6 w-40 rounded-lg" />
          <div className="hb-skeleton mt-4 h-10 w-full rounded-lg" />
          <div className="hb-skeleton mt-4 h-32 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="hb-skeleton h-6 w-32 rounded-lg" />
          <div className="hb-skeleton mt-4 h-10 w-full rounded-lg" />
          <div className="hb-skeleton mt-4 h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
