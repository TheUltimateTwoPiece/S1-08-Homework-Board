"use client";

import { useActionState, useState } from "react";
import { submitFeedback } from "@/actions/feedback";

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"post" | "website">("website");

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await submitFeedback(formData);
      if (result?.success) {
        setMessage("");
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-amber-600" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-zinc-950">Feedback</h1>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          Share ideas, report issues, or suggest improvements.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">Category</span>
            <div className="flex gap-2 rounded-lg bg-slate-100/70 p-1">
              <button
                type="button"
                onClick={() => setCategory("post")}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                  category === "post"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-700"
                }`}
              >
                Posts
              </button>
              <button
                type="button"
                onClick={() => setCategory("website")}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                  category === "website"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-700"
                }`}
              >
                Website
              </button>
            </div>
            <input type="hidden" name="category" value={category} />
          </div>

          <div>
            <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-700">
              Your feedback
            </label>
            <textarea
              id="message"
              name="message"
              rows={6}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your feedback here..."
              className="hb-input w-full rounded-xl px-4 py-3 text-sm"
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
                Thanks! Your feedback was sent.
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
            {pending ? "Sending..." : "Send feedback"}
          </button>
        </div>
      </div>
    </form>
  );
}
