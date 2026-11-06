import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import type { MajorCount, RoomDetail, RoomMember } from "../common/types";
import { countdownText } from "../courses/deadline";
import { capabilitiesOf, dayTime, deadlineCard, isBlockedRoom, leaveOutcome, leftRoomText, roomChecks, studentActionFor, unmetConditions, viewerOf, visitorNote, type StudentRoomState } from "./roomActions";

const base: StudentRoomState = {
  phase: "Published",
  room: { id: "room-1", status: "Open", freeSeats: 2 },
  myRoomId: null,
  hasPendingApplication: false,
};

function member(studentId: string, joinedAt: string, fullName = studentId): RoomMember {
  return { studentId, studentCode: studentId, fullName, majorId: "m", majorCode: "SE", joinedAt, joinedVia: "Open", isLeader: false, skills: [] };
}

function major(majorCode: string, members: number, required: number): MajorCount {
  return { majorId: majorCode, majorCode, members, required };
}

function room(change: Partial<RoomDetail> = {}): RoomDetail {
  return {
    id: "room-1",
    courseId: "c1",
    name: "Phòng 03",
    topic: null,
    status: "Locked",
    capacity: 6,
    memberCount: 2,
    freeSeats: 4,
    groupTypeId: "g",
    groupTypeCode: "EXE",
    groupTypeName: "EXE startup team",
    leaderId: "lead",
    leaderName: "Bình",
    groupNo: null,
    minGroupSize: 4,
    minDistinctMajors: 2,
    eligible: false,
    majors: [],
    members: [member("lead", "2026-11-01T01:00:00Z"), member("late", "2026-11-03T01:00:00Z"), member("early", "2026-11-02T01:00:00Z", "Chi")],
    ...change,
  };
}

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, code, [{ code, field: null, message: code }], null);
}

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

describe("viewerOf", () => {
  it("tells the leader, a member and a student outside the room apart", () => {
    expect(viewerOf(room(), "lead", true)).toBe("leader");
    expect(viewerOf(room(), "late", true)).toBe("member");
    expect(viewerOf(room(), "other", true)).toBe("visitor");
  });

  it("treats a lecturer or an administrator as staff", () => {
    expect(viewerOf(room(), "lecturer", false)).toBe("staff");
    expect(viewerOf(room(), "lead", false)).toBe("staff");
  });
});

describe("capabilitiesOf", () => {
  it("never gives staff chat or leaving, in any phase", () => {
    for (const phase of ["Setup", "Published", "Expired", "Finalized"] as const) {
      const can = capabilitiesOf("staff", phase);
      expect(can.chat).toBe(false);
      expect(can.leave).toBe(false);
      expect(can.readOnly).toBe(true);
    }
  });

  it("does not load chat for a student outside the room", () => {
    expect(capabilitiesOf("visitor", "Published").chat).toBe(false);
    expect(capabilitiesOf("visitor", "Finalized").chat).toBe(false);
    expect(capabilitiesOf("visitor", "Published").readOnly).toBe(false);
  });

  it("keeps chat for members in every phase and allows leaving only while published", () => {
    expect(capabilitiesOf("member", "Expired").chat).toBe(true);
    expect(capabilitiesOf("leader", "Finalized").chat).toBe(true);
    expect(capabilitiesOf("member", "Published").leave).toBe(true);
    expect(capabilitiesOf("leader", "Published").leave).toBe(true);
    expect(capabilitiesOf("member", "Expired").leave).toBe(false);
    expect(capabilitiesOf("leader", "Finalized").leave).toBe(false);
  });

  it("shows the after-deadline rules, deadline card, suggestions and join details in the right phase", () => {
    expect(capabilitiesOf("member", "Expired").afterDeadline).toBe(true);
    expect(capabilitiesOf("leader", "Expired").afterDeadline).toBe(false);
    expect(capabilitiesOf("member", "Published").deadlineCard).toBe(true);
    expect(capabilitiesOf("leader", "Expired").deadlineCard).toBe(true);
    expect(capabilitiesOf("member", "Finalized").deadlineCard).toBe(false);
    expect(capabilitiesOf("member", "Published").suggestions).toBe(true);
    expect(capabilitiesOf("leader", "Published").suggestions).toBe(false);
    expect(capabilitiesOf("member", "Finalized").joinDetails).toBe(true);
    expect(capabilitiesOf("visitor", "Finalized").joinDetails).toBe(false);
  });
});

describe("visitorNote", () => {
  it("explains why a student cannot enter while the course is published", () => {
    expect(visitorNote(base)).toBeNull();
    expect(visitorNote({ ...base, myRoomId: "room-2" })).toBe("Bạn đã có phòng trong lớp này. Muốn vào phòng này, hãy rời phòng hiện tại trước.");
    expect(visitorNote({ ...base, room: { ...base.room, freeSeats: 0 } })).toBe("Phòng đã đủ người.");
  });

  it("says nothing outside the published phase or for my own room", () => {
    expect(visitorNote({ ...base, phase: "Expired", myRoomId: "room-2" })).toBeNull();
    expect(visitorNote({ ...base, myRoomId: "room-1" })).toBeNull();
  });
});

