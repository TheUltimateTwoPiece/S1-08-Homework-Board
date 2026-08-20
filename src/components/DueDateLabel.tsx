"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDueCountdown,
  formatDueDateTimeLabel,
  getDueTimestamp,
} from "@/lib/due-time";

type DueDateLabelProps = {
  dueAt: string | null;
  dueTime?: string | null;
  timeZone: string;
  className?: string;
  countdownClassName?: string;
};

export function DueDateLabel({
  dueAt,
  dueTime = null,
  timeZone,
  className,
  countdownClassName,
}: DueDateLabelProps) {
  const label = formatDueDateTimeLabel(dueAt, dueTime);
  const targetTimestamp = useMemo(
    () => getDueTimestamp(dueAt, dueTime, timeZone),
    [dueAt, dueTime, timeZone],
  );
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (targetTimestamp === null) return;

    const update = () => setRemaining(targetTimestamp - Date.now());
    update();
    const interval = window.setInterval(update, 30000);
    return () => window.clearInterval(interval);
  }, [targetTimestamp]);

  if (!label) return null;
  const visibleRemaining = targetTimestamp === null ? null : remaining;

  return (
    <span className={className} title={`Due ${label}`}>
      <span>{`Due ${label}`}</span>
      {visibleRemaining !== null && (
        <span className={countdownClassName ?? "ml-1.5 opacity-80"}>
          ({visibleRemaining <= 0 ? "overdue by " : "in "}{formatDueCountdown(visibleRemaining)})
        </span>
      )}
    </span>
  );
}
