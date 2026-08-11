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
