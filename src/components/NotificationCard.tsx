"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { markNotificationRead } from "@/actions/notifications";

type NotificationCardProps = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  isAdmin: boolean;
  emailSentAt: string | null;
  emailMessageId: string | null;
  emailError: string | null;
};

export function NotificationCard({
  id,
  title,
  message,
  readAt,
  createdAt,
  isAdmin,
  emailSentAt,
  emailMessageId,
  emailError,
}: NotificationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [markedLocally, setMarkedLocally] = useState(false);

  const isRead = Boolean(readAt) || markedLocally;

  const handleMarkRead = () => {
    if (isRead || isPending) return;
    // Optimistic: flip the banner to "read" immediately, then persist.
    setMarkedLocally(true);
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  };

  return (
    <li
      role={isRead ? "listitem" : "button"}
      tabIndex={isRead ? undefined : 0}
      aria-pressed={isRead ? undefined : false}
      onClick={handleMarkRead}
      onKeyDown={(e) => {
        if (!isRead && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleMarkRead();
        }
      }}
      title={!isRead ? "Click to mark as read" : undefined}
      className={`hb-notification-item group relative rounded-xl border p-5 shadow-sm transition-all duration-200 ${
        isRead
          ? "border-[var(--hb-border)] bg-[var(--hb-surface)]"
          : "hb-card--unread cursor-pointer select-none outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.995]"
      } ${isPending ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            {!isRead && (
              <span className="hb-badge-new inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                New
              </span>
            )}
            <h2 className={`text-sm ${isRead ? "hb-card-meta" : "hb-card-section"}`}>
              {title}
            </h2>
          </div>
          <p className="hb-card-body text-sm leading-relaxed">{message}</p>
          <div className="hb-card-meta mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {isAdmin && emailSentAt && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                title={`Brevo message id: ${emailMessageId ?? "unknown"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Emailed
              </span>
            )}
            {isAdmin && emailError && (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                title={emailError}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                Email failed
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <time dateTime={createdAt}>
                {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
              </time>
            </span>
          </div>
        </div>

        {!isRead && (
          <span
            aria-hidden="true"
            className="mt-0.5 hidden shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-blue-600 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:text-blue-400 sm:inline-flex"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark read
          </span>
        )}
      </div>
    </li>
  );
}
