"use client";

import { useState } from "react";
import { setChecklistItem } from "@/actions/checklists";
import type { ChecklistItem } from "@/lib/types";

type PostChecklistProps = {
  postId: string;
  items: readonly ChecklistItem[];
  initialCheckedIds: readonly string[];
};

export function PostChecklist({ postId, items, initialCheckedIds }: PostChecklistProps) {
  const validIds = new Set(items.map((item) => item.id));
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initialCheckedIds.filter((id) => validIds.has(id))),
  );
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  async function toggle(id: string) {
    if (pending.has(id)) return;
    const nextChecked = !checked.has(id);
    const previous = new Set(checked);
    setError("");
    setChecked((current) => {
      const next = new Set(current);
      if (nextChecked) next.add(id);
      else next.delete(id);
      return next;
    });
    setPending((current) => new Set(current).add(id));

    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("itemId", id);
    formData.set("checked", String(nextChecked));
    const result = await setChecklistItem(formData);

    if (!result.success) {
      setChecked(previous);
      setError(result.error ?? "Could not save checklist progress. Try again.");
    }
    setPending((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  const completedCount = items.filter((item) => checked.has(item.id)).length;

  return (
    <section className="mt-6 border-t border-[var(--hb-border)] pt-4" aria-label="Mini checklist">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="hb-card-section text-sm">Mini checklist</h2>
          <p className="hb-card-meta mt-0.5 text-xs">Tick each step as you work through it. Your progress syncs to your account.</p>
        </div>
        <span className="hb-card-meta tabular-nums text-xs font-semibold">
          {completedCount}/{items.length}
        </span>
      </div>
      {error && <p className="mb-2 text-xs font-medium text-red-600 dark:text-red-300" role="alert">{error}</p>}
      <ul className="space-y-2">
        {items.map((item) => {
          const isChecked = checked.has(item.id);
          const isPending = pending.has(item.id);
          return (
            <li key={item.id}>
              <label className={`flex items-start gap-2.5 px-2 py-2 transition hover:bg-[var(--hb-surface-hover)] ${isPending ? "cursor-wait opacity-60" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isPending}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-sm leading-relaxed ${isChecked ? "hb-card-faded line-through" : "hb-card-body"}`}>
                  {item.text}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
