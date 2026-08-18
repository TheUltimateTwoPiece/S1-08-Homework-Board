import Link from "next/link";
import type { CSSProperties } from "react";

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
  const barStyle = { "--hb-bar-target": safePct / 100 } as CSSProperties;

  return (
    <section aria-labelledby="progress-heading" className="hb-progress-widget hb-card-surface p-5">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="progress-heading" className="hb-card-section text-sm">
          Your progress
        </h2>
        <Link
          href="/your-progress"
          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Details
        </Link>
      </header>

      <div
        className="hb-progress-mobile-ring"
        style={{ "--hb-progress": safePct } as CSSProperties}
        aria-hidden="true"
      >
        <span>{safePct}</span>
        <small>%</small>
      </div>

      <div className="hb-progress-widget-details">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="hb-card-meta text-sm">
            {completedCount} of {totalPosts} completed
          </span>
          <span className="text-sm font-semibold tabular-nums">{safePct}%</span>
        </div>

        <div
          className="hb-bar-track"
          role="progressbar"
          aria-valuenow={safePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall homework completion"
        >
          <div className="hb-bar-fill" style={barStyle} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-[var(--hb-surface-hover)] px-3 py-2">
            <dt className="hb-card-meta text-xs">Done</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {completedCount}
            </dd>
          </div>
          <div className="rounded-md bg-[var(--hb-surface-hover)] px-3 py-2">
            <dt className="hb-card-meta text-xs">Upcoming</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {upcomingCount}
            </dd>
          </div>
          <div
            className={
              "col-span-2 rounded-md px-3 py-2 " +
              (overdueCount > 0
                ? "bg-rose-50 dark:bg-rose-900/30"
                : "bg-[var(--hb-surface-hover)]")
            }
          >
            <dt className="hb-card-meta text-xs">Overdue</dt>
            <dd
              className={
                "mt-0.5 font-semibold tabular-nums " +
                (overdueCount > 0
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-foreground")
              }
            >
              {overdueCount}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
