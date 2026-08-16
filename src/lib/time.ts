import { addDays, format, parseISO } from "date-fns";

/**
 * Date-only homework values must be interpreted in the school's timezone, not
 * the Vercel server's UTC timezone. Configure APP_TIME_ZONE in production;
 * this default matches the school's current Eastern-time deployment.
 */
const configuredTimeZone = process.env.APP_TIME_ZONE ?? "America/New_York";

function resolveTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    console.warn(`Invalid APP_TIME_ZONE "${value}"; falling back to America/New_York.`);
    return "America/New_York";
  }
}

export const APP_TIME_ZONE = resolveTimeZone(configuredTimeZone);

function partsFor(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).formatToParts(date);
}

export function getTodayString(date = new Date()): string {
  const parts = partsFor(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getDateAfterDaysString(days: number, date = new Date()): string {
  return format(addDays(parseISO(getTodayString(date)), days), "yyyy-MM-dd");
}

/**
 * Pip's database rate-limit buckets intentionally reset at midnight UTC.
 * Keep this separate from date-only homework calculations, which use the
 * school's configured APP_TIME_ZONE.
 */
export function getPromptDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getPromptDateAfterDaysString(days: number, date = new Date()): string {
  return format(addDays(parseISO(getPromptDateString(date)), days), "yyyy-MM-dd");
}

export function formatPromptDateLabel(dateString: string): string {
  return formatAppDateOnly(dateString, { weekday: "short" });
}

/**
 * Formats a date-only database value without letting the server's timezone
 * shift it to the previous or next calendar day. Date-only homework values
 * have no clock time, so they are intentionally rendered in UTC as a plain
 * calendar date.
 */
export function formatAppDateOnly(
  dateString: string,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" },
): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

export function getAppDayOfWeek(date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: APP_TIME_ZONE,
  }).format(date);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(weekday);
}

export function formatAppDate(date: Date, options: Intl.DateTimeFormatOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
}) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatAppDateTime(value: string | Date): string {
  return formatAppDate(typeof value === "string" ? new Date(value) : value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
