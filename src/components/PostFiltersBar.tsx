"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();

  const initial = useMemo<Filters>(
    () => ({
      q: normalizeValue(searchParams.get("q")),
      subject: normalizeValue(searchParams.get("subject")),
      status: normalizeValue(searchParams.get("status")) || "all",
      due: normalizeValue(searchParams.get("due")) || "all",
    }),
    [searchParams],
  );

  const qRef = useRef(initial.q);
  useEffect(() => {
    qRef.current = initial.q;
  }, [initial.q]);

  function setParams(next: Partial<Filters>) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { ...initial, ...next, q: qRef.current };

    for (const [key, value] of Object.entries(merged)) {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q: qRef.current });
        }}
      >
        <div className="flex-1">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">
            Search
          </label>
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-200"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              key={initial.q}
              defaultValue={initial.q}
              onChange={(e) => {
                qRef.current = e.target.value;
              }}
              disabled={isPending}
              placeholder="Search title or content..."
              className="hb-input w-full rounded-lg py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        <div className="sm:w-44">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">
            Subject
          </label>
          <select
            defaultValue={initial.subject}
            onChange={(e) => setParams({ subject: e.target.value })}
            disabled={isPending}
            className="hb-input w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-40">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">
            Due
          </label>
          <select
            defaultValue={initial.due}
            onChange={(e) => setParams({ due: e.target.value })}
            disabled={isPending}
            className="hb-input w-full rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={`hb-btn-primary h-[38px] px-4 text-sm font-medium ${
            isPending ? "hb-btn--pending" : ""
          } gap-2 sm:mb-0`}
        >
          {isPending && <span className="hb-spinner" aria-hidden="true" />}
          {isPending ? "Searching..." : "Search"}
        </button>
      </form>

      <div className="mt-3 flex items-center gap-1 rounded-lg bg-slate-100/70 p-1">
        {[
          { value: "all", label: "All" },
          { value: "todo", label: "To do" },
          { value: "completed", label: "Done" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setParams({ status: option.value })}
            disabled={isPending}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              initial.status === option.value
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-slate-700 dark:text-slate-300 hover:bg-white/60 hover:text-slate-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
