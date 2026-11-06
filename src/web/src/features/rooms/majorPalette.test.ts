import { describe, expect, it } from "vitest";
import { majorColor, missingMajors, seatsFor } from "./majorPalette";

describe("majorColor", () => {
  it("follows the catalog order and falls back to neutral past the eighth major", () => {
    const order = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    expect(majorColor(order, "a")).toBe("var(--major-1)");
    expect(majorColor(order, "h")).toBe("var(--major-8)");
    expect(majorColor(order, "i")).toBe("var(--muted-foreground)");
    expect(majorColor(order, "unknown")).toBe("var(--muted-foreground)");
  });
});

describe("seatsFor", () => {
  it("fills members by major, then seats kept for missing majors, then free seats", () => {
    const seats = seatsFor(6, 3, [
      { majorId: "se", majorCode: "SE", members: 2, required: 1 },
      { majorId: "gd", majorCode: "GD", members: 1, required: 0 },
      { majorId: "ai", majorCode: "AI", members: 0, required: 1 },
    ], 1);

    expect(seats.map((seat) => seat.kind)).toEqual(["member", "member", "member", "reserved", "free", "free"]);
    expect(seats[0]).toEqual({ kind: "member", majorId: "se" });
    expect(seats[2]).toEqual({ kind: "member", majorId: "gd" });
  });

  it("still draws every member when the majors are not known", () => {
    expect(seatsFor(4, 2).map((seat) => seat.kind)).toEqual(["member", "member", "free", "free"]);
  });

  it("never draws more seats than the capacity", () => {
    expect(seatsFor(3, 3, [], 2)).toHaveLength(3);
  });
});

describe("missingMajors", () => {
  it("lists only majors below their minimum", () => {
    expect(missingMajors([
      { majorId: "se", majorCode: "SE", members: 2, required: 1 },
      { majorId: "ai", majorCode: "AI", members: 0, required: 1 },
    ]).map((major) => major.majorCode)).toEqual(["AI"]);
  });
});
