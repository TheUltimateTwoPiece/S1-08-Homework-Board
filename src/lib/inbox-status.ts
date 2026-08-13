/**
 * Pure admin-inbox status transition helpers, shared by the admin pages, the
 * server actions, and unit tests. Single source of truth for the status
 * cycles so the UI label, next state, and validation can never drift apart.
 */

export type FeedbackStatus = "unread" | "read" | "resolved";
export type BugReportStatus = "unread" | "in_progress" | "resolved";

export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = [
  "unread",
  "read",
  "resolved",
];
export const BUG_REPORT_STATUSES: readonly BugReportStatus[] = [
  "unread",
  "in_progress",
  "resolved",
];

export function nextFeedbackStatus(
  status: FeedbackStatus,
): { next: FeedbackStatus; label: string } {
  switch (status) {
    case "unread":
      return { next: "read", label: "Mark read" };
    case "read":
      return { next: "resolved", label: "Resolve" };
    case "resolved":
      return { next: "unread", label: "Reopen" };
  }
}

export function nextBugReportStatus(
  status: BugReportStatus,
): { next: BugReportStatus; label: string } {
  switch (status) {
    case "unread":
      return { next: "in_progress", label: "Start triage" };
    case "in_progress":
      return { next: "resolved", label: "Resolve" };
    case "resolved":
      return { next: "unread", label: "Reopen" };
  }
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export function isBugReportStatus(value: string): value is BugReportStatus {
  return (BUG_REPORT_STATUSES as readonly string[]).includes(value);
}
