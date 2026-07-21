import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@/lib/types";

type NotificationsWidgetProps = {
  notifications: Notification[];
};

export function NotificationsWidget({ notifications }: NotificationsWidgetProps) {
  const recent = notifications.slice(0, 3);
  const unread = recent.filter((n) => !n.read_at).length;

  return (
    <section
      className="hb-bento-card"
      style={{ gridColumn: "span 4", gridRow: "span 1", animationDelay: "300ms" }}
    >
      <div className="hb-bento-head">
        <div className="flex items-center gap-2">
          <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(220,38,38,0.18), rgba(220,38,38,0.04))", color: "var(--hb-red)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Reminders
          </h2>
          {unread > 0 && (
            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
              {unread} new
            </span>
          )}
        </div>
        <Link
          href="/notifications"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
        >
          View all
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="flex h-[calc(100%-44px)] flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            You&apos;re all caught up
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-200">
            No new reminders
          </p>
        </div>
      ) : (
        <ul className="-mx-1 space-y-1">
          {recent.map((n, i) => (
            <li
              key={n.id}
              className={`hb-snippet ${!n.read_at ? "hb-snippet--unread" : ""}`}
              style={{ animationDelay: `${320 + i * 50}ms` }}
            >
              <div
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  n.read_at
                    ? "bg-slate-300 dark:bg-slate-600"
                    : "bg-amber-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {n.title}
                </div>
                <div className="line-clamp-1 text-xs text-slate-700 dark:text-slate-300">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
