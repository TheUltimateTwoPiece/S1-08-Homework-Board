"use client";

import { useState } from "react";
import type { ChecklistItem } from "@/lib/types";

const MAX_ITEMS = 12;
const MAX_ITEM_LENGTH = 160;

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type ChecklistEditorProps = {
  defaultItems?: readonly ChecklistItem[];
};

export function ChecklistEditor({ defaultItems = [] }: ChecklistEditorProps) {
  const [items, setItems] = useState<ChecklistItem[]>(() =>
    defaultItems.map((item) => ({ id: item.id, text: item.text })),
  );
  const [draft, setDraft] = useState("");

  function addItem() {
    const text = draft.trim().slice(0, MAX_ITEM_LENGTH);
    if (!text || items.length >= MAX_ITEMS) return;
    setItems((current) => [...current, { id: makeId(), text }]);
    setDraft("");
  }

  function updateItem(id: string, text: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, text } : item));
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <input type="hidden" name="checklist" value={JSON.stringify(items)} />
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <span className="hb-card-section text-sm">Mini checklist</span>
          <p className="hb-card-meta mt-0.5 text-[11px]">Optional steps students can tick off while working.</p>
        </div>
        <span className="hb-card-meta text-[10px] tabular-nums">{items.length}/{MAX_ITEMS}</span>
      </div>

      {items.length > 0 && (
        <div className="mb-3 space-y-2">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-[10px] text-slate-400">
                {index + 1}
              </span>
              <input
                value={item.text}
                maxLength={MAX_ITEM_LENGTH}
                onChange={(event) => updateItem(item.id, event.target.value)}
                aria-label={`Checklist step ${index + 1}`}
                className="hb-input min-w-0 flex-1 rounded-md bg-white px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remove checklist step ${index + 1}`}
                className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={draft}
          maxLength={MAX_ITEM_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={items.length >= MAX_ITEMS ? "Checklist limit reached" : "Add a step, e.g. Read pages 12–15"}
          disabled={items.length >= MAX_ITEMS}
          className="hb-input min-w-0 flex-1 rounded-md bg-white px-2.5 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim() || items.length >= MAX_ITEMS}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add step
        </button>
      </div>
    </div>
  );
}
