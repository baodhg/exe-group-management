import { describe, expect, it } from "vitest";
import type { Placement, RoomSummary } from "../common/types";
import { canFinalize, chosenPlacements, freeSeatsOf, fullRoomText, moveAfterText, placementHeadline, placementSubline, roomFinalState, seatShortageText } from "./placement";

function room(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    id: "r1",
    courseId: "c1",
    name: "Phòng 01",
    topic: null,
    status: "Locked",
    capacity: 6,
    memberCount: 4,
    freeSeats: 2,
    groupTypeId: "g1",
    groupTypeCode: "EXE",
    leaderId: "lead",
    leaderName: "An",
    groupNo: null,
    majors: [],
    missingMajorSeats: 0,
    ...overrides,
  };
}

function placement(studentId: string, roomId: string): Placement {
  return { student: { studentId, studentCode: studentId, fullName: studentId, majorCode: "SE" }, roomId, roomName: roomId, reasons: [] };
}

describe("chosenPlacements", () => {
  it("skips unticked students and never overfills a room", () => {
    const free = freeSeatsOf([room({ id: "a", freeSeats: 1 }), room({ id: "b", freeSeats: 2 })]);
    const chosen = chosenPlacements([placement("s1", "a"), placement("s2", "a"), placement("s3", "b"), placement("s4", "b")], free, new Set(["s4"]));

    expect(chosen.map((item) => item.student.studentId)).toEqual(["s1", "s3"]);
  });

  it("drops a suggestion whose room is no longer listed", () => {
    expect(chosenPlacements([placement("s1", "gone")], freeSeatsOf([]), new Set())).toEqual([]);
  });
});

describe("fullRoomText", () => {
  it("explains the refused batch with the free seats of the first room that cannot take it", () => {
    const rooms = [room({ id: "a", name: "Phòng 04", freeSeats: 1 }), room({ id: "b", name: "Phòng 05", freeSeats: 3 })];

    expect(
      fullRoomText(
        [
          { studentId: "s1", roomId: "b" },
          { studentId: "s2", roomId: "a" },
          { studentId: "s3", roomId: "a" },
        ],
        rooms,
      ),
    ).toBe("Phòng 04 còn 1 chỗ cho 2 sinh viên. Không sinh viên nào được xếp.");
  });

  it("is silent when the local list shows enough seats", () => {
    expect(fullRoomText([{ studentId: "s1", roomId: "a" }], [room({ id: "a", freeSeats: 1 })])).toBeNull();
  });
});

describe("moveAfterText", () => {
  it("says what happens to the room left behind", () => {
    expect(moveAfterText(room({ memberCount: 1, leaderId: "s1" }), "s1")).toBe("Trở thành phòng trống");
    expect(moveAfterText(room({ memberCount: 4, leaderId: "s1" }), "s1")).toBe("Còn 3 người, đổi trưởng nhóm");
    expect(moveAfterText(room({ memberCount: 4, leaderId: "other" }), "s1")).toBe("Còn 3 người");
  });
});

describe("finalize gates", () => {
  it("needs everyone placed and every short room accepted", () => {
    expect(canFinalize({ unplaced: 1, exceptions: 0, accepted: false })).toBe(false);
    expect(canFinalize({ unplaced: 0, exceptions: 2, accepted: false })).toBe(false);
    expect(canFinalize({ unplaced: 0, exceptions: 2, accepted: true })).toBe(true);
    expect(canFinalize({ unplaced: 0, exceptions: 0, accepted: false })).toBe(true);
  });

  it("writes the headline and the line below it from the same facts", () => {
    expect(placementHeadline({ unplaced: 3, exceptions: 1, accepted: false })).toBe("Còn 3 bạn cần xếp");
    expect(placementHeadline({ unplaced: 0, exceptions: 1, accepted: false })).toBe("Còn 1 phòng chưa đủ điều kiện");
    expect(placementHeadline({ unplaced: 0, exceptions: 1, accepted: true })).toBe("Sẵn sàng chốt");
    expect(placementSubline({ unplaced: 3, exceptions: 0, accepted: false })).toBe("Đã hết hạn chọn phòng. Chỉ giáo vụ mới xếp hoặc chuyển được người từ lúc này.");
    expect(placementSubline({ unplaced: 0, exceptions: 2, accepted: false })).toBe("Cả lớp đã có phòng. Chấp nhận ngoại lệ để chốt các phòng còn thiếu.");
    expect(placementSubline({ unplaced: 0, exceptions: 2, accepted: true })).toBe("Cả lớp đã có phòng, 2 phòng được chấp nhận ngoại lệ.");
    expect(placementSubline({ unplaced: 0, exceptions: 0, accepted: false })).toBe("Cả lớp đã có phòng và mọi phòng đều đủ điều kiện.");
  });
});

describe("roomFinalState", () => {
  it("tells which rooms will be deleted, which pass and what the others miss", () => {
    expect(roomFinalState(room({ memberCount: 0 }), 4)).toEqual({ kind: "empty", label: "Sẽ xoá" });
    expect(roomFinalState(room({ memberCount: 4 }), 4)).toEqual({ kind: "ok", label: "Đủ điều kiện" });
    expect(roomFinalState(room({ memberCount: 2 }), 4)).toEqual({ kind: "short", label: "Thiếu 2 người" });
    expect(roomFinalState(room({ memberCount: 4, majors: [{ majorId: "m", majorCode: "MKT", members: 0, required: 1 }], missingMajorSeats: 1 }), 4)).toEqual({ kind: "short", label: "Thiếu MKT" });
  });
});

describe("seatShortageText", () => {
  it("compares the students with the seats of all rooms", () => {
    const rooms = Array.from({ length: 5 }, () => room({ capacity: 6 }));

    expect(seatShortageText(33, rooms)).toBe("33 sinh viên nhưng 5 phòng chỉ có 30 chỗ. Sau khi mở lớp không tạo thêm phòng được.");
  });
});
