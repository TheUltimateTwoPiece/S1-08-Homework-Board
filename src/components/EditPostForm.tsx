"use client";

import { useActionState, useState } from "react";
import { updatePost } from "@/actions/posts";
import type { Post } from "@/lib/types";

type EditPostFormProps = {
  post: Pick<Post, "id" | "title" | "content" | "subject" | "due_at" | "pinned">;
};

export function EditPostForm({ post }: EditPostFormProps) {
  const [content, setContent] = useState(post.content);

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await updatePost(formData);
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Edit post</h2>
          <p className="text-xs text-slate-700 dark:text-slate-700">Update the assignment details</p>
        </div>
      </div>

      <input type="hidden" name="postId" value={post.id} />

      <div className="space-y-4">
        <div>
          <label htmlFor="edit-title" className="mb-1.5 block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="edit-title"
            name="title"
            required
            defaultValue={post.title}
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-subject" className="mb-1.5 block text-sm font-medium text-slate-700">
              Subject
            </label>
            <select
              id="edit-subject"
              name="subject"
              className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
              defaultValue={post.subject}
            >
              <option value="General">General</option>
              <option value="Math">Math</option>
              <option value="Science">Science</option>
              <option value="English">English</option>
              <option value="History">History</option>
              <option value="Language">Language</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-dueAt" className="mb-1.5 block text-sm font-medium text-slate-700">
              Due date
            </label>
            <input
              id="edit-dueAt"
              name="dueAt"
              type="date"
              defaultValue={post.due_at ?? ""}
              className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
          <input
            type="checkbox"
            name="pinned"
            id="edit-pinned"
            defaultChecked={post.pinned}
            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <label htmlFor="edit-pinned" className="text-sm font-medium text-slate-600">
            Pin this post to the top
          </label>
        </div>

        <div>
          <label htmlFor="edit-content" className="mb-1.5 block text-sm font-medium text-slate-700">
            Homework details
          </label>
          <textarea
            id="edit-content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            required
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
              Saved changes.
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className={`hb-btn-primary w-full gap-2 py-2.5 text-sm font-medium ${
            pending ? "hb-btn--pending" : ""
          }`}
        >
          {pending && <span className="hb-spinner" aria-hidden="true" />}
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
