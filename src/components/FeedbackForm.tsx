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
    <form action={formAction} className="hb-card space-y-4 p-6">
      <div>
        <h1 className="hb-text text-2xl font-bold">Feedback</h1>
        <p className="hb-text-muted mt-1 text-sm">
          Share ideas, report issues, or suggest improvements.
        </p>
      </div>

      <div>
        <div className="hb-text-muted mb-1 text-sm font-medium">Category</div>
        <div className="hb-segmented flex w-full items-center gap-2 rounded-lg p-1 text-sm">
          <button
            type="button"
            onClick={() => setCategory("post")}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${
              category === "post"
                ? "hb-segmented-btn--active"
                : "hb-segmented-btn--inactive"
            }`}
          >
            Posts
          </button>
          <button
            type="button"
            onClick={() => setCategory("website")}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${
              category === "website"
                ? "hb-segmented-btn--active"
                : "hb-segmented-btn--inactive"
            }`}
          >
            Website
          </button>
        </div>
        <input type="hidden" name="category" value={category} />
      </div>

      <div>
        <label htmlFor="message" className="hb-text-muted mb-1 block text-sm font-medium">
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
          className="hb-input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {state?.error && <p className="hb-text-error text-sm">{state.error}</p>}
      {state?.success && (
        <p className="hb-text-success text-sm">Thanks! Your feedback was sent.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`hb-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium ${
          pending ? "hb-btn--pending" : ""
        }`}
      >
        {pending && <span className="hb-spinner" aria-hidden="true" />}
        {pending ? "Sending..." : "Send feedback"}
      </button>
    </form>
  );
}
