import { differenceInCalendarDays, parseISO } from "date-fns";
import { getTodayString, APP_TIME_ZONE } from "@/lib/time";
import { formatDueDateTimeLabel, getDueTimestamp } from "@/lib/due-time";

export type DueKind = "overdue" | "today" | "tomorrow" | "future";

export type DueState = {
  label: string;
  kind: DueKind;
  /** Whole calendar days between the due date and today (negative = past). */
  diffDays: number;
  dueTimestamp: number | null;
};

/**
 * Canonical due-date logic for every label and status in the app.
 * Date-only posts keep calendar-day behavior. Posts with due_time are
 * compared against the exact local deadline in APP_TIME_ZONE, so a task due
 * today at 10 PM is not marked overdue at noon.
 */
export function getDueState(
  dueAt: string | null,
  dueTime: string | null = null,
  now = new Date(),
): DueState | null {
  if (!dueAt) return null;

  const dueDate = parseISO(dueAt);
  const today = parseISO(getTodayString(now));
  const diff = differenceInCalendarDays(dueDate, today);
  const dueTimestamp = getDueTimestamp(dueAt, dueTime, APP_TIME_ZONE);
  const hasPassed = dueTimestamp === null
    ? diff < 0
    : dueTimestamp <= now.getTime();
  const dateLabel = formatDueDateTimeLabel(dueAt, dueTime) ?? dueAt;

  if (hasPassed) {
    return {
      label: `Due ${dateLabel}`,
      kind: "overdue",
      diffDays: diff,
      dueTimestamp,
    };
  }
  if (diff === 0) {
    return {
      label: `Due ${dateLabel}`,
      kind: "today",
      diffDays: 0,
      dueTimestamp,
    };
  }
  if (diff === 1) {
    return {
      label: `Due ${dateLabel}`,
      kind: "tomorrow",
      diffDays: 1,
      dueTimestamp,
    };
  }
  return {
    label: `Due ${dateLabel}`,
    kind: "future",
    diffDays: diff,
    dueTimestamp,
  };
}

export type DueBadge = {
  label: string;
  className: string;
};

export function getDueBadge(
  dueAt: string | null,
  dueTime: string | null = null,
): DueBadge | null {
  const state = getDueState(dueAt, dueTime);
  if (!state) return null;

  const className =
    state.kind === "overdue"
      ? "text-rose-700 dark:text-rose-400"
      : state.kind === "today" || state.kind === "tomorrow"
        ? "text-amber-700 dark:text-amber-400"
        : "hb-card-meta";

  return { label: state.label, className };
}
