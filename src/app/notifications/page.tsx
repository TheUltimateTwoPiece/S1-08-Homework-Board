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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="hb-text text-2xl font-bold">Reminders</h1>
          <p className="hb-text-muted mt-1 text-sm">
            {profile.role === "admin"
              ? "Homework reminders you receive appear here. Send reminders to students from the admin panel."
              : unreadCount > 0
                ? `${unreadCount} unread reminder${unreadCount === 1 ? "" : "s"} from your admin`
                : "You're all caught up — no new reminders"}
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <PendingButton
              type="submit"
              pendingContent="Saving..."
              className="hb-action-link flex items-center gap-2 text-sm font-medium"
            >
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
              className={`hb-card p-5 ${
                notification.read_at ? "" : "hb-card--unread"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    {!notification.read_at && (
                      <span className="hb-badge-new rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        New
                      </span>
                    )}
                    <h2 className="hb-text font-semibold">
                      {notification.title}
                    </h2>
                  </div>
                  <p className="hb-text-muted text-sm leading-relaxed">
                    {notification.message}
                  </p>
                  <time
                    className="hb-text-subtle mt-2 block text-xs"
                    dateTime={notification.created_at}
                  >
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                    })}
                  </time>
                </div>

                {!notification.read_at && (
                  <form action={markNotificationRead}>
                    <input
                      type="hidden"
                      name="notificationId"
                      value={notification.id}
                    />
                    <PendingButton
                      type="submit"
                      pendingContent="Saving..."
                      className="hb-action-link flex shrink-0 items-center gap-2 text-xs font-medium"
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
        <div className="hb-card border-dashed p-12 text-center">
          <p className="hb-text-muted">No reminders yet.</p>
          {profile.role === "student" && (
            <p className="hb-text-subtle mt-2 text-sm">
              When an admin sends a homework reminder, it will show up here
              and on the bell icon in the header.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
