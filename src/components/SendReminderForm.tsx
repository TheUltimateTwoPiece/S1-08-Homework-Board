"use client";

import { useActionState, useState } from "react";
import { sendReminder } from "@/actions/notifications";
import type { Post, Profile } from "@/lib/types";

type SendReminderFormProps = {
  students: Pick<Profile, "id" | "full_name" | "email">[];
  admins: Pick<Profile, "id" | "full_name" | "email">[];
  posts: Pick<Post, "id" | "title">[];
};

const QUICK_REMINDERS = [
  {
    label: "Due tomorrow",
    title: "Homework due tomorrow",
    message:
      "Reminder: your homework assignment is due tomorrow. Please make sure you've completed it and are ready to turn it in.",
  },
  {
    label: "Due today",
    title: "Complete today's homework",
    message:
      "Reminder: please complete today's homework assignment. Check the homework board for details.",
  },
  {
    label: "Missing work",
    title: "Missing homework",
    message:
      "Reminder: you have homework that still needs to be completed. Please finish it as soon as possible.",
  },
];

export function SendReminderForm({ students, admins, posts }: SendReminderFormProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [selectedPostId, setSelectedPostId] = useState("");

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { error?: string; success?: boolean; count?: number } | null,
      formData: FormData,
    ) => {
      const result = await sendReminder(formData);
      if (result?.success) {
        setTitle("");
        setMessage("");
        setSelectedPostId("");
        setTarget("all");
      }
      return result;
    },
    null,
  );

  function applyQuickReminder(reminder: (typeof QUICK_REMINDERS)[number]) {
    setTitle(reminder.title);
    setMessage(reminder.message);
  }

  function applyPostReminder(postId: string) {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    setTitle(`Reminder: ${post.title}`);
    setMessage(
      `Please complete the homework "${post.title}". You can view the full assignment on the homework board.`,
    );
  }

  return (
    <form action={formAction} className="rounded-xl border hb-card-surface p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <div>
          <h2 className="hb-card-section text-base">Send reminder</h2>
          <p className="hb-card-body text-xs">
            Students will see this in their reminders bell icon.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="target" className="hb-card-section mb-1.5 block text-sm">
            Send to
          </label>
          <select
            id="target"
            name="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          >
            <optgroup label="Students">
              <option value="all">All students</option>
              <option value="incomplete">Only students who haven&apos;t completed this task</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name} ({student.email})
                </option>
              ))}
            </optgroup>
            <optgroup label="Admins">
              <option value="all-admins">All other admins</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.full_name} ({admin.email})
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {posts.length > 0 && (
          <div>
            <label htmlFor="postId" className="hb-card-section mb-1.5 block text-sm">
              Remind about assignment {target === "incomplete" && <span className="text-amber-700">(required)</span>}
            </label>
            <select
              id="postId"
              name="postId"
              value={selectedPostId}
              onChange={(e) => {
                setSelectedPostId(e.target.value);
                if (e.target.value) applyPostReminder(e.target.value);
              }}
              required={target === "incomplete"}
              className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">Choose a homework post...</option>
              {posts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title}
                </option>
              ))}
            </select>
            {target === "incomplete" && !selectedPostId && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Please select a post to filter by completion status
              </p>
            )}
          </div>
        )}

        <div>
          <span className="hb-card-section mb-2 block text-sm">Quick reminders</span>
          <div className="flex flex-wrap gap-2">
            {QUICK_REMINDERS.map((reminder) => (
              <button
                key={reminder.label}
                type="button"
                onClick={() => applyQuickReminder(reminder)}
                className="hb-chip rounded-full px-3 py-1.5 text-xs font-medium"
              >
                {reminder.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="reminder-title" className="hb-card-section mb-1.5 block text-sm">
            Reminder title
          </label>
          <input
            id="reminder-title"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Math homework due tomorrow"
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="message" className="hb-card-section mb-1.5 block text-sm">
            Reminder message
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Let students know what they need to complete..."
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        {state?.error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{state.error}</div>
        )}
        {state?.success && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Reminder sent to {state.count} student{state.count === 1 ? "" : "s"}!
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending || (target === "incomplete" && !selectedPostId)}
          className={`hb-btn-primary w-full gap-2 py-2.5 text-sm font-medium ${
            pending ? "hb-btn--pending" : ""
          }`}
        >
          {pending && <span className="hb-spinner" aria-hidden="true" />}
          {pending ? "Sending..." : "Send reminder"}
        </button>
      </div>
    </form>
  );
}
