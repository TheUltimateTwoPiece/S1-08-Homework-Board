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
    <form action={formAction} className="hb-card space-y-4 p-5">
      <h2 className="hb-text text-lg font-semibold">Edit post</h2>
      <input type="hidden" name="postId" value={post.id} />

      <div>
        <label htmlFor="title" className="hb-text-muted mb-1 block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={post.title}
          className="hb-input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="subject" className="hb-text-muted mb-1 block text-sm font-medium">
            Subject
          </label>
          <select
            id="subject"
            name="subject"
            className="hb-input w-full rounded-lg px-3 py-2 text-sm"
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
          <label htmlFor="dueAt" className="hb-text-muted mb-1 block text-sm font-medium">
            Due date
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="date"
            defaultValue={post.due_at ?? ""}
            className="hb-input w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="hb-text-muted flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="pinned"
          defaultChecked={post.pinned}
          className="accent-slate-800"
        />
        Pin this post
      </label>

      <div>
        <label htmlFor="content" className="hb-text-muted mb-1 block text-sm font-medium">
          Homework details
        </label>
        <textarea
          id="content"
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          required
          className="hb-input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {state?.error && <p className="hb-text-error text-sm">{state.error}</p>}
      {state?.success && (
        <p className="hb-text-success text-sm">Saved changes.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="hb-btn-primary px-4 py-2 text-sm font-medium"
      >
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

