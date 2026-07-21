import Link from "next/link";


type StatsWidgetProps = {
  totalPosts: number;
  completedCount: number;
  upcomingCount: number;
  overdueCount: number;
  
};

export function StatsWidget({
  totalPosts,
  completedCount,
  upcomingCount,
  overdueCount,
}: StatsWidgetProps) {
  const pct =
    totalPosts === 0 ? 0 : Math.round((completedCount / totalPosts) * 100);
  const safePct = Math.min(100, Math.max(0, pct));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safePct / 100);

  return (
    <section
      className="hb-bento-card hb-bento-card--clickable group relative overflow-hidden bg-white dark:bg-slate-800"
      style={{
        gridColumn: "span 4",
        gridRow: "span 1",
        animationDelay: "180ms",
      }}
    >
      <div className="hb-bento-head relative z-[1]">
        <div className="flex items-center gap-2">
          <div
            className="hb-bento-icon-box"
            style={{
              background:
                "linear-gradient(135deg, rgba(22,163,74,0.18), rgba(22,163,74,0.04))",
              color: "#15803d",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h2 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-200">
            Your progress
          </h2>
        </div>
        <span className="rounded-md px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition group-hover:bg-blue-100 dark:text-blue-400 dark:group-hover:bg-blue-900/40">
          View →
        </span>
      </div>

      <div className="grid grid-cols-[96px_1fr] items-center gap-4">
        <div className="relative flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="hb-progress-ring h-24 w-24" aria-hidden="true">
            <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className="text-zinc-200 dark:text-slate-600" stroke="currentColor" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="url(#hb-progress-grad)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="hb-progress-stroke"
            />
            <defs>
              <linearGradient id="hb-progress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-200">
              {safePct}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-700">%</span>
            </span>
          </div>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between rounded-md bg-emerald-50 px-2 py-1.5 dark:bg-emerald-900/30">
            <span className="font-bold text-emerald-800 dark:text-emerald-200">Done</span>
            <span className="text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-100">{completedCount}</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-900/30">
            <span className="font-bold text-amber-800 dark:text-amber-200">Upcoming</span>
            <span className="text-base font-bold tabular-nums text-amber-800 dark:text-amber-100">{upcomingCount}</span>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center justify-between rounded-md bg-rose-50 px-2 py-1.5 dark:bg-rose-900/30">
              <span className="font-bold text-rose-800 dark:text-rose-200">Overdue</span>
              <span className="text-base font-bold tabular-nums text-rose-800 dark:text-rose-100">{overdueCount}</span>
            </div>
          )}
        </div>
      </div>

      <Link href="/posts" className="absolute inset-0 z-[2] rounded-[inherit]" tabIndex={-1} aria-hidden="true" aria-label="View all homework" />
    </section>
  );
}
