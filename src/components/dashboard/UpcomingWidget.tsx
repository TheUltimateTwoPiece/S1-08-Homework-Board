import Link from "next/link";
import { DueDateLabel } from "@/components/DueDateLabel";
import { formatAppDateOnly, APP_TIME_ZONE } from "@/lib/time";
import { getDueState } from "@/lib/due";
import type { Post } from "@/lib/types";

type UpcomingWidgetProps = { posts: Post[] };

export function UpcomingWidget({ posts }: UpcomingWidgetProps) {
  const upcoming = posts
    .filter((p) => p.due_at && getDueState(p.due_at, p.due_time)?.kind !== "overdue")
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
            const state = getDueState(dueAt, post.due_time);
            const today = state?.kind === "today";
            const overdue = state?.kind === "overdue";
            return (
              <li key={post.id} className="flex items-start gap-3">
                <div
                  className={
                    "mt-0.5 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md text-center leading-none " +
                    (today
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      : overdue
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
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
                  <DueDateLabel
                    dueAt={dueAt}
                    dueTime={post.due_time}
                    timeZone={APP_TIME_ZONE}
                    className={
                      "mt-0.5 block text-xs font-medium " +
                      (today
                        ? "text-amber-700 dark:text-amber-400"
                        : overdue
                          ? "text-rose-700 dark:text-rose-400"
                          : "hb-card-meta")
                    }
                    countdownClassName="ml-1 opacity-80"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