describe("leaveOutcome", () => {
  it("names the member who joined earliest as the next leader", () => {
    expect(leaveOutcome(room(), "lead", 0)).toEqual({ kind: "succession", successor: "Chi" });
  });

  it("warns the last person of a locked room that it reopens and cancels applications", () => {
    const alone = room({ members: [member("lead", "2026-11-01T01:00:00Z")] });
    expect(leaveOutcome(alone, "lead", 2)).toEqual({ kind: "reopens", pending: 2 });
    expect(leaveOutcome({ ...alone, status: "Open" }, "lead", 0)).toEqual({ kind: "plain" });
  });

  it("has nothing special for a plain member", () => {
    expect(leaveOutcome(room(), "late", 3)).toEqual({ kind: "plain" });
  });
});

describe("leftRoomText", () => {
  it("names the leader the server actually chose", () => {
    expect(leftRoomText({ leaderName: "Lan" }, { kind: "succession", successor: "Chi" })).toBe("Lan là trưởng nhóm mới của phòng.");
    expect(leftRoomText({ leaderName: null }, { kind: "succession", successor: "Chi" })).toBe("Chi là trưởng nhóm mới của phòng.");
  });

  it("describes the emptied locked room", () => {
    expect(leftRoomText({ leaderName: null }, { kind: "reopens", pending: 2 })).toBe("Phòng không còn ai nên đã tự mở lại, các đơn đang chờ đã bị huỷ.");
    expect(leftRoomText({ leaderName: null }, { kind: "reopens", pending: 0 })).toBe("Phòng không còn ai nên đã tự mở lại.");
  });

  it("falls back to the plain message", () => {
    expect(leftRoomText({ leaderName: "Bình" }, { kind: "plain" })).toBe("Bạn có thể vào phòng khác nếu còn chỗ.");
  });
});

describe("roomChecks", () => {
  it("lists size, distinct majors and each required major with current counts", () => {
    const checks = roomChecks(room({ memberCount: 3, minDistinctMajors: 2, majors: [major("SE", 2, 1), major("GD", 1, 0), major("MKT", 0, 1)] }));
    expect(checks).toEqual([
      { ok: false, label: "Ít nhất 4 người", value: "Đang có 3" },
      { ok: true, label: "Ít nhất 2 ngành khác nhau", value: "Đang có 2" },
      { ok: true, label: "Ngành SE: ít nhất 1 người", value: "Đang có 2" },
      { ok: false, label: "Ngành MKT: ít nhất 1 người", value: "Đang có 0" },
    ]);
  });
});

describe("unmetConditions", () => {
  it("names what a group finalized by exception still lacks", () => {
    expect(unmetConditions(room({ memberCount: 6, majors: [major("SE", 5, 1), major("GD", 1, 0), major("MKT", 0, 1)] }))).toEqual(["Ngành MKT"]);
    expect(unmetConditions(room({ memberCount: 2, minDistinctMajors: 2, majors: [major("SE", 2, 1)] }))).toEqual(["Đủ 4 người", "Đủ 2 ngành khác nhau"]);
  });
});

describe("countdownText", () => {
  const now = new Date("2026-11-13T00:00:00Z").getTime();

  it("counts down in the two largest units", () => {
    expect(countdownText("2026-11-15T04:00:00Z", now)).toBe("2 ngày 4 giờ");
    expect(countdownText("2026-11-15T00:00:00Z", now)).toBe("2 ngày");
    expect(countdownText("2026-11-13T05:12:00Z", now)).toBe("5 giờ 12 phút");
    expect(countdownText("2026-11-13T00:09:00Z", now)).toBe("9 phút");
  });

  it("has no countdown once the deadline passed or when there is none", () => {
    expect(countdownText("2026-11-12T00:00:00Z", now)).toBeNull();
    expect(countdownText(null, now)).toBeNull();
  });
});

describe("deadlineCard", () => {
  const now = new Date("2026-11-13T00:00:00Z").getTime();
  const expireAt = "2026-11-15T04:00:00Z";

  it("counts down differently for a member and the leader while published", () => {
    expect(deadlineCard("member", "Published", expireAt, now)).toEqual({ label: "Còn được đổi phòng trong", value: "2 ngày 4 giờ", note: `Hạn ${dayTime(expireAt)}` });
    expect(deadlineCard("leader", "Published", expireAt, now)).toMatchObject({ label: "Hạn chọn phòng", value: "2 ngày 4 giờ" });
  });

  it("shows the passed deadline and what happens next once expired", () => {
    expect(deadlineCard("member", "Expired", expireAt, now)).toEqual({ label: "Đã hết hạn chọn phòng", value: dayTime(expireAt), note: "Giáo vụ xếp người còn lại rồi chốt nhóm" });
  });

  it("falls back to the date when the scheduler has not closed a passed deadline yet", () => {
    expect(deadlineCard("member", "Published", "2026-11-12T00:00:00Z", now).value).toBe(dayTime("2026-11-12T00:00:00Z"));
  });
});

describe("dayTime", () => {
  it("writes day, month and time the way the design does", () => {
    expect(dayTime(new Date(2026, 10, 5, 8, 3).toISOString())).toBe("05/11, 08:03");
    expect(dayTime(null)).toBe("");
  });
});

describe("isBlockedRoom", () => {
  it("treats forbidden and missing rooms as final, everything else as retryable", () => {
    expect(isBlockedRoom(apiError(403, "FORBIDDEN"))).toBe(true);
    expect(isBlockedRoom(apiError(404, "NOT_FOUND"))).toBe(true);
    expect(isBlockedRoom(apiError(500, "INTERNAL_ERROR"))).toBe(false);
    expect(isBlockedRoom(new Error("offline"))).toBe(false);
  });
});
