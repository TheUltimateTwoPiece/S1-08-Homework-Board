import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { markAllNotificationsRead } from "@/actions/notifications";
import { PendingButton } from "@/components/PendingButton";
import { NotificationCard } from "@/components/NotificationCard";
import type { Notification } from "@/lib/types";

export const revalidate = 15;

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select(
      "id, user_id, title, message, created_by, read_at, created_at, email_sent_at, email_message_id, email_error",
    )
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
                : "You're all caught up — no new reminders"}
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
            <NotificationCard
              key={notification.id}
              id={notification.id}
              title={notification.title}
              message={notification.message}
              readAt={notification.read_at}
              createdAt={notification.created_at}
              isAdmin={profile.role === "admin"}
              emailSentAt={notification.email_sent_at}
              emailMessageId={notification.email_message_id}
              emailError={notification.email_error}
            />
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

