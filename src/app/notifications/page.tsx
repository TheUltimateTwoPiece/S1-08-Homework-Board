import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { PendingButton } from "@/components/PendingButton";
import type { Notification } from "@/lib/types";

export const revalidate = 15;

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, user_id, title, message, created_by, read_at, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const unreadCount =
    notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="hb-page-title text-2xl tracking-tight">Reminders</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="hb-body-text mt-1.5 text-sm">
            {profile.role === "admin"
              ? "Homework reminders you receive appear here. Send reminders to students from the admin panel."
              : unreadCount > 0
                ? `${unreadCount} unread reminder${unreadCount === 1 ? "" : "s"} from your admin`
                : "You&apos;re all caught up — no new reminders"}
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <PendingButton
              type="submit"
              pendingContent="Marking..."
              className="hb-section-title inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition hover:bg-slate-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Mark all as read
            </PendingButton>
          </form>
        )}
      </div>

      {notifications && notifications.length > 0 ? (
        <ul className="space-y-3">
          {(notifications as Notification[]).map((notification) => (
            <li
              key={notification.id}
              className={`hb-notification-item rounded-xl border bg-white p-5 shadow-sm ${
                notification.read_at ? "border-slate-200" : "hb-card--unread"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    {!notification.read_at && (
                      <span className="hb-badge-new inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        New
                      </span>
                    )}
                    <h2 className={`text-sm ${notification.read_at ? "hb-card-meta" : "hb-card-section"}`}>
                      {notification.title}
                    </h2>
                  </div>
                  <p className="hb-card-body text-sm leading-relaxed">
                    {notification.message}
                  </p>
                  <div className="hb-card-meta mt-3 flex items-center gap-2 text-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <time dateTime={notification.created_at}>
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </time>
                  </div>
                </div>

                {!notification.read_at && (
                  <form action={markNotificationRead} className="shrink-0">
                    <input
                      type="hidden"
                      name="notificationId"
                      value={notification.id}
                    />
                    <PendingButton
                      type="submit"
                      pendingContent="Marking..."
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                    >
                      Mark read
                    </PendingButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="hb-empty-state flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-slate-600" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p className="hb-section-title text-sm">No reminders yet</p>
          {profile.role === "student" && (
            <p className="hb-muted-text mt-1 max-w-xs text-xs">
              When an admin sends a homework reminder, it will show up here and on the bell icon in the header.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
