import { describe, expect, it } from "vitest";
import { courseRefreshMs } from "./deadline";

describe("courseRefreshMs", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");

  it("stops once the course is finalized", () => {
    expect(courseRefreshMs({ phase: "Finalized", expireAt: "2026-11-06T11:00:00Z" }, now)).toBe(false);
  });

  it("checks often right after the deadline passes", () => {
    expect(courseRefreshMs({ phase: "Published", expireAt: "2026-11-06T11:59:00Z" }, now)).toBe(20_000);
  });

  it("checks every minute otherwise, because phase changes push nothing to staff", () => {
    expect(courseRefreshMs({ phase: "Setup", expireAt: null }, now)).toBe(60_000);
    expect(courseRefreshMs({ phase: "Published", expireAt: "2026-11-09T00:00:00Z" }, now)).toBe(60_000);
    expect(courseRefreshMs({ phase: "Expired", expireAt: "2026-11-06T11:00:00Z" }, now)).toBe(60_000);
  });
});
