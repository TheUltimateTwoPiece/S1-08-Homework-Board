import { describe, expect, it } from "vitest";
import { resolveCompletionAction } from "@/lib/completions";
import {
  nextBugReportStatus,
  nextFeedbackStatus,
  isBugReportStatus,
  isFeedbackStatus,
} from "@/lib/inbox-status";

describe("resolveCompletionAction", () => {
  it("completes only when not already complete", () => {
    expect(resolveCompletionAction(false, true)).toEqual({ action: "complete" });
    // Double-click: already complete, desired complete → no-op.
    expect(resolveCompletionAction(true, true)).toEqual({ action: "none" });
  });

  it("uncompletes only when already complete", () => {
    expect(resolveCompletionAction(true, false)).toEqual({ action: "uncomplete" });
    // Double-click: not complete, desired not complete → no-op.
    expect(resolveCompletionAction(false, false)).toEqual({ action: "none" });
  });

  it("defaults to a legacy toggle when no desired state is supplied", () => {
    expect(resolveCompletionAction(false, null)).toEqual({ action: "complete" });
    expect(resolveCompletionAction(true, null)).toEqual({ action: "uncomplete" });
  });
});

describe("admin inbox status transitions", () => {
  it("cycles feedback unread → read → resolved → unread", () => {
    expect(nextFeedbackStatus("unread")).toEqual({ next: "read", label: "Mark read" });
    expect(nextFeedbackStatus("read")).toEqual({ next: "resolved", label: "Resolve" });
    expect(nextFeedbackStatus("resolved")).toEqual({ next: "unread", label: "Reopen" });
  });

  it("cycles bug reports unread → in_progress → resolved → unread", () => {
    expect(nextBugReportStatus("unread")).toEqual({ next: "in_progress", label: "Start triage" });
    expect(nextBugReportStatus("in_progress")).toEqual({ next: "resolved", label: "Resolve" });
    expect(nextBugReportStatus("resolved")).toEqual({ next: "unread", label: "Reopen" });
  });

  it("validates status values and rejects unknown ones", () => {
    expect(isFeedbackStatus("unread")).toBe(true);
    expect(isFeedbackStatus("in_progress")).toBe(false);
    expect(isBugReportStatus("in_progress")).toBe(true);
    expect(isBugReportStatus("read")).toBe(false);
  });
});
