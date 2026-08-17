import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatAppDateOnly, getTodayString } from "@/lib/time";
import type { Post } from "@/lib/types";

type UpcomingWidgetProps = { posts: Post[] };

export function UpcomingWidget({ posts }: UpcomingWidgetProps) {
  const todayStr = getTodayString();
  const upcoming = posts
    .filter((p) => p.due_at && p.due_at >= todayStr)
    .slice(0, 4);

  return (
    <section aria-labelledby="upcoming-heading" className="hb-card-surface p-5">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="upcoming-heading" className="hb-card-section text-sm">
          Upcoming
        </h2>
        <Link
          href="/calendar"
          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Calendar
        </Link>
      </header>

      {upcoming.length === 0 ? (
        <p className="hb-card-meta text-sm">Nothing due in the next few days.</p>
      ) : (
        <ul className="space-y-2.5">
          {upcoming.map((post) => {
            const dueAt = post.due_at as string;
            const due = parseISO(dueAt);
            const daysUntil = differenceInCalendarDays(due, parseISO(todayStr));
            const today = daysUntil === 0;
            return (
              <li key={post.id} className="flex items-start gap-3">
                <div
                  className={
                    "mt-0.5 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md text-center leading-none " +
                    (today
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-[var(--hb-surface-hover)]")
                  }
                >
                  <span className="text-[10px] font-semibold uppercase">
                    {formatAppDateOnly(dueAt, { month: "short" })}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold">
                    {formatAppDateOnly(dueAt, { day: "numeric" })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={"/posts/" + post.id}
                    className="hb-card-section block truncate text-sm hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {post.title}
                  </Link>
                  <p
                    className={
                      "mt-0.5 text-xs font-medium " +
                      (today
                        ? "text-amber-700 dark:text-amber-400"
                        : "hb-card-meta")
                    }
                  >
                    {today
                      ? "Due today"
                      : daysUntil === 1
                        ? "Tomorrow"
                        : `In ${daysUntil} days`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
