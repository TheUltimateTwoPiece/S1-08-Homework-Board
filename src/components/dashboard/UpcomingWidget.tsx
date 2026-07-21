import Link from "next/link";
import { format, formatDistanceToNow, isToday, parseISO } from "date-fns";
import type { Post } from "@/lib/types";

type UpcomingWidgetProps = {
  posts: Post[];
};

export function UpcomingWidget({ posts }: UpcomingWidgetProps) {
  const upcoming = posts
    .filter((p) => p.due_at && p.due_at >= format(new Date(), "yyyy-MM-dd"))
    .slice(0, 4);

  return (
    <section
      className="hb-bento-card"
      style={{ gridColumn: "span 4", gridRow: "span 1", animationDelay: "240ms" }}
    >
      <div className="hb-bento-head">
        <div className="flex items-center gap-2">
          <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.18), rgba(217,119,6,0.04))", color: "var(--hb-warning)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Upcoming deadlines
          </h2>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex h-[calc(100%-44px)] items-center justify-center text-center">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Nothing on the horizon
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Enjoy the breathing room ✨
            </p>
          </div>
        </div>
      ) : (
        <ul className="-mx-1 space-y-1">
          {upcoming.map((post, i) => {
            const due = parseISO(post.due_at as string);
            const today = isToday(due);
            return (
              <li
                key={post.id}
                className="hb-snippet"
                style={{ animationDelay: `${260 + i * 40}ms` }}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-bold ${
                    today
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="leading-none">{format(due, "MMM")}</span>
                  <span className="text-sm font-bold leading-tight">
                    {format(due, "d")}
                  </span>
                </div>
                <Link href={`/posts/${post.id}`} className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {post.title}
                  </div>
                  <div className={`text-[11px] ${today ? "font-semibold text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                    {today
                      ? "Today"
                      : formatDistanceToNow(due, { addSuffix: true })}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
