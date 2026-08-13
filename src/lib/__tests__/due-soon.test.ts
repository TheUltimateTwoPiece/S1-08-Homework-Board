import { describe, expect, it } from "vitest";
import {
  buildDueSoon,
  classifyDueSoonBucket,
  type DueSoonPost,
} from "@/lib/due-soon";

const post = (overrides: Partial<DueSoonPost>): DueSoonPost => ({
  id: "p1",
  title: "Chapter 5 worksheet",
  subject: ["Math"],
  due_at: "2026-08-13",
  pinned: false,
  ...overrides,
});

describe("classifyDueSoonBucket", () => {
  it("buckets today and tomorrow, rejects overdue/undated/further out", () => {
    expect(classifyDueSoonBucket("2026-08-13", "2026-08-13", "2026-08-14")).toBe(
      "today",
    );
    expect(classifyDueSoonBucket("2026-08-14", "2026-08-13", "2026-08-14")).toBe(
      "tomorrow",
    );
    expect(classifyDueSoonBucket("2026-08-12", "2026-08-13", "2026-08-14")).toBe(
      null,
    );
    expect(classifyDueSoonBucket("2026-08-15", "2026-08-13", "2026-08-14")).toBe(
      null,
    );
    expect(classifyDueSoonBucket("", "2026-08-13", "2026-08-14")).toBe(null);
  });
});

describe("buildDueSoon", () => {
  const today = "2026-08-13";
  const tomorrow = "2026-08-14";

  it("excludes completed posts", () => {
    const result = buildDueSoon(
      [post({ id: "a", due_at: today })],
      new Set(["a"]),
      today,
      tomorrow,
    );
    expect(result.todayCount).toBe(0);
    expect(result.tomorrowCount).toBe(0);
    expect(result.today).toEqual([]);
  });

  it("groups by subject in canonical order and splits today/tomorrow", () => {
    const result = buildDueSoon(
      [
        post({ id: "math-today", subject: ["Math"], due_at: today }),
        post({ id: "eng-today", subject: ["English"], due_at: today }),
        post({ id: "sci-tomorrow", subject: ["Science"], due_at: tomorrow }),
        post({
          id: "multi",
          subject: ["Math", "Science"],
          due_at: today,
        }),
      ],
      new Set<string>(),
      today,
      tomorrow,
    );

    expect(result.todayCount).toBe(3);
    expect(result.tomorrowCount).toBe(1);

    // Canonical subject order: English, Math, Science.
    expect(result.today.map((g) => g.subject)).toEqual(["English", "Math", "Science"]);
    expect(result.tomorrow.map((g) => g.subject)).toEqual(["Science"]);

    // Multi-subject post appears in each of its groups.
    const mathIds = result.today.find((g) => g.subject === "Math")!.posts.map((p) => p.id);
    expect(mathIds).toContain("math-today");
    expect(mathIds).toContain("multi");

    const sciTomorrow = result.tomorrow.find((g) => g.subject === "Science")!;
    expect(sciTomorrow.posts.map((p) => p.id)).toEqual(["sci-tomorrow"]);
  });

  it("sorts pinned posts first within a group", () => {
    const result = buildDueSoon(
      [
        post({ id: "plain", due_at: today }),
        post({ id: "pinned", due_at: today, pinned: true }),
      ],
      new Set<string>(),
      today,
      tomorrow,
    );
    const group = result.today[0];
    expect(group.posts.map((p) => p.id)).toEqual(["pinned", "plain"]);
  });

  it("ignores overdue and undated posts", () => {
    const result = buildDueSoon(
      [
        post({ id: "overdue", due_at: "2026-08-12" }),
        post({ id: "undated", due_at: "" }),
        post({ id: "today", due_at: today }),
      ],
      new Set<string>(),
      today,
      tomorrow,
    );
    expect(result.todayCount).toBe(1);
    expect(result.today[0].posts.map((p) => p.id)).toEqual(["today"]);
  });
});
