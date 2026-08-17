"use client";

import { useActionState, useState } from "react";
import { sendAnnouncement } from "@/actions/announcements";

type AnnouncementResult = {
  success: boolean;
  error?: string;
  inAppCount?: number;
  emailedCount?: number;
  failedCount?: number;
  testMode?: boolean;
  testModeEmail?: string | null;
  errors?: string[];
};

export function AnnouncementForm() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [state, formAction, pending] = useActionState(
    async (
      _prev: AnnouncementResult | null,
      formData: FormData,
    ): Promise<AnnouncementResult | null> => {
      const result = (await sendAnnouncement(formData)) as
        | AnnouncementResult
        | undefined;
      if (result?.success) {
        setTitle("");
        setMessage("");
      }
      return result ?? null;
    },
    null,
  );

  return (
    <form action={formAction} className="hb-card-surface p-6">
      <div className="mb-5 border-b pb-4">
        <h2 className="hb-card-title text-lg">Send an announcement</h2>
        <p className="hb-card-body mt-0.5 text-sm">
          Goes to every student and admin. It shows up in their bell
          notifications and (unless they opted out) their email. Useful for
          patch notes and new-feature updates.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="announcement-title" className="hb-card-section mb-1.5 block text-sm">
            Title
          </label>
          <input
            id="announcement-title"
            name="title"
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New Pip features are live"
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="announcement-message" className="hb-card-section mb-1.5 block text-sm">
            Message
          </label>
          <textarea
            id="announcement-message"
            name="message"
            rows={6}
            required
            maxLength={5000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What changed, and what should students know?"
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        {state?.error && (
          <div className="border border-rose-700 border-opacity-40 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {state.error}
          </div>
        )}

        {state?.success && (
          <div className="space-y-1.5 border border-emerald-700 border-opacity-40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <div className="font-semibold">
              Announcement sent to {state.inAppCount} recipient
              {state.inAppCount === 1 ? "" : "s"} in-app.
            </div>
            {state.testMode ? (
              <div className="text-xs">
                Test mode active: emails redirected to{" "}
                {state.testModeEmail ?? "(unset)"}.
              </div>
            ) : state.emailedCount !== undefined && state.emailedCount > 0 ? (
              <div className="text-xs">
                Emailed {state.emailedCount} recipient
                {state.emailedCount === 1 ? "" : "s"}.
                {state.failedCount ? ` · ${state.failedCount} failed.` : ""}
              </div>
            ) : (
              <div className="text-xs">
                No emails sent. Check Brevo configuration or recipients'
                email opt-in.
              </div>
            )}
            {state.errors && state.errors.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-xs">
                {state.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className={`button gap-2 ${pending ? "hb-btn--pending" : ""}`}
        >
          {pending && <span className="hb-spinner" aria-hidden="true" />}
          {pending ? "Sending..." : "Send announcement"}
        </button>
      </div>
    </form>
  );
}
