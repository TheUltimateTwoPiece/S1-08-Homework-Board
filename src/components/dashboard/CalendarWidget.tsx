import Link from "next/link";
import { format, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
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

  const totalThisMonth = posts.filter((p) => p.due_at && p.due_at.startsWith(format(today, "yyyy-MM"))).length;

  return (
    <section
      className="hb-bento-card hb-bento-card--clickable group relative bg-white dark:bg-slate-800"
      style={{ gridColumn: "span 5", gridRow: "span 2", animationDelay: "120ms" }}
    >
      <div className="hb-bento-head relative z-[1]">
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
            <h2 className="text-base font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">Calendar</h2>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{format(today, "MMMM yyyy")} · {totalThisMonth} due</p>
          </div>
        </div>
        <span className="rounded-md px-2.5 py-1.5 text-xs font-bold text-blue-700 transition group-hover:bg-blue-100 dark:text-blue-400 dark:group-hover:bg-blue-900/40">
          Expand →
        </span>
      </div>

      <div className="hb-mini-cal relative z-[1]">
        {["M","T","W","T","F","S","S"].map((label, i) => (
          <div key={i} className="hb-mini-cal-head">{label}</div>
        ))}
        {days.map((day, idx) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthStart);
          const isToday = key === todayStr;
          const count = dueByDay.get(key) ?? 0;
          const cellClass = !inMonth ? "hb-mini-cal-cell--out" : isToday ? "hb-mini-cal-cell--today" : count > 0 ? "hb-mini-cal-cell--has-due" : "";
          return (
            <Link
              href={"/calendar?month=" + format(day, "yyyy-MM")}
              key={key}
              className={"hb-mini-cal-cell hb-mini-cal-cell--link " + cellClass}
              title={count > 0 ? count + " due" : undefined}
              style={{ animationDelay: (200 + idx * 10) + "ms" }}
            >
              <span>{format(day, "d")}</span>
              {count > 0 && <span className="hb-mini-cal-dot" />}
            </Link>
          );
        })}
      </div>

      <Link href="/calendar" className="absolute inset-0 z-[2] rounded-[inherit]" tabIndex={-1} aria-hidden="true" aria-label="Open calendar" />
    </section>
  );
}
