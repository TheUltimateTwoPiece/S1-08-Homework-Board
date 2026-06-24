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
    <form action={formAction} className="hb-card space-y-4 p-5">
      <div>
        <h2 className="hb-text text-lg font-semibold">Send reminder</h2>
        <p className="hb-text-muted mt-1 text-sm">
          Students will see this in their reminders bell icon.
        </p>
      </div>

      <div>
        <label htmlFor="target" className="hb-text-muted mb-1 block text-sm font-medium">
          Send to
        </label>
        <select
          id="target"
          name="target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="hb-input w-full rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All students</option>
          <option value="incomplete">Only students who haven’t completed this task</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.full_name} ({student.email})
            </option>
          ))}
        </select>
      </div>

      {posts.length > 0 && (
        <div>
          <label htmlFor="postId" className="hb-text-muted mb-1 block text-sm font-medium">
            Remind about assignment {target === "incomplete" && "(required)"}
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
            className="hb-input w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Choose a homework post...</option>
            {posts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.title}
              </option>
            ))}
          </select>
          {target === "incomplete" && !selectedPostId && (
            <p className="hb-text-warning mt-1 text-xs">
              Please select a post to filter students by completion status
            </p>
          )}
        </div>
      )}

      <div>
        <span className="hb-text-muted mb-2 block text-sm font-medium">
          Quick reminders
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_REMINDERS.map((reminder) => (
            <button
              key={reminder.label}
              type="button"
              onClick={() => applyQuickReminder(reminder)}
              className="hb-chip rounded-full px-3 py-1 text-xs font-medium"
            >
              {reminder.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="reminder-title" className="hb-text-muted mb-1 block text-sm font-medium">
          Reminder title
        </label>
        <input
          id="reminder-title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Math homework due tomorrow"
          className="hb-input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="message" className="hb-text-muted mb-1 block text-sm font-medium">
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
          className="hb-input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {state?.error && <p className="hb-text-error text-sm">{state.error}</p>}
      {state?.success && (
        <p className="hb-text-success text-sm">
          Reminder sent to {state.count} student{state.count === 1 ? "" : "s"}!
        </p>
      )}


      <button
        type="submit"
        disabled={pending || (target === "incomplete" && !selectedPostId)}
        className="hb-btn-primary px-4 py-2 text-sm font-medium"
      >
        {pending ? "Sending..." : "Send reminder"}
      </button>
    </form>
  );
}
