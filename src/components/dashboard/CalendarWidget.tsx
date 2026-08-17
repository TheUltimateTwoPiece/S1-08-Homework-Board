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

  const totalThisMonth = posts.filter((p) => p.due_at && p.due_at.startsWith(todayStr.slice(0, 7))).length;

  return (
    <section
      className="hb-bento-card hb-bento-card--clickable relative "
      style={{ gridColumn: "span 5", gridRow: "span 2", animationDelay: "80ms" }}
    >
      <div className="hb-bento-head relative z-[1]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hb-bento-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="hb-card-section hb-truncate text-base tracking-tight">Calendar</h2>
            <p className="hb-card-body hb-truncate text-xs font-semibold">{format(today, "MMMM yyyy")} · {totalThisMonth} due</p>
          </div>
        </div>
      </div>

      {/* z-[3] keeps day links above the full-card overlay link (z-[2])
          so individual days stay clickable while the header still opens
          the full calendar. */}
      <div className="hb-mini-cal relative z-[3]">
        {["M","T","W","T","F","S","S"].map((label, i) => (
          <div key={i} className="hb-mini-cal-head">{label}</div>
        ))}
        {days.map((day, idx) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthStart);
          const isToday = key === todayStr;
          const count = dueByDay.get(key) ?? 0;
          // Today can also carry the has-due class so the amber indicator
          // dot shows, while the CSS keeps the filled-blue pill emphasis.
          const cellClass = !inMonth
            ? "hb-mini-cal-cell--out"
            : isToday
              ? "hb-mini-cal-cell--today" + (count > 0 ? " hb-mini-cal-cell--has-due" : "")
              : count > 0
                ? "hb-mini-cal-cell--has-due"
                : "";
          return (
            <Link
              href={"/calendar?month=" + format(day, "yyyy-MM")}
              key={key}
              className={"hb-mini-cal-cell hb-mini-cal-cell--link " + cellClass}
              title={count > 0 ? count + " due" : undefined}
              style={{ animationDelay: (140 + idx * 6) + "ms" }}
            >
              <span className="hb-mini-cal-num">{format(day, "d")}</span>
              {count > 0 && <span className="hb-mini-cal-dot" />}
            </Link>
          );
        })}
      </div>

      <Link href="/calendar" className="absolute inset-0 z-[2] rounded-[inherit]" tabIndex={-1} aria-hidden="true" aria-label="Open calendar" />
    </section>
  );
}
