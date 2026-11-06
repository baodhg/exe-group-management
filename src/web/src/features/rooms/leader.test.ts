import { describe, expect, it } from "vitest";
import type { MajorCount } from "../common/types";
import { applicationHint, approvalFillsRoom, decisionNote, leaderKeepsRecords, leadsRoom } from "./leader";

function major(majorCode: string, members: number, required: number): MajorCount {
  return { majorId: majorCode, majorCode, members, required };
}

describe("leader", () => {
  it("lets only the leader manage the room while the course is published", () => {
    expect(leadsRoom({ leaderId: "u1" }, "u1", "Published")).toBe(true);
    expect(leadsRoom({ leaderId: "u1" }, "u2", "Published")).toBe(false);
    expect(leadsRoom({ leaderId: "u1" }, "u1", "Expired")).toBe(false);
    expect(leadsRoom({ leaderId: null }, undefined, "Published")).toBe(false);
  });

  it("keeps the topic and the application history for the leader until the course is finalized", () => {
    expect(leaderKeepsRecords({ leaderId: "u1" }, "u1", "Published")).toBe(true);
    expect(leaderKeepsRecords({ leaderId: "u1" }, "u1", "Expired")).toBe(true);
    expect(leaderKeepsRecords({ leaderId: "u1" }, "u1", "Finalized")).toBe(false);
    expect(leaderKeepsRecords({ leaderId: "u1" }, "u2", "Expired")).toBe(false);
    expect(leaderKeepsRecords({ leaderId: null }, undefined, "Expired")).toBe(false);
  });

  it("explains the immediate result of an approval", () => {
    expect(decisionNote({ studentName: "An", studentCode: "SE1", status: "Approved", reasonCode: null })).toBe("An: Đã duyệt");
    expect(decisionNote({ studentName: null, studentCode: "SE2", status: "Rejected", reasonCode: "COMPOSITION_RULE" })).toBe(
      "SE2: Bị từ chối – Không còn đủ chỗ cho ngành phòng cần",
    );
  });

  it("reports the server's reason when an approval comes back cancelled", () => {
    expect(decisionNote({ studentName: "Khoa", studentCode: "SE3", status: "Cancelled", reasonCode: "JOINED_ANOTHER_ROOM" })).toBe("Khoa: Đã hủy – Bạn đã vào phòng khác");
  });

  it("notices that an approval took the last seat and closed the other applications", () => {
    expect(approvalFillsRoom({ status: "Approved" }, { freeSeats: 1 }, 2)).toBe(true);
    expect(approvalFillsRoom({ status: "Approved" }, { freeSeats: 1 }, 1)).toBe(false);
    expect(approvalFillsRoom({ status: "Approved" }, { freeSeats: 2 }, 3)).toBe(false);
    expect(approvalFillsRoom({ status: "Rejected" }, { freeSeats: 1 }, 3)).toBe(false);
  });
});

describe("applicationHint", () => {
  const room = { capacity: 6, memberCount: 3, freeSeats: 3, minDistinctMajors: 2, majors: [major("SE", 2, 1), major("GD", 1, 0), major("MKT", 0, 1)] };

  it("points out an applicant of a major the room lacks", () => {
    expect(applicationHint({ majorCode: "MKT" }, room)).toEqual({ kind: "fills", text: "Đúng ngành MKT đang thiếu" });
  });

  it("says nothing when the seat is free for anyone", () => {
    expect(applicationHint({ majorCode: "SE" }, room)).toBeNull();
    expect(applicationHint({ majorCode: null }, { ...room, majors: [major("SE", 2, 1), major("GD", 1, 0)] })).toBeNull();
  });

  it("warns when the seats left are held for the missing majors, the same way the server decides", () => {
    const tight = { ...room, memberCount: 5, freeSeats: 1, majors: [major("SE", 3, 1), major("GD", 2, 0), major("MKT", 0, 1)] };
    expect(applicationHint({ majorCode: "IB" }, tight)).toEqual({ kind: "tight", text: "Chỗ còn lại đang giữ cho MKT" });
    expect(applicationHint({ majorCode: "MKT" }, tight)).toEqual({ kind: "fills", text: "Đúng ngành MKT đang thiếu" });
  });

  it("counts the distinct majors rule when no single major is missing", () => {
    const sameMajor = { capacity: 4, memberCount: 3, freeSeats: 1, minDistinctMajors: 2, majors: [major("SE", 3, 1)] };
    expect(applicationHint({ majorCode: "SE" }, sameMajor)).toEqual({ kind: "tight", text: "Chỗ còn lại đang giữ cho ngành khác" });
    expect(applicationHint({ majorCode: "GD" }, sameMajor)).toBeNull();
  });

  it("says the room is full before anything else", () => {
    const full = { ...room, memberCount: 6, freeSeats: 0, majors: [major("SE", 4, 1), major("GD", 2, 0), major("MKT", 0, 1)] };
    expect(applicationHint({ majorCode: "MKT" }, full)).toEqual({ kind: "tight", text: "Phòng đã đủ người" });
  });
});
