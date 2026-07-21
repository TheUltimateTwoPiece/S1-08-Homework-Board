import Link from "next/link";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

type CalendarPageProps = {
  searchParams: Promise<{ month?: string }>;
};

export const revalidate = 30;

function getMonthValue(date: Date): string {
  return format(date, "yyyy-MM");
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  await requireProfile();
  const params = await searchParams;
  const monthParam = (params.month ?? "").trim();

  const monthDate =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? parseISO(`${monthParam}-01`)
      : new Date();

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, due_at, subject, pinned")
    .not("due_at", "is", null)
    .gte("due_at", startStr)
    .lte("due_at", endStr)
    .order("due_at", { ascending: true });

  const byDay = (posts ?? []).reduce(
    (acc, post) => {
      const key = post.due_at as string | null;
      if (!key) return acc;
      acc[key] ??= [];
      acc[key].push(post);
      return acc;
    },
    {} as Record<
      string,
      { id: string; title: string; subject: string; pinned: boolean }[]
    >,
  );

  const days: Date[] = [];
  for (let day = rangeStart; day <= rangeEnd; day = addDays(day, 1)) {
    days.push(day);
  }

  const prevMonth = getMonthValue(addMonths(monthStart, -1));
  const nextMonth = getMonthValue(addMonths(monthStart, 1));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Homework calendar</h1>
        </div>
        <Link href="/" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 hover:text-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Posts
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link
          href={`/calendar?month=${prevMonth}`}
          className="hb-calendar-nav inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-blue-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {format(addMonths(monthStart, -1), "MMM")}
        </Link>
        <div className="text-base font-bold text-zinc-900">
          {format(monthStart, "MMMM yyyy")}
        </div>
        <Link
          href={`/calendar?month=${nextMonth}`}
          className="hb-calendar-nav inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-blue-600"
        >
          {format(addMonths(monthStart, 1), "MMM")}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div key={label} className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-200">
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = byDay[key] ?? [];
          const inMonth = isSameMonth(day, monthStart);
          const isToday = key === todayStr;

          return (
            <div
              key={key}
              className={`hb-calendar-cell relative min-h-28 rounded-xl border bg-white p-2.5 shadow-sm transition ${
                !inMonth ? "opacity-40" : ""
              } ${isToday ? "hb-calendar-cell--today" : "border-slate-200"} ${
                items.length > 0 ? "hb-calendar-cell--has-items" : ""
              }`}
            >
              <div className={`mb-1 flex items-center justify-between ${
                isToday ? "text-blue-700" : "text-slate-700 dark:text-slate-300"
              }`}>
                <span className="text-xs font-bold">
                  {format(day, "d")}
                </span>
                {isToday && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[8px] font-semibold text-blue-700">
                    Today
                  </span>
                )}
              </div>
              {items.length > 0 && (
                <ul className="space-y-1">
                  {items.slice(0, 3).map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/posts/${post.id}`}
                        className={`line-clamp-2 block rounded-md px-1.5 py-1 text-[10px] font-medium transition ${
                          post.pinned
                            ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {post.title}
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && (
                    <li className="px-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-200">
                      +{items.length - 3} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

