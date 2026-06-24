import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import type { Notification } from "@/lib/types";
import { unstable_cache } from "next/cache";

export const revalidate = 15;

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const getCachedNotifications = unstable_cache(
    async (userId: string) => {
      return await supabase
        .from("notifications")
        .select("id, user_id, title, message, created_by, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    },
    ["notifications"],
    { revalidate: 15, tags: ["notifications"] }
  );

  const { data: notifications } = await getCachedNotifications(profile.id);

  const unreadCount =
    notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reminders</h1>
          <p className="mt-1 text-sm text-slate-600">
            {profile.role === "admin"
              ? "Homework reminders you receive appear here. Send reminders to students from the admin panel."
              : unreadCount > 0
                ? `${unreadCount} unread reminder${unreadCount === 1 ? "" : "s"} from your admin`
                : "You're all caught up — no new reminders"}
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {notifications && notifications.length > 0 ? (
        <ul className="space-y-3">
          {(notifications as Notification[]).map((notification) => (
            <li
              key={notification.id}
              className={`rounded-xl border p-5 ${
                notification.read_at
                  ? "border-slate-200 bg-white"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    {!notification.read_at && (
                      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                        New
                      </span>
                    )}
                    <h2 className="font-semibold text-slate-900">
                      {notification.title}
                    </h2>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {notification.message}
                  </p>
                  <time
                    className="mt-2 block text-xs text-slate-500"
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
                    <button
                      type="submit"
                      className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Mark read
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">No reminders yet.</p>
          {profile.role === "student" && (
            <p className="mt-2 text-sm text-slate-500">
              When an admin sends a homework reminder, it will show up here
              and on the bell icon in the header.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
