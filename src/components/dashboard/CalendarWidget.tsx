import Link from "next/link";
import { format, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, parseISO } from "date-fns";
import type { Post } from "@/lib/types";
import { getTodayString } from "@/lib/time";

type CalendarWidgetProps = {
  posts: Post[];
};

export function CalendarWidget({ posts }: CalendarWidgetProps) {
  const todayStr = getTodayString();
  const today = parseISO(todayStr);
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
    (p) => p.due_at && p.due_at.startsWith(todayStr.slice(0, 7)),
  ).length;

  return (
    <section aria-labelledby="calendar-heading" className="hb-card-surface p-5">
      <header className="mb-2 flex items-baseline justify-between gap-4">
        <h2 id="calendar-heading" className="hb-card-section text-sm">
          {format(today, "MMMM yyyy")}
        </h2>
        <Link
          href="/calendar"
          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Open calendar
        </Link>
      </header>
      <p className="hb-card-meta mb-3 text-xs">{totalThisMonth} due this month</p>

      <div className="hb-mini-cal">
        {["M", "T", "W", "T", "F", "S", "S"].map((label, i) => (
          <div key={i} className="hb-mini-cal-head">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthStart);
          const isToday = key === todayStr;
          const count = dueByDay.get(key) ?? 0;
          const cellClass = !inMonth
            ? "hb-mini-cal-cell--out"
            : isToday
              ? "hb-mini-cal-cell--today" +
                (count > 0 ? " hb-mini-cal-cell--has-due" : "")
              : count > 0
                ? "hb-mini-cal-cell--has-due"
                : "";
          return (
            <Link
              href={"/calendar?month=" + format(day, "yyyy-MM")}
              key={key}
              className={"hb-mini-cal-cell hb-mini-cal-cell--link " + cellClass}
              title={count > 0 ? count + " due" : undefined}
            >
              <span className="hb-mini-cal-num">{format(day, "d")}</span>
              {count > 0 && <span className="hb-mini-cal-dot" />}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
