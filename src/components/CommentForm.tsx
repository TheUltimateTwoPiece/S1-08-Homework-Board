"use client";

import { useActionState } from "react";
import { addComment } from "@/actions/comments";

type CommentFormProps = {
  postId: string;
};

export function CommentForm({ postId }: CommentFormProps) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return addComment(formData);
    },
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="postId" value={postId} />
      <textarea
        name="content"
        rows={3}
        required
        placeholder="Write a comment..."
        className="hb-input hb-text w-full rounded-lg px-3 py-2 text-sm placeholder:text-slate-400"
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
