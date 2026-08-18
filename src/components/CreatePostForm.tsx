"use client";

import { useActionState, useState } from "react";
import { createPost } from "@/actions/posts";
import { enhanceContentWithAI } from "@/actions/ai";
import { DEFAULT_SUBJECT } from "@/lib/subjects";
import { SubjectPicker } from "@/components/SubjectPicker";
import { ChecklistEditor } from "@/components/ChecklistEditor";

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
    <form action={formAction} className="rounded-xl border hb-card-surface p-6" encType="multipart/form-data">
      <div className="mb-5 border-b pb-4">
        <h2 className="hb-card-title text-lg">New homework post</h2>
        <p className="hb-card-body mt-0.5 text-sm">Create a new assignment for your class</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="hb-card-section mb-1.5 block text-sm">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={160}
            placeholder="e.g. Math: Chapter 5 exercises"
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <span className="hb-card-section mb-1.5 block text-sm">
            Subjects <span className="hb-card-meta text-xs font-normal">(select one or more)</span>
          </span>
          <SubjectPicker defaultSelected={[DEFAULT_SUBJECT]} />
        </div>

        <ChecklistEditor />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dueAt" className="hb-card-section mb-1.5 block text-sm">
              Due date
            </label>
            <input
              id="dueAt"
              name="dueAt"
              type="date"
              className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-stone-800/60">
          <input
            type="checkbox"
            name="pinned"
            id="pinned"
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="pinned" className="hb-card-section text-sm">
            Pin this post to the top
          </label>
        </div>

        <div>
          <label htmlFor="files" className="hb-card-section mb-1.5 block text-sm">
            Attachments (PDF/images)
          </label>
          <div className="relative">
            <input
              id="files"
              type="file"
              name="files"
              multiple
              accept="image/*,application/pdf"
              className="hb-input w-full rounded-lg px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-stone-700 dark:file:text-stone-200 dark:hover:file:bg-stone-600"
            />
          </div>
        </div>

        <div>
          <label htmlFor="content" className="hb-card-section mb-1.5 block text-sm">
            Homework details
          </label>
          <textarea
            id="content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            required
            maxLength={20000}
            placeholder="List the assignments, due dates, and any instructions..."
            className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnhanceWithAI}
              disabled={enhancing || !content.trim()}
              className={`hb-chip inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                enhancing ? "hb-btn--pending" : ""
              }`}
            >
              {enhancing ? (
                <span className="hb-spinner" aria-hidden="true" />
              ) : (
                <span className="text-sm">🤖</span>
              )}
              {enhancing ? "Enhancing..." : "Enhance with AI"}
            </button>
            {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          </div>
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
              Post published successfully!
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
          {pending ? "Publishing..." : "Publish post"}
        </button>
      </div>
    </form>
  );
}
