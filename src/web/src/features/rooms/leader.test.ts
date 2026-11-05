import { describe, expect, it } from "vitest";
import { decisionNote, leadsRoom } from "./leader";

describe("leader", () => {
  it("lets only the leader manage the room while the course is published", () => {
    expect(leadsRoom({ leaderId: "u1" }, "u1", "Published")).toBe(true);
    expect(leadsRoom({ leaderId: "u1" }, "u2", "Published")).toBe(false);
    expect(leadsRoom({ leaderId: "u1" }, "u1", "Expired")).toBe(false);
    expect(leadsRoom({ leaderId: null }, undefined, "Published")).toBe(false);
  });

  it("explains the immediate result of an approval", () => {
    expect(decisionNote({ studentName: "An", studentCode: "SE1", status: "Approved", reasonCode: null })).toBe("An: Đã duyệt");
    expect(decisionNote({ studentName: null, studentCode: "SE2", status: "Rejected", reasonCode: "COMPOSITION_RULE" })).toBe(
      "SE2: Bị từ chối – Không còn đủ chỗ cho ngành phòng cần",
    );
  });
});
