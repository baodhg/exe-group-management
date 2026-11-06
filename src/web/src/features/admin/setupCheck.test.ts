import { describe, expect, it } from "vitest";
import type { GroupType } from "../common/types";
import { majorRequirement, setupCheck } from "./setupCheck";

const exe: GroupType = {
  id: "g",
  code: "EXE",
  name: "Nhóm khởi nghiệp EXE",
  minDistinctMajors: 2,
  majors: [
    { majorId: "se", majorCode: "SE", majorName: "SE", minMembers: 1 },
    { majorId: "mkt", majorCode: "MKT", majorName: "MKT", minMembers: 1 },
  ],
};

const base = { students: 30, maxGroupSize: 6, minGroupSize: 4, roomFactor: 1.2, majorCounts: { SE: 12, MKT: 6, GD: 6, IB: 6 }, rule: exe };

describe("setupCheck", () => {
  it("asks to pick a group type before judging the majors", () => {
    const check = setupCheck({ ...base, rule: null });

    expect(check.verdict).toBe("Chọn loại nhóm để kiểm tra ngành");
    expect(check.checks[1]).toEqual({ label: "Mỗi ngành bắt buộc đủ cho 5 nhóm", ok: false, value: "Chưa chọn" });
  });

  it("computes rooms, seats and the average per room", () => {
    const check = setupCheck(base);

    expect(check).toMatchObject({ rooms: 6, minGroups: 5, verdict: "Lớp ghép được" });
    expect(check.checks).toEqual([
      { label: "Đủ chỗ cho 30 sinh viên", ok: true, value: "36 chỗ" },
      { label: "Mỗi ngành bắt buộc đủ cho 5 nhóm", ok: true, value: "Đủ" },
      { label: "Trung bình mỗi phòng từ 4 người", ok: true, value: "5,0 người" },
    ]);
  });

  it("warns when a required major is too small for the minimum groups", () => {
    expect(setupCheck({ ...base, majorCounts: { SE: 12, MKT: 3 } }).verdict).toBe("Thiếu ngành bắt buộc cho số nhóm tối thiểu");
  });

  it("warns when too many rooms would leave them thin", () => {
    expect(setupCheck({ ...base, roomFactor: 9 }).verdict).toBe("Dư nhiều phòng, dễ có phòng lẻ người");
  });

  it("does not divide by zero on an empty class", () => {
    expect(setupCheck({ ...base, students: 0, majorCounts: {} }).checks[0]).toEqual({ label: "Đủ chỗ cho 0 sinh viên", ok: false, value: "0 chỗ" });
  });
});

describe("majorRequirement", () => {
  it("has no judgement until a group type is picked", () => {
    expect(majorRequirement("SE", 12, 5, null)).toEqual({ required: null, supply: null });
  });

  it("rates a required major against the minimum groups", () => {
    expect(majorRequirement("SE", 12, 5, exe)).toEqual({ required: true, supply: "enough" });
    expect(majorRequirement("MKT", 6, 5, exe)).toEqual({ required: true, supply: "tight" });
    expect(majorRequirement("MKT", 3, 5, exe)).toEqual({ required: true, supply: "short" });
  });

  it("does not rate a major the group type does not ask for", () => {
    expect(majorRequirement("GD", 1, 5, exe)).toEqual({ required: false, supply: null });
  });
});
