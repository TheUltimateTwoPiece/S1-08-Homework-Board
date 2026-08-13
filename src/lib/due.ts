import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";

export type DueKind = "overdue" | "today" | "tomorrow" | "future";

export type DueState = {
  label: string;
  kind: DueKind;
  /** Whole calendar days between the due date and today (negative = past). */
  diffDays: number;
};

/**
 * Canonical due-date logic — single source of truth for every label and
 * countdown in the app. A due_at is a *date* (the column is `date`), so all
 * comparisons are calendar-day based. This never drifts with the clock the
 * way relative time (`formatDistanceToNow`) does — a post due tomorrow still
 * reads "Due tomorrow" at 1 AM, 1 PM, and 11 PM.
 */
export function getDueState(dueAt: string | null): DueState | null {
  if (!dueAt) return null;

  const dueDate = startOfDay(parseISO(dueAt));
  const today = startOfDay(new Date());
  const diff = differenceInCalendarDays(dueDate, today);

  if (diff < 0) return { label: "Overdue", kind: "overdue", diffDays: diff };
  if (diff === 0) return { label: "Due today", kind: "today", diffDays: 0 };
  if (diff === 1) return { label: "Due tomorrow", kind: "tomorrow", diffDays: 1 };
  return { label: `Due ${format(dueDate, "MMM d")}`, kind: "future", diffDays: diff };
}

export type DueBadge = {
  label: string;
  className: string;
};

/**
 * Small badge variant used on post cards and the dashboard homework list.
 * Colors are FIXED dark-on-light so the badge stays legible on the
 * always-white cards in BOTH themes — theme-variable colors (e.g.
 * --hb-warning) flip to light amber/grey on white in dark mode and become
 * unreadable.
 */
export function getDueBadge(dueAt: string | null): DueBadge | null {
  const state = getDueState(dueAt);
  if (!state) return null;

  const className =
    state.kind === "overdue"
      ? "text-rose-700"
      : state.kind === "today" || state.kind === "tomorrow"
        ? "text-amber-700"
        : "hb-card-meta";

  return { label: state.label, className };
}
