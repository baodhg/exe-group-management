import { describe, expect, it } from "vitest";
import { missingMajorsText, missingMembersText } from "./overview";

describe("overview texts", () => {
  it("names the majors a room still misses", () => {
    const room = {
      missingMajorSeats: 1,
      majors: [
        { majorId: "m1", majorCode: "AI", members: 0, required: 1 },
        { majorId: "m2", majorCode: "SE", members: 3, required: 1 },
      ],
    };

    expect(missingMajorsText(room)).toBe("AI 0/1");
  });

  it("falls back to the seat count when only distinct majors are missing, and to a dash when nothing is", () => {
    expect(missingMajorsText({ missingMajorSeats: 2, majors: [] })).toBe("2 chỗ cho ngành khác");
    expect(missingMajorsText({ missingMajorSeats: 0, majors: [] })).toBe("—");
    expect(missingMembersText({ missingMembers: 2 }, 4)).toBe("2 người (tối thiểu 4)");
    expect(missingMembersText({ missingMembers: 0 }, 4)).toBe("—");
  });
});
