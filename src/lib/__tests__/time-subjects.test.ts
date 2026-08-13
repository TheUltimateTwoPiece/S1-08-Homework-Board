import { describe, expect, it } from "vitest";
import {
  getDateAfterDaysString,
  getPromptDateAfterDaysString,
  formatAppDateOnly,
} from "@/lib/time";
import { normalizeSubjects, isSubject, SUBJECTS } from "@/lib/subjects";
import { normalizePost, normalizeChecklist } from "@/lib/types";

describe("time helpers", () => {
  it("computes date offsets from an explicit reference date (timezone-safe)", () => {
    // 2026-08-13 is a Thursday; UTC midnight stays within the same calendar day.
    expect(getDateAfterDaysString(0, new Date("2026-08-13T12:00:00Z"))).toBe("2026-08-13");
    expect(getDateAfterDaysString(1, new Date("2026-08-13T12:00:00Z"))).toBe("2026-08-14");
    expect(getDateAfterDaysString(30, new Date("2026-08-13T12:00:00Z"))).toBe("2026-09-12");
  });

  it("uses UTC for prompt-day buckets, independent of app timezone", () => {
    expect(getPromptDateAfterDaysString(1, new Date("2026-08-13T23:00:00Z"))).toBe("2026-08-14");
  });

  it("formats a date-only value without timezone day-shifting", () => {
    expect(formatAppDateOnly("2026-08-13", { month: "short", day: "numeric" })).toBe("Aug 13");
    expect(formatAppDateOnly("2026-12-31", { day: "numeric" })).toBe("31");
  });
});

describe("subject helpers", () => {
  it("validates known subjects and rejects unknown values", () => {
    expect(isSubject("Math")).toBe(true);
    expect(isSubject("General")).toBe(true);
    expect(isSubject("History")).toBe(false);
    expect(SUBJECTS[0]).toBe("English");
  });

  it("normalises, de-duplicates, and falls back to the default subject", () => {
    expect(normalizeSubjects(["Math", "Math", "Science"])).toEqual(["Math", "Science"]);
    expect(normalizeSubjects(["Nope", ""])).toEqual(["English"]);
    expect(normalizeSubjects([])).toEqual(["English"]);
  });
});

describe("post normalisation", () => {
  it("coerces a legacy string subject into an array", () => {
    const normalized = normalizePost<{ id: string; subject: unknown; checklist: unknown }>({
      id: "x",
      subject: "Math",
      checklist: null,
    });
    expect(normalized.subject).toEqual(["Math"]);
  });

  it("normalises checklist rows, dropping blank entries", () => {
    const checklist = normalizeChecklist([
      { id: "1", text: "Do the worksheet" },
      { id: "2", text: "   " },
      { text: "no id" },
      null,
    ]);
    expect(checklist).toHaveLength(2);
    expect(checklist[0].text).toBe("Do the worksheet");
    expect(checklist[1].id).toBeTruthy();
  });
});
