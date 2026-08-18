"use client";

import { SUBJECTS } from "@/lib/subjects";

type SubjectPickerProps = {
  /** Subjects checked on first render (e.g. a post's existing subjects). */
  defaultSelected?: readonly string[];
  idPrefix?: string;
};

/**
 * Chip-style multi-select for subjects. Every checked chip submits its value
 * under the `subject` field name, so `formData.getAll("subject")` returns all
 * of them — a post can belong to more than one subject at once.
 */
export function SubjectPicker({
  defaultSelected = [],
  idPrefix = "subject",
}: SubjectPickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Subjects">
      {SUBJECTS.map((subject) => {
        const id = `${idPrefix}-${subject.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
        return (
          <label
            key={subject}
            htmlFor={id}
            className="cursor-pointer select-none rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-600 has-[:checked]:text-white dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
          >
            <input
              id={id}
              type="checkbox"
              name="subject"
              value={subject}
              defaultChecked={defaultSelected.includes(subject)}
              className="sr-only"
            />
            {subject}
          </label>
        );
      })}
    </div>
  );
}
