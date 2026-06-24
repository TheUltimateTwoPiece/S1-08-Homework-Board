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
      <textarea
        name="content"
        rows={3}
        required
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="hb-input hb-text w-full rounded-lg px-3 py-2 text-sm placeholder:text-slate-400"
      />
      <input
        type="file"
        name="files"
        multiple
        accept="image/*,application/pdf"
        className="hb-input w-full rounded-lg px-3 py-2 text-sm"
      />
      {state?.error && (
        <p className="hb-text-error text-sm">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="hb-btn-primary px-4 py-2 text-sm font-medium"
      >
        {pending ? "Posting..." : "Post comment"}
      </button>
    </form>
  );
}
