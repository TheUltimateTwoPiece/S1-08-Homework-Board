"use client";

import { useActionState, useState } from "react";
import { createPost } from "@/actions/posts";
import { enhanceContentWithAI } from "@/actions/ai";

export function CreatePostForm() {
  const [content, setContent] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [aiError, setAiError] = useState("");

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await createPost(formData);
      if (result?.success) {
        setContent("");
      }
      return result;
    },
    null,
  );

  async function handleEnhanceWithAI() {
    if (!content.trim()) {
      setAiError("Please enter some content first.");
      return;
    }

    setEnhancing(true);
    setAiError("");

    const result = await enhanceContentWithAI(content);

    if (result.error) {
      setAiError(result.error);
    } else if (result.content) {
      setContent(result.content);
    }

    setEnhancing(false);
  }

  return (
    <form action={formAction} className="hb-card space-y-4 p-5">
      <h2 className="hb-text text-lg font-semibold">New homework post</h2>

      <div>
        <label htmlFor="title" className="hb-text-muted mb-1 block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="e.g. Math — Chapter 5 exercises"
          className="hb-input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="content" className="hb-text-muted mb-1 block text-sm font-medium">
          Homework details
        </label>
        <textarea
          id="content"
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          required
          placeholder="List the assignments, due dates, and any instructions..."
          className="hb-input w-full rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleEnhanceWithAI}
          disabled={enhancing || !content.trim()}
          className="hb-chip mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          <span>✨</span>
          {enhancing ? "Enhancing..." : "Enhance with Gemini AI"}
        </button>
        {aiError && <p className="hb-text-error mt-1 text-xs">{aiError}</p>}
      </div>

      {state?.error && <p className="hb-text-error text-sm">{state.error}</p>}
      {state?.success && (
        <p className="hb-text-success text-sm">Post published successfully!</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="hb-btn-primary px-4 py-2 text-sm font-medium"
      >
        {pending ? "Publishing..." : "Publish post"}
      </button>
    </form>
  );
}
