"use client";

import { useActionState, useState } from "react";
import { updatePost } from "@/actions/posts";
import { SubjectPicker } from "@/components/SubjectPicker";
import { ChecklistEditor } from "@/components/ChecklistEditor";
import type { Post } from "@/lib/types";

type EditPostFormProps = {
  post: Pick<Post, "id" | "title" | "content" | "checklist" | "subject" | "due_at" | "pinned">;
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
    <form action={formAction} className="rounded-xl border hb-card-surface p-6">
      <div className="mb-5 border-b pb-4">
        <h2 className="hb-card-title text-lg">Edit post</h2>
        <p className="hb-card-body mt-0.5 text-sm">Update the assignment details</p>
      </div>

      <input type="hidden" name="postId" value={post.id} />

      <div className="space-y-4">
        <div>
          <label htmlFor="edit-title" className="hb-card-section mb-1.5 block text-sm">
            Title
          </label>
          <input
            id="edit-title"
            name="title"
            required
            maxLength={160}
            defaultValue={post.title}
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <span className="hb-card-section mb-1.5 block text-sm">
            Subjects <span className="hb-card-meta text-xs font-normal">(select one or more)</span>
          </span>
          <SubjectPicker defaultSelected={post.subject} idPrefix="edit-subject" />
        </div>

        <ChecklistEditor defaultItems={post.checklist} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-dueAt" className="hb-card-section mb-1.5 block text-sm">
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

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-stone-800/60">
          <input
            type="checkbox"
            name="pinned"
            id="edit-pinned"
            defaultChecked={post.pinned}
            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <label htmlFor="edit-pinned" className="hb-card-section text-sm">
            Pin this post to the top
          </label>
        </div>

        <div>
          <label htmlFor="edit-content" className="hb-card-section mb-1.5 block text-sm">
            Homework details
          </label>
          <textarea
            id="edit-content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            required
            maxLength={20000}
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        {state?.error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-300">{state.error}</div>
        )}
        {state?.success && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950/50 dark:text-green-300">
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
          className={`button w-full gap-2 ${
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
