import Link from "next/link";
import { format, formatDistanceToNow, isToday, parseISO } from "date-fns";
import type { Post } from "@/lib/types";

type UpcomingWidgetProps = { posts: Post[]; };

export function UpcomingWidget({ posts }: UpcomingWidgetProps) {
  const upcoming = posts
    .filter((p) => p.due_at && p.due_at >= format(new Date(), "yyyy-MM-dd"))
    .slice(0, 4);

  return (
    <section
      className="hb-bento-card hb-bento-card--clickable group relative bg-white dark:bg-slate-800"
      style={{ gridColumn: "span 4", gridRow: "span 1", animationDelay: "240ms" }}
    >
      <div className="hb-bento-head relative z-[1]">
        <div className="flex items-center gap-2">
          <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.18), rgba(217,119,6,0.04))", color: "#b45309" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-sm font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">Upcoming deadlines</h2>
        </div>
        <span className="rounded-md px-2 py-1 text-[11px] font-bold text-blue-700 transition group-hover:bg-blue-100 dark:text-blue-400 dark:group-hover:bg-blue-900/40">
          Calendar →
        </span>
      </div>

      {upcoming.length === 0 ? (
        <div className="flex h-[calc(100%-44px)] items-center justify-center text-center">
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Nothing on the horizon</p>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Enjoy the breathing room ✨</p>
          </div>
        </div>
      ) : (
        <ul className="-mx-1 space-y-1 pb-5">
          {upcoming.map((post, i) => {
            const due = parseISO(post.due_at as string);
            const today = isToday(due);
            return (
              <li key={post.id} className="hb-snippet relative z-[3]" style={{ animationDelay: (260 + i * 40) + "ms" }}>
                <div className={"flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-extrabold " + (today ? "bg-amber-200 text-amber-900 dark:bg-amber-800/60 dark:text-amber-50" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100")}>
                  <span className="leading-none">{format(due, "MMM")}</span>
                  <span className="text-sm font-extrabold leading-tight">{format(due, "d")}</span>
                </div>
                <Link href={"/posts/" + post.id} className="min-w-0 flex-1 relative z-[3]">
                  <div className="line-clamp-1 text-sm font-bold text-zinc-950 dark:text-zinc-50">{post.title}</div>
                  <div className={"text-[11px] font-bold " + (today ? "text-amber-800 dark:text-amber-300" : "text-zinc-700 dark:text-zinc-300")}>
                    {today ? "Today" : formatDistanceToNow(due, { addSuffix: true })}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/calendar" className="absolute inset-0 z-[1] rounded-[inherit]" tabIndex={-1} aria-hidden="true" aria-label="Open calendar" />
    </section>
  );
}
