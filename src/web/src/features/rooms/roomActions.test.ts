import { describe, expect, it } from "vitest";
import { studentActionFor, type StudentRoomState } from "./roomActions";

const base: StudentRoomState = {
  phase: "Published",
  room: { id: "room-1", status: "Open", freeSeats: 2 },
  myRoomId: null,
  hasPendingApplication: false,
};

describe("studentActionFor", () => {
  it("joins an open room and applies to a locked one while the course is published", () => {
    expect(studentActionFor(base)).toBe("join");
    expect(studentActionFor({ ...base, room: { ...base.room, status: "Locked" } })).toBe("apply");
  });

  it("offers leaving only for my own room", () => {
    expect(studentActionFor({ ...base, myRoomId: "room-1" })).toBe("leave");
    expect(studentActionFor({ ...base, myRoomId: "room-2" })).toBe("none");
  });

  it("offers nothing for a full room, a pending application or outside the published phase", () => {
    expect(studentActionFor({ ...base, room: { ...base.room, freeSeats: 0 } })).toBe("none");
    expect(studentActionFor({ ...base, room: { ...base.room, status: "Locked" }, hasPendingApplication: true })).toBe("none");
    expect(studentActionFor({ ...base, phase: "Setup" })).toBe("none");
    expect(studentActionFor({ ...base, phase: "Expired", myRoomId: "room-1" })).toBe("none");
  });
});
