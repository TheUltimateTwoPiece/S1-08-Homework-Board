"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBirthdayPopup } from "@/actions/birthday";
import type { BirthdaySetting } from "@/lib/types";

type BirthdayPopupFormProps = {
  setting: BirthdaySetting | null;
};

type BirthdayPopupResult =
  | { success: true; active: boolean; name: string }
  | { success: false; error: string };

export function BirthdayPopupForm({ setting }: BirthdayPopupFormProps) {
  const router = useRouter();
  const [name, setName] = useState(setting?.celebrant_name ?? "");
  const [active, setActive] = useState(setting?.active ?? false);
  const [state, formAction, pending] = useActionState(
    async (
      _previous: BirthdayPopupResult | null,
      formData: FormData,
    ): Promise<BirthdayPopupResult> => {
      const result = await saveBirthdayPopup(formData);
      if (result.success) {
        setName(result.name);
        setActive(result.active);
        router.refresh();
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="hb-card-surface p-6 sm:p-7">
      <div className="mb-5 border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="hb-card-title text-lg">Birthday popup</h2>
            <p className="hb-card-body mt-1 text-sm">
              Show a short birthday message with confetti to everyone who signs in.
              Each activation is shown once per account on each browser.
            </p>
          </div>
          <span
            className={`shrink-0 border px-2.5 py-1 text-xs font-semibold ${
              active
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-[var(--hb-border)] bg-[var(--hb-surface-hover)] hb-card-meta"
            }`}
          >
            {active ? "Active" : "Off"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="birthday-celebrant-name" className="hb-card-section mb-1.5 block text-sm">
            Birthday person's name
          </label>
          <input
            id="birthday-celebrant-name"
            name="celebrantName"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Maya"
            className="hb-input w-full max-w-md rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        <label className="flex max-w-md items-start gap-3 border border-[var(--hb-border)] bg-[var(--hb-surface-hover)] p-3">
          <input
            name="active"
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            disabled={pending}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="hb-card-section block text-sm">Activate birthday popup</span>
            <span className="hb-card-meta mt-0.5 block text-xs">
              Turn this off and save when the celebration is finished.
            </span>
          </span>
        </label>

        {state && !state.success && (
          <div role="alert" className="border border-rose-700 border-opacity-40 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div role="status" className="border border-emerald-700 border-opacity-40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            {state.active ? `Birthday popup activated for ${state.name}.` : "Birthday popup turned off."}
          </div>
        )}

        <button type="submit" disabled={pending} className={`button gap-2 ${pending ? "hb-btn--pending" : ""}`}>
          {pending && <span className="hb-spinner" aria-hidden="true" />}
          {pending ? "Saving..." : "Save birthday popup"}
        </button>
      </div>
    </form>
  );
}
