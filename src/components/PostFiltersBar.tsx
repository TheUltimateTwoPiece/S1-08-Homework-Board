"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Filters = {
  q: string;
  subject: string;
  status: string;
  due: string;
};

type PostFiltersBarProps = {
  subjects: string[];
};

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function PostFiltersBar({ subjects }: PostFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo<Filters>(
    () => ({
      q: normalizeValue(searchParams.get("q")),
      subject: normalizeValue(searchParams.get("subject")),
      status: normalizeValue(searchParams.get("status")) || "all",
      due: normalizeValue(searchParams.get("due")) || "all",
    }),
    [searchParams],
  );

  const [q, setQ] = useState(initial.q);

  function setParams(next: Partial<Filters>) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { ...initial, ...next, q };

    for (const [key, value] of Object.entries(merged)) {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="hb-card mb-6 space-y-3 p-4">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q });
        }}
      >
        <div className="flex-1">
          <label className="hb-text-muted mb-1 block text-xs font-semibold uppercase tracking-wide">
            Search
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or content..."
            className="hb-input w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:w-48">
          <label className="hb-text-muted mb-1 block text-xs font-semibold uppercase tracking-wide">
            Subject
          </label>
          <select
            defaultValue={initial.subject}
            onChange={(e) => setParams({ subject: e.target.value })}
            className="hb-input w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-44">
          <label className="hb-text-muted mb-1 block text-xs font-semibold uppercase tracking-wide">
            Due
          </label>
          <select
            defaultValue={initial.due}
            onChange={(e) => setParams({ due: e.target.value })}
            className="hb-input w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>

        <button type="submit" className="hb-btn-primary px-4 py-2 text-sm font-medium">
          Apply
        </button>
      </form>

      <div className="hb-segmented flex w-full items-center gap-2 rounded-lg p-1 text-sm">
        {[
          { value: "all", label: "All" },
          { value: "todo", label: "Uncompleted" },
          { value: "completed", label: "Completed" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setParams({ status: option.value })}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${
              initial.status === option.value
                ? "hb-segmented-btn--active"
                : "hb-segmented-btn--inactive"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

