import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@/lib/types";

type NotificationsWidgetProps = { notifications: Notification[] };

export function NotificationsWidget({ notifications }: NotificationsWidgetProps) {
  const recent = notifications.slice(0, 3);

  return (
    <section aria-labelledby="reminders-heading" className="hb-card-surface p-5">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="reminders-heading" className="hb-card-section text-sm">
          Reminders
        </h2>
        <Link
          href="/notifications"
          className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all
        </Link>
      </header>

      {recent.length === 0 ? (
        <p className="hb-card-meta text-sm">No reminders yet.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((n) => (
            <li key={n.id} className="flex items-start gap-2.5">
              <span
                className={
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full " +
                  (n.read_at ? "bg-zinc-300 dark:bg-stone-600" : "bg-amber-500")
                }
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="hb-card-section truncate text-sm">{n.title}</p>
                <p className="hb-card-meta truncate text-xs">
                  {formatDistanceToNow(new Date(n.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              {!n.read_at && (
                <span className="hb-card-meta shrink-0 text-[11px]">new</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
