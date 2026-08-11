import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { getTodayString } from "@/lib/time";

export type DueBadge = {
  label: string;
  className: string;
};

export function getDueBadge(dueAt: string | null): DueBadge | null {
  if (!dueAt) return null;

  const dueDate = parseISO(dueAt);
  const today = parseISO(getTodayString());
  const diff = differenceInCalendarDays(dueDate, today);

  if (diff < 0) {
    return { label: "Overdue", className: "hb-text-error" };
  }

  if (diff === 0) {
    return { label: "Due today", className: "hb-text-warning" };
  }

  if (diff === 1) {
    return { label: "Due tomorrow", className: "hb-text-warning" };
  }

  return { label: `Due ${format(dueDate, "MMM d")}`, className: "hb-text-subtle" };
}

