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

  return (
    <section
      className="hb-bento-card"
      style={{ gridColumn: "span 4", gridRow: "span 1", animationDelay: "180ms" }}
    >
      <div className="hb-bento-head">
        <div className="flex items-center gap-2">
          <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(22,163,74,0.18), rgba(22,163,74,0.04))", color: "var(--hb-success)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Your progress
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-[88px_1fr] items-center gap-4">
        <div
          className="hb-stat-ring"
          style={{ ["--hb-stat-pct" as string]: `${safePct}` } as React.CSSProperties}
        >
          <span className="hb-stat-ring-bg" />
          <span className="hb-stat-ring-fill" />
          <span className="hb-stat-ring-label">{safePct}%</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between rounded-md bg-emerald-50 px-2 py-1.5 dark:bg-emerald-900/30">
            <span className="font-medium text-emerald-700 dark:text-emerald-300">Done</span>
            <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {completedCount}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-900/30">
            <span className="font-medium text-amber-700 dark:text-amber-300">Upcoming</span>
            <span className="text-base font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {upcomingCount}
            </span>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center justify-between rounded-md bg-rose-50 px-2 py-1.5 dark:bg-rose-900/30">
              <span className="font-medium text-rose-700 dark:text-rose-300">Overdue</span>
              <span className="text-base font-bold tabular-nums text-rose-700 dark:text-rose-300">
                {overdueCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
