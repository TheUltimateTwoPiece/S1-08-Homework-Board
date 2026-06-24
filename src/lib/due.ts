import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";

export type DueBadge = {
  label: string;
  className: string;
};

export function getDueBadge(dueAt: string | null): DueBadge | null {
  if (!dueAt) return null;

  const dueDate = startOfDay(parseISO(dueAt));
  const today = startOfDay(new Date());
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

