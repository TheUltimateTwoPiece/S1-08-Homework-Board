"use client";

import { useActionState, useState } from "react";
import { addComment } from "@/actions/comments";

type CommentFormProps = {
  postId: string;
  parentCommentId?: string;
  placeholder?: string;
  onSuccess?: () => void;
};

export function CommentForm({
  postId,
  parentCommentId,
  placeholder = "Write a comment...",
  onSuccess,
}: CommentFormProps) {
  const [content, setContent] = useState("");

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await addComment(formData);
      if (result?.success) {
        setContent("");
        onSuccess?.();
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-3" encType="multipart/form-data">
      <input type="hidden" name="postId" value={postId} />
      {parentCommentId && (
        <input type="hidden" name="parentCommentId" value={parentCommentId} />
      )}
      <div className="relative">
        <textarea
          name="content"
          rows={3}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="hb-input w-full rounded-xl px-4 py-3 text-sm placeholder:text-slate-500 dark:placeholder:text-slate-400 dark:text-slate-200"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-700 transition hover:bg-slate-100 hover:text-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <input
            type="file"
            name="files"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
          />
          Attach files
        </label>
        <div className="flex-1" />
        {state?.error && (
          <p className="text-xs text-red-500">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={`hb-btn-primary gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
            pending ? "hb-btn--pending" : ""
          }`}
        >
          {pending && <span className="hb-spinner" aria-hidden="true" />}
          {pending ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
