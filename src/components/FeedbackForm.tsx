"use client";

import { useActionState, useState } from "react";
import { submitFeedback } from "@/actions/feedback";

export function FeedbackForm() {
  const [message, setMessage] = useState("");

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
        className="hb-btn-primary px-4 py-2 text-sm font-medium"
      >
        {pending ? "Sending..." : "Send feedback"}
      </button>
    </form>
  );
}
