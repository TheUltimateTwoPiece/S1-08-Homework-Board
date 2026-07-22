"use client";

import { useActionState } from "react";
import { updatePassword } from "@/actions/auth";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> => {
      const result = await updatePassword(formData);
      // updatePassword redirects on success, so any result here is an error
      return result ?? null;
    },
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="At least 6 characters"
          className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          className="hb-input w-full rounded-lg px-3 py-2.5 text-sm"
        />
      </div>
      {state?.error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {state.error}
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
        {pending ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
