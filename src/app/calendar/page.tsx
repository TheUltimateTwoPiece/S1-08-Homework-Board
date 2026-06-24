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
        <h1 className="hb-text text-2xl font-bold">Homework calendar</h1>
        <Link href="/" className="hb-link text-sm font-medium">
          Back to posts
        </Link>
      </div>

      <div className="hb-card mb-6 flex items-center justify-between gap-3 p-4">
        <Link href={`/calendar?month=${prevMonth}`} className="hb-link text-sm font-medium">
          ← {format(addMonths(monthStart, -1), "MMM yyyy")}
        </Link>
        <div className="hb-text text-sm font-semibold">
          {format(monthStart, "MMMM yyyy")}
        </div>
        <Link href={`/calendar?month=${nextMonth}`} className="hb-link text-sm font-medium">
          {format(addMonths(monthStart, 1), "MMM yyyy")} →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div key={label} className="hb-text-subtle px-2 text-xs font-semibold uppercase tracking-wide">
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = byDay[key] ?? [];
          const inMonth = isSameMonth(day, monthStart);

          return (
            <div
              key={key}
              className={`hb-card min-h-28 p-3 ${inMonth ? "" : "opacity-50"}`}
            >
              <div className="hb-text-subtle mb-2 text-xs font-semibold">
                {format(day, "d")}
              </div>
              {items.length > 0 && (
                <ul className="space-y-1">
                  {items.slice(0, 3).map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/posts/${post.id}`}
                        className="hb-link line-clamp-2 text-xs font-medium"
                      >
                        {post.title}
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && (
                    <li className="hb-text-subtle text-xs">
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

