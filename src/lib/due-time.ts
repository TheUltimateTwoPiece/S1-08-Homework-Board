type DateParts = {
  year: number;
  month: number;
  day: number;
};

type TimeParts = {
  hour: number;
  minute: number;
  second: number;
};

function parseDateParts(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }
  return parts;
}

function parseTimeParts(value: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;

  const parts = {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] ?? "0"),
  };
  if (
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    return null;
  }
  return parts;
}

function partsToUtcTimestamp(parts: DateParts & TimeParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function formatPartsForTimeZone(date: Date, timeZone: string): DateParts & TimeParts {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

/**
 * Converts a local date + wall-clock time in an IANA timezone to an epoch
 * timestamp. This avoids treating a school's local deadline as the browser's
 * timezone, which was the source of the old countdown drift.
 */
export function getDueTimestamp(
  dueAt: string | null,
  dueTime: string | null,
  timeZone: string,
): number | null {
  if (!dueAt || !dueTime) return null;
  const dateParts = parseDateParts(dueAt);
  const timeParts = parseTimeParts(dueTime);
  if (!dateParts || !timeParts) return null;

  const requested = { ...dateParts, ...timeParts };
  const requestedAsUtc = partsToUtcTimestamp(requested);
  let candidate = requestedAsUtc;

  // Iterate until formatting the candidate in the target timezone produces
  // the requested local clock time. Four passes cover normal and DST offsets.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = partsToUtcTimestamp(formatPartsForTimeZone(new Date(candidate), timeZone));
    const correction = requestedAsUtc - actual;
    candidate += correction;
    if (correction === 0) break;
  }

  return candidate;
}

export function formatDueTimeOnly(dueTime: string | null): string | null {
  if (!dueTime) return null;
  const parts = parseTimeParts(dueTime);
  if (!parts) return null;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2000, 0, 1, parts.hour, parts.minute)));
}

export function formatDueDateOnly(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const parts = parseDateParts(dueAt);
  if (!parts) return null;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)));
}

export function formatDueDateTimeLabel(
  dueAt: string | null,
  dueTime: string | null = null,
): string | null {
  const dateLabel = formatDueDateOnly(dueAt);
  if (!dateLabel) return null;
  const timeLabel = formatDueTimeOnly(dueTime);
  return timeLabel ? `${dateLabel} at ${timeLabel}` : dateLabel;
}

export function formatDueCountdown(milliseconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(Math.abs(milliseconds) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours < 24) {
    if (hours === 0) return `${minutes}m`;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
