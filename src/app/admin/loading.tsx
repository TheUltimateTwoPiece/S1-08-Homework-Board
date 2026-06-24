export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-10 w-full animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-32 w-full animate-pulse rounded bg-slate-200" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-10 w-full animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-32 w-full animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
