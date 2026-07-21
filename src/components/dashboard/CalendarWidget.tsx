import Link from "next/link";
import {
  format,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
} from "date-fns";
import type { Post } from "@/lib/types";

type CalendarWidgetProps = {
  posts: Post[];
};

export function CalendarWidget({ posts }: CalendarWidgetProps) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dueByDay = new Map<string, number>();
  for (const post of posts) {
    if (!post.due_at) continue;
    dueByDay.set(post.due_at, (dueByDay.get(post.due_at) ?? 0) + 1);
  }

  const days: Date[] = [];
  for (let day = rangeStart; day <= rangeEnd; day = addDays(day, 1)) {
    days.push(day);
  }

  const totalThisMonth = posts.filter(
    (p) => p.due_at && p.due_at.startsWith(format(today, "yyyy-MM")),
  ).length;

  return (
    <section
      className="hb-bento-card"
      style={{ gridColumn: "span 5", gridRow: "span 2", animationDelay: "120ms" }}
    >
      <div className="hb-bento-head">
        <div className="flex items-center gap-3">
          <div className="hb-bento-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Calendar
            </h2>
            <p className="text-xs text-slate-700 dark:text-slate-300">
              {format(today, "MMMM yyyy")} · {totalThisMonth} due
            </p>
          </div>
        </div>
        <Link
          href="/calendar"
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
        >
          Expand
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      <div className="hb-mini-cal">
        {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
          <div key={i} className="hb-mini-cal-head">{label}</div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthStart);
          const isToday = key === todayStr;
          const count = dueByDay.get(key) ?? 0;
          const cellClass = !inMonth
            ? "hb-mini-cal-cell--out"
            : isToday
              ? "hb-mini-cal-cell--today"
              : count > 0
                ? "hb-mini-cal-cell--has-due"
                : "";
          return (
            <Link
              href={`/calendar?month=${format(day, "yyyy-MM")}`}
              key={key}
              className={`hb-mini-cal-cell ${cellClass}`}
              title={count > 0 ? `${count} due` : undefined}
            >
              <span>{format(day, "d")}</span>
              {count > 0 && <span className="hb-mini-cal-dot" />}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
