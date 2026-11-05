import { describe, expect, it } from "vitest";
import { expectedRooms, fromLocalInput, settingsOf, toLocalInput, newCourse } from "./courseDraft";

describe("courseDraft", () => {
  it("round-trips a time between the API and a datetime-local input", () => {
    const iso = "2026-11-20T10:30:00.000Z";

    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe("");
    expect(fromLocalInput("")).toBeNull();
  });

  it("sends the lecturer only together with a name and trims the class code", () => {
    expect(settingsOf({ ...newCourse, classCode: " SE1801 " })).toMatchObject({ classCode: "SE1801", lecturerId: null, lecturerName: null, publishAt: null });
    expect(settingsOf({ ...newCourse, lecturerId: "l1", lecturerName: "Dr. Lan" })).toMatchObject({ lecturerId: "l1", lecturerName: "Dr. Lan" });
  });

  it("previews the number of rooms like the server (BR-03)", () => {
    expect(expectedRooms(30, 6, 1.2)).toBe(6);
    expect(expectedRooms(31, 6, 1.2)).toBe(7);
    expect(expectedRooms(13, 5, 1.2)).toBe(4);
    expect(expectedRooms(0, 6, 1.2)).toBe(0);
  });
});
