"use client";

import { useActionState, useState } from "react";
import { sendReminder } from "@/actions/notifications";
import type { Post, Profile } from "@/lib/types";

type SendReminderFormProps = {
  students: Pick<Profile, "id" | "full_name" | "email">[];
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

export function SendReminderForm({ students, posts }: SendReminderFormProps) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { error?: string; success?: boolean; count?: number } | null,
      formData: FormData,
    ) => {
      const result = await sendReminder(formData);
      if (result?.success) {
        setTitle("");
        setMessage("");
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
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Send reminder</h2>
        <p className="mt-1 text-sm text-slate-600">
          Students will see this in their reminders bell icon.
        </p>
      </div>

      <div>
        <label htmlFor="target" className="mb-1 block text-sm font-medium text-slate-700">
          Send to
        </label>
        <select
          id="target"
          name="target"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="all">All students</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.full_name} ({student.email})
            </option>
          ))}
        </select>
      </div>

      {posts.length > 0 && (
        <div>
          <label htmlFor="postId" className="mb-1 block text-sm font-medium text-slate-700">
            Remind about assignment (optional)
          </label>
          <select
            id="postId"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyPostReminder(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">Choose a homework post...</option>
            {posts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Quick reminders
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_REMINDERS.map((reminder) => (
            <button
              key={reminder.label}
              type="button"
              onClick={() => applyQuickReminder(reminder)}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {reminder.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="reminder-title" className="mb-1 block text-sm font-medium text-slate-700">
          Reminder title
        </label>
        <input
          id="reminder-title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Math homework due tomorrow"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium text-slate-700">
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-green-600">
          Reminder sent to {state.count} student{state.count === 1 ? "" : "s"}!
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Sending..." : "Send reminder"}
      </button>
    </form>
  );
}
