import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api/apiClient";
import type { Course } from "../common/types";
import { countdownText, courseForSemester, deniedStatus, hasErrorCode, heroCopy, isPhaseStale, phaseStep, publishedCourse, requestReason, sumMembers } from "./studentCourse";

const course = (id: string, overrides: Partial<Course> = {}): Course => ({
  id,
  semesterId: "fa26",
  semesterCode: "FA26",
  subjectId: "s",
  subjectCode: "EXE101",
  subjectName: "Experiential Entrepreneurship 1",
  classCode: id,
  lecturerId: null,
  lecturerName: null,
  minGroupSize: 4,
  maxGroupSize: 6,
  roomFactor: 1,
  phase: "Setup",
  publishAt: null,
  expireAt: null,
  finalizedAt: null,
  studentCount: 30,
  roomCount: 6,
  ...overrides,
});

const now = new Date("2026-11-10T00:00:00Z").getTime();

describe("phaseStep", () => {
  it("maps each phase to its step", () => {
    expect([phaseStep("Setup"), phaseStep("Published"), phaseStep("Expired"), phaseStep("Finalized")]).toEqual([0, 1, 2, 3]);
  });
});

describe("countdownText", () => {
  it("shows days and hours", () => {
    expect(countdownText("2026-11-12T04:00:00Z", now)).toBe("2 ngày 4 giờ");
  });

  it("drops zero hours and shrinks to hours and minutes", () => {
    expect(countdownText("2026-11-12T00:00:00Z", now)).toBe("2 ngày");
    expect(countdownText("2026-11-10T03:20:00Z", now)).toBe("3 giờ 20 phút");
    expect(countdownText("2026-11-10T00:20:00Z", now)).toBe("20 phút");
  });

  it("never shows less than a minute while time is left", () => {
    expect(countdownText("2026-11-10T00:00:10Z", now)).toBe("1 phút");
  });

  it("says when the moment has passed", () => {
    expect(countdownText("2026-11-09T00:00:00Z", now)).toBe("Đã hết hạn");
  });
});

describe("isPhaseStale", () => {
  it("is stale when the deadline passed or the server refused the phase", () => {
    expect(isPhaseStale("Published", { deadlineReached: true, refused: false })).toBe(true);
    expect(isPhaseStale("Published", { deadlineReached: false, refused: true })).toBe(true);
  });

  it("is fresh otherwise, and only a published course can go stale", () => {
    expect(isPhaseStale("Published", { deadlineReached: false, refused: false })).toBe(false);
    expect(isPhaseStale("Expired", { deadlineReached: true, refused: true })).toBe(false);
  });
});

describe("heroCopy", () => {
  it("tells a student without a room how to choose", () => {
    expect(heroCopy("Published", false).title).toBe("Chọn phòng");
    expect(heroCopy("Published", false).text).toContain("Bạn chưa có phòng");
  });

  it("tells a seated student the board is for viewing", () => {
    expect(heroCopy("Published", true).title).toBe("Bảng phòng");
  });

  it("changes the expired sentence with the room", () => {
    expect(heroCopy("Expired", true).text).toContain("Không còn rời hoặc đổi phòng");
    expect(heroCopy("Expired", false).text).toContain("Giáo vụ sẽ xếp bạn");
  });

  it("explains the setup phase", () => {
    expect(heroCopy("Setup", false).title).toBe("Lớp chưa mở tìm nhóm");
  });
});

describe("courseForSemester", () => {
  it("prefers the published course of the semester, then setup, then any", () => {
    const list = [course("a", { phase: "Expired" }), course("b", { phase: "Setup" }), course("c", { phase: "Published" }), course("d", { phase: "Published", semesterId: "other" })];
    expect(courseForSemester(list, "fa26")?.id).toBe("c");
    expect(courseForSemester(list.slice(0, 2), "fa26")?.id).toBe("b");
    expect(courseForSemester(list.slice(0, 1), "fa26")?.id).toBe("a");
  });

  it("finds nothing for a semester the student has no course in", () => {
    expect(courseForSemester([course("a")], "other")).toBeUndefined();
  });
});

describe("publishedCourse", () => {
  it("finds the course an empty application list should point to", () => {
    expect(publishedCourse([course("a", { phase: "Expired" }), course("b", { phase: "Published" })])?.id).toBe("b");
    expect(publishedCourse([course("a")])).toBeUndefined();
  });
});

describe("sumMembers", () => {
  it("adds the people seated across the rooms", () => {
    expect(sumMembers([{ memberCount: 2 }, { memberCount: 3 }])).toBe(5);
    expect(sumMembers([])).toBe(0);
  });
});

describe("error helpers", () => {
  const error = (status: number, code: string) => new ApiError(status, "failed", [{ code, field: null, message: "failed" }], null);

  it("treats 403 and 404 as a denied page and nothing else", () => {
    expect(deniedStatus(error(403, "FORBIDDEN"))).toBe(403);
    expect(deniedStatus(error(404, "NOT_FOUND"))).toBe(404);
    expect(deniedStatus(error(500, "INTERNAL_ERROR"))).toBeNull();
    expect(deniedStatus(new Error("network"))).toBeNull();
  });

  it("matches an API error by its code", () => {
    expect(hasErrorCode(error(409, "COURSE_NOT_PUBLISHED"), "COURSE_NOT_PUBLISHED")).toBe(true);
    expect(hasErrorCode(error(409, "ROOM_FULL"), "COURSE_NOT_PUBLISHED")).toBe(false);
    expect(hasErrorCode(null, "ROOM_FULL")).toBe(false);
  });
});

describe("requestReason", () => {
  it("uses the waiting and approved sentences when the server gives no code", () => {
    expect(requestReason({ status: "Pending", reasonCode: null })).toBe("Chờ trưởng nhóm duyệt");
    expect(requestReason({ status: "Approved", reasonCode: null })).toBe("Trưởng nhóm đã duyệt");
  });

  it("translates a reason code", () => {
    expect(requestReason({ status: "Cancelled", reasonCode: "WITHDRAWN" })).toBe("Bạn đã rút đơn");
  });

  it("shows nothing when a closed request has no reason", () => {
    expect(requestReason({ status: "Rejected", reasonCode: null })).toBe("");
  });
});
