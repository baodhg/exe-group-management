import { describe, expect, it } from "vitest";
import type { MajorCount, RoomSummary } from "../common/types";
import { attentionFor, attentionTitle, changedRooms, countdownText, deadlineReached, foldText, missingMajorsText, missingMembersText, roomConditions, roomIsEligible, shortDateTime, unplacedByMajor } from "./overview";

const major = (majorCode: string, members: number, required: number): MajorCount => ({ majorId: majorCode, majorCode, members, required });
const student = (majorCode: string) => ({ majorCode });

function room(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    id: "r1",
    courseId: "c1",
    name: "Phòng 01",
    topic: null,
    status: "Open",
    capacity: 6,
    memberCount: 4,
    freeSeats: 2,
    groupTypeId: "g1",
    groupTypeCode: "EXE",
    leaderId: "l1",
    leaderName: "An",
    groupNo: null,
    majors: [],
    missingMajorSeats: 0,
    ...overrides,
  };
}

describe("overview texts", () => {
  it("names the majors a room still misses", () => {
    const item = {
      missingMajorSeats: 1,
      majors: [major("AI", 0, 1), major("SE", 3, 1)],
    };

    expect(missingMajorsText(item)).toBe("AI 0/1");
  });

  it("falls back to the seat count when only distinct majors are missing, and says enough when nothing is", () => {
    expect(missingMajorsText({ missingMajorSeats: 2, majors: [] })).toBe("2 chỗ cho ngành khác");
    expect(missingMajorsText({ missingMajorSeats: 0, majors: [] })).toBe("Đủ");
    expect(missingMembersText({ missingMembers: 2 }, 4)).toBe("2 người (tối thiểu 4)");
    expect(missingMembersText({ missingMembers: 0 }, 4)).toBe("Đủ");
  });
});

describe("unplacedByMajor", () => {
  it("counts unplaced students per major, the largest first and then by code", () => {
    expect(unplacedByMajor([student("SE"), student("MKT"), student("SE"), student("GD"), student("MKT"), student("SE"), student("AI")])).toEqual([
      { code: "SE", count: 3 },
      { code: "MKT", count: 2 },
      { code: "AI", count: 1 },
      { code: "GD", count: 1 },
    ]);
  });

  it("has no rows when everyone has a room", () => {
    expect(unplacedByMajor([])).toEqual([]);
  });
});

describe("attentionFor", () => {
  it("picks the major with the widest gap between rooms that need it and students left", () => {
    const rooms = [
      room({ name: "Phòng 01", majors: [major("MKT", 0, 1), major("SE", 1, 1)] }),
      room({ name: "Phòng 03", majors: [major("MKT", 0, 1), major("SE", 0, 1)] }),
      room({ name: "Phòng 04", majors: [major("MKT", 1, 1), major("SE", 2, 1)] }),
    ];

    expect(attentionFor(rooms, [student("SE"), student("MKT")])).toEqual({ majorCode: "MKT", rooms: ["Phòng 01", "Phòng 03"], people: 1 });
  });

  it("is empty when no room needs a named major", () => {
    expect(attentionFor([room({ majors: [major("SE", 2, 1)] })], [student("SE")])).toBeNull();
    expect(attentionFor([room({ majors: undefined })], [student("SE")])).toBeNull();
  });

  it("writes the headline of the card", () => {
    expect(attentionTitle({ majorCode: "MKT", rooms: ["Phòng 01", "Phòng 03"], people: 4 })).toBe("Còn 4 bạn MKT cho 2 phòng cần MKT");
  });
});

describe("roomConditions", () => {
  it("marks a room with enough people and majors as eligible", () => {
    const item = room({ memberCount: 4, majors: [major("SE", 2, 1)] });

    expect(roomConditions(item, 4).map((condition) => condition.text)).toEqual(["Đủ điều kiện"]);
    expect(roomIsEligible(item, 4)).toBe(true);
  });

  it("treats a room with nobody as empty rather than short", () => {
    const item = room({ memberCount: 0, majors: [major("SE", 0, 1)], missingMajorSeats: 1 });

    expect(roomConditions(item, 4)).toEqual([{ kind: "empty", text: "Phòng trống", tone: "neutral" }]);
    expect(roomIsEligible(item, 4)).toBe(false);
  });

  it("lists every shortage: people, named majors and seats for other majors", () => {
    const item = room({ memberCount: 2, majors: [major("SE", 1, 1), major("MKT", 0, 1), major("GD", 0, 1)], missingMajorSeats: 3 });

    expect(roomConditions(item, 4).map((condition) => condition.text)).toEqual(["Thiếu 2 người", "Thiếu MKT, GD", "1 chỗ cho ngành khác"]);
    expect(roomIsEligible(item, 4)).toBe(false);
  });
});

describe("changedRooms", () => {
  it("names rooms whose members, status or leader changed between two loads", () => {
    const before = [room({ id: "a", name: "Phòng 01" }), room({ id: "b", name: "Phòng 02" }), room({ id: "c", name: "Phòng 03" })];
    const after = [room({ id: "a", name: "Phòng 01", memberCount: 5, freeSeats: 1 }), room({ id: "b", name: "Phòng 02" }), room({ id: "c", name: "Phòng 03", status: "Locked" })];

    expect(changedRooms(before, after)).toEqual(["Phòng 01", "Phòng 03"]);
  });

  it("ignores rooms that came in or left because a filter or page changed", () => {
    expect(changedRooms([room({ id: "a" })], [room({ id: "b", memberCount: 1 })])).toEqual([]);
  });
});

describe("deadline helpers", () => {
  const now = Date.parse("2026-11-13T19:59:00Z");

  it("counts down in days and hours, and in minutes in the last hour", () => {
    expect(countdownText("2026-11-15T23:59:00Z", now)).toBe("2 ngày 4 giờ");
    expect(countdownText("2026-11-13T20:24:00Z", now)).toBe("25 phút");
    expect(countdownText("2026-11-13T19:59:00Z", now)).toBeNull();
    expect(countdownText(null, now)).toBeNull();
  });

  it("tells when the deadline has passed but the course is still open", () => {
    expect(deadlineReached("Published", "2026-11-13T19:59:00Z", now)).toBe(true);
    expect(deadlineReached("Published", "2026-11-13T20:00:00Z", now)).toBe(false);
    expect(deadlineReached("Expired", "2026-11-13T19:00:00Z", now)).toBe(false);
    expect(deadlineReached("Published", null, now)).toBe(false);
  });

  it("formats a short day and time", () => {
    expect(shortDateTime(new Date(2026, 10, 5, 8, 7).toISOString())).toBe("05/11, 08:07");
    expect(shortDateTime(null)).toBe("");
  });
});

describe("foldText", () => {
  it("makes a search match without Vietnamese marks", () => {
    expect(foldText("Đỗ Minh Tuấn")).toBe("do minh tuan");
  });
});
