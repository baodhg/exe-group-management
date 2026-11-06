import { describe, expect, it } from "vitest";
import { missingMajors, seatsFor } from "./seatLayout";

describe("seatsFor", () => {
  it("fills members by major, then seats kept for missing majors, then free seats", () => {
    const seats = seatsFor(6, 3, [
      { majorId: "se", majorCode: "SE", members: 2, required: 1 },
      { majorId: "gd", majorCode: "GD", members: 1, required: 0 },
      { majorId: "ai", majorCode: "AI", members: 0, required: 1 },
    ], 1);

    expect(seats.map((seat) => seat.kind)).toEqual(["member", "member", "member", "reserved", "free", "free"]);
    expect(seats[0]).toEqual({ kind: "member", code: "SE" });
    expect(seats[2]).toEqual({ kind: "member", code: "GD" });
    expect(seats[3]).toEqual({ kind: "reserved", code: "AI" });
  });

  it("marks a kept seat with no code when only a number of distinct majors is required", () => {
    const seats = seatsFor(4, 1, [{ majorId: "se", majorCode: "SE", members: 1, required: 1 }], 1);
    expect(seats[1]).toEqual({ kind: "reserved", code: null });
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
