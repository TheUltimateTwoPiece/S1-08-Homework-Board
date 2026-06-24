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
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">New homework post</h2>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="e.g. Math — Chapter 5 exercises"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div>
        <label htmlFor="content" className="mb-1 block text-sm font-medium text-slate-700">
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <button
          type="button"
          onClick={handleEnhanceWithAI}
          disabled={enhancing || !content.trim()}
          className="mt-2 flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
        >
          <span>✨</span>
          {enhancing ? "Enhancing..." : "Enhance with Gemini AI"}
        </button>
        {aiError && <p className="mt-1 text-xs text-red-600">{aiError}</p>}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-green-600">Post published successfully!</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Publishing..." : "Publish post"}
      </button>
    </form>
  );
}
