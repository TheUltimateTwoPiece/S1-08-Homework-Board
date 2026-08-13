import { describe, expect, it } from "vitest";
import {
  acquireInFlight,
  getCachedReply,
  isCoolingDown,
  putCachedReply,
  releaseInFlight,
} from "@/lib/pip-cost-guard";

describe("pip cost guard", () => {
  it("limits a user to one in-flight request at a time", () => {
    const userId = "user-a";
    expect(acquireInFlight(userId)).toBe(true);
    expect(acquireInFlight(userId)).toBe(false);
    releaseInFlight(userId);
    expect(acquireInFlight(userId)).toBe(true);
    releaseInFlight(userId);
  });

  it("scopes the in-flight guard per user", () => {
    expect(acquireInFlight("user-1")).toBe(true);
    expect(acquireInFlight("user-2")).toBe(true);
    releaseInFlight("user-1");
    releaseInFlight("user-2");
  });

  it("caches replies per user and normalises the question key", () => {
    const userId = "user-a";
    putCachedReply(userId, "  What is   due tomorrow?  ", "Your Math worksheet is due tomorrow.");
    expect(getCachedReply(userId, "what is due tomorrow?")).toBe(
      "Your Math worksheet is due tomorrow.",
    );
    // A different user does not see the cached reply.
    expect(getCachedReply("user-b", "what is due tomorrow?")).toBeNull();
  });

  it("starts outside a quota cooldown", () => {
    expect(isCoolingDown()).toBe(false);
  });
});
