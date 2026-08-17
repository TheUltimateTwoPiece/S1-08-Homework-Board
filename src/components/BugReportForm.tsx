"use client";

import { useActionState, useRef, useState } from "react";
import { submitBugReport } from "@/actions/bug-reports";

type FormState = { error?: string; success?: boolean } | null;

export function BugReportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [fileCount, setFileCount] = useState(0);
  const [state, formAction, pending] = useActionState(
    async (_previous: FormState, formData: FormData) => {
      const result = await submitBugReport(formData);
      if (result.success) {
        formRef.current?.reset();
        setFileCount(0);
      }
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={formAction} className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="hb-page-title text-2xl">Report a bug</h1>
        <p className="hb-body-text mt-1 text-sm">
          Tell us what happened and attach every screenshot that helps explain it.
        </p>
      </div>

      <div className="hb-card-surface p-6 sm:p-8">
        <div className="space-y-5">
          <div>
            <label htmlFor="bug-title" className="hb-card-section mb-1.5 block text-sm">Short title</label>
            <input id="bug-title" name="title" required maxLength={160} className="hb-input w-full rounded-xl px-4 py-3 text-sm" placeholder="For example: Due dates show the wrong day" />
          </div>

          <div>
            <label htmlFor="bug-category" className="hb-card-section mb-1.5 block text-sm">Area</label>
            <select id="bug-category" name="category" defaultValue="website" className="hb-input w-full rounded-xl px-4 py-3 text-sm">
              <option value="website">Website</option>
              <option value="posts">Homework posts</option>
              <option value="pip">Pip</option>
              <option value="account">Account or settings</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="bug-description" className="hb-card-section mb-1.5 block text-sm">What went wrong?</label>
            <textarea id="bug-description" name="description" required maxLength={5000} rows={5} className="hb-input w-full rounded-xl px-4 py-3 text-sm" placeholder="Describe what you expected and what you saw instead." />
          </div>

          <div>
            <label htmlFor="bug-steps" className="hb-card-section mb-1.5 block text-sm">Steps to reproduce <span className="hb-card-meta font-normal">(optional)</span></label>
            <textarea id="bug-steps" name="stepsToReproduce" maxLength={5000} rows={4} className="hb-input w-full rounded-xl px-4 py-3 text-sm" placeholder={"1. Open ...\n2. Click ...\n3. Notice ..."} />
          </div>

          <div>
            <label htmlFor="bug-screenshots" className="hb-card-section mb-1.5 block text-sm">Screenshots <span className="text-rose-600">*</span></label>
            <input id="bug-screenshots" name="screenshots" type="file" accept="image/*" multiple required onChange={(event) => setFileCount(event.target.files?.length ?? 0)} className="hb-input w-full rounded-xl px-4 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-semibold file:text-white" />
            <p className="hb-card-meta mt-2 text-xs">
              At least one screenshot is required. You can select as many screenshots as needed; each image can be up to 10 MB.
              {fileCount > 0 ? ` ${fileCount} selected.` : ""}
            </p>
          </div>

          {state?.error &&        <div role="alert" className="border border-[var(--hb-danger)] border-opacity-40 bg-[var(--hb-surface-hover)] px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{state.error}</div>}
          {state?.success &&        <div role="status" className="border border-emerald-700 border-opacity-40 bg-[var(--hb-surface-hover)] px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">Thanks! Your bug report and screenshots were sent to the admins.</div>}

          <button type="submit" disabled={pending} className={`button w-full gap-2 ${pending ? "hb-btn--pending" : ""}`}>
            {pending && <span className="hb-spinner" aria-hidden="true" />}
            {pending ? "Sending report..." : "Send bug report"}
          </button>
        </div>
      </div>
    </form>
  );
}
