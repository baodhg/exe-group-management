import { describe, expect, it } from "vitest";
import type { MajorCount, RoomDetail, RoomSummary } from "../common/types";
import {
  defaultRoomSelection,
  filterLackingMajor,
  finalExceptionText,
  fitsMajor,
  lacksMajor,
  pageRooms,
  rankedRoomIds,
  roomChecks,
  roomHint,
  roomPanelFor,
  sortByFit,
  type RoomPanelInput,
} from "./roomBoardLogic";

const major = (majorId: string, members: number, required: number): MajorCount => ({ majorId, majorCode: majorId.toUpperCase(), members, required });

const room = (id: string, overrides: Partial<RoomSummary> = {}): RoomSummary => ({
  id,
  courseId: "course",
  name: `Phòng ${id}`,
  topic: null,
  status: "Open",
  capacity: 6,
  memberCount: 0,
  freeSeats: 6,
  groupTypeId: "type",
  groupTypeCode: "EXE",
  leaderId: null,
  leaderName: null,
  groupNo: null,
  majors: [],
  missingMajorSeats: 0,
  ...overrides,
});

describe("lacksMajor", () => {
  it("is true while the room has nobody of the major", () => {
    expect(lacksMajor(room("a", { majors: [major("se", 2, 1)] }), "mkt")).toBe(true);
    expect(lacksMajor(room("a", { majors: [major("mkt", 0, 1)] }), "mkt")).toBe(true);
  });

  it("is true while the major is below what the group type requires", () => {
    expect(lacksMajor(room("a", { majors: [major("mkt", 1, 2)] }), "mkt")).toBe(true);
  });

  it("is false once the major is present and the requirement is met", () => {
    expect(lacksMajor(room("a", { majors: [major("mkt", 1, 1)] }), "mkt")).toBe(false);
    expect(lacksMajor(room("a", { majors: [major("mkt", 1, 0)] }), "mkt")).toBe(false);
  });

  it("counts a room without major data as lacking", () => {
    expect(lacksMajor(room("a", { majors: undefined }), "mkt")).toBe(true);
  });

  it("filters the board down to the rooms that lack the major", () => {
    const rooms = [room("a", { majors: [major("mkt", 1, 1)] }), room("b", { majors: [major("se", 1, 1)] })];
    expect(filterLackingMajor(rooms, "mkt").map((item) => item.id)).toEqual(["b"]);
  });
});

describe("rankedRoomIds", () => {
  it("returns the order of a ranked answer", () => {
    expect(rankedRoomIds({ ranked: true, rooms: [{ room: room("b"), score: 2, reasons: [] }, { room: room("a"), score: 1, reasons: [] }] })).toEqual(["b", "a"]);
  });

  it("ignores an unranked or missing answer, whose order means nothing", () => {
    expect(rankedRoomIds({ ranked: false, rooms: [{ room: room("b"), score: null, reasons: [] }] })).toEqual([]);
    expect(rankedRoomIds(undefined)).toEqual([]);
  });
});

describe("sortByFit", () => {
  it("puts ranked rooms first in rank order, then the rest by name", () => {
    const rooms = [room("10"), room("02"), room("09"), room("03")];
    expect(sortByFit(rooms, ["09", "03"]).map((item) => item.id)).toEqual(["09", "03", "02", "10"]);
  });

  it("falls back to name order with no ranking and leaves the input alone", () => {
    const rooms = [room("10"), room("02")];
    expect(sortByFit(rooms, []).map((item) => item.id)).toEqual(["02", "10"]);
    expect(rooms[0]?.id).toBe("10");
  });

  it("orders names by number, not by text", () => {
    const rooms = [room("x", { name: "Phòng 10" }), room("y", { name: "Phòng 9" })];
    expect(sortByFit(rooms, []).map((item) => item.id)).toEqual(["y", "x"]);
  });

  it("skips ranked rooms the board does not hold", () => {
    expect(sortByFit([room("a")], ["gone", "a"]).map((item) => item.id)).toEqual(["a"]);
  });
});

describe("pageRooms", () => {
  const rooms = Array.from({ length: 5 }, (_, index) => room(String(index)));

  it("cuts one page and reports the totals", () => {
    const result = pageRooms(rooms, 2, 2);
    expect(result.items.map((item) => item.id)).toEqual(["2", "3"]);
    expect(result.pagination).toEqual({ page: 2, pageSize: 2, totalItems: 5, totalPages: 3 });
  });

  it("clamps to the last page when a filter shrank the list", () => {
    const result = pageRooms(rooms, 9, 2);
    expect(result.items.map((item) => item.id)).toEqual(["4"]);
    expect(result.pagination.page).toBe(3);
  });

  it("reports an empty list on page one", () => {
    expect(pageRooms([], 3, 2).pagination).toEqual({ page: 1, pageSize: 2, totalItems: 0, totalPages: 0 });
  });
});

describe("fitsMajor", () => {
  it("refuses a full room", () => {
    expect(fitsMajor(room("a", { freeSeats: 0, memberCount: 6 }), "mkt")).toBe(false);
  });

  it("accepts a needed major into the last reserved seat", () => {
    expect(fitsMajor(room("a", { freeSeats: 1, memberCount: 5, missingMajorSeats: 1, majors: [major("mkt", 0, 1)] }), "mkt")).toBe(true);
  });

  it("refuses another major when the free seats are all reserved", () => {
    expect(fitsMajor(room("a", { freeSeats: 1, memberCount: 5, missingMajorSeats: 1, majors: [major("mkt", 0, 1), major("se", 5, 1)] }), "se")).toBe(false);
  });

  it("accepts another major when a seat stays free beyond the reserved ones", () => {
    expect(fitsMajor(room("a", { freeSeats: 2, memberCount: 4, missingMajorSeats: 1, majors: [major("mkt", 0, 1), major("se", 4, 1)] }), "se")).toBe(true);
  });

  it("accepts a new major into a seat reserved only for variety", () => {
    expect(fitsMajor(room("a", { freeSeats: 1, memberCount: 5, missingMajorSeats: 1, majors: [major("se", 5, 1)] }), "gd")).toBe(true);
  });

  it("refuses a present major when the last seat is reserved for variety", () => {
    expect(fitsMajor(room("a", { freeSeats: 1, memberCount: 5, missingMajorSeats: 1, majors: [major("se", 5, 1)] }), "se")).toBe(false);
  });

  it("leaves the decision to the server when the room has no major data", () => {
    expect(fitsMajor(room("a", { freeSeats: 1, memberCount: 5, missingMajorSeats: undefined, majors: undefined }), "se")).toBe(true);
  });
});

describe("roomHint", () => {
  const needsTwo = room("a", { freeSeats: 3, memberCount: 3, missingMajorSeats: 2, majors: [major("se", 0, 1), major("mkt", 0, 1), major("gd", 3, 0)] });

  it("tells the reserved seats on a staff board", () => {
    expect(roomHint(needsTwo)).toEqual({ tone: "ink", text: "Còn thiếu ngành SE, MKT, 2 chỗ được giữ cho các ngành này" });
  });

  it("tells reserved seats kept only for variety", () => {
    expect(roomHint(room("a", { missingMajorSeats: 1 }))).toEqual({ tone: "ink", text: "1 chỗ được giữ cho ngành khác" });
  });

  it("stays silent on a room with nothing to say", () => {
    expect(roomHint(room("a"))).toBeNull();
  });

  it("says full neutrally unless the student is choosing", () => {
    const full = room("a", { freeSeats: 0, memberCount: 6 });
    expect(roomHint(full)).toEqual({ tone: "muted", text: "Phòng đã đủ người" });
    expect(roomHint(full, { choosing: true })).toEqual({ tone: "bad", text: "Phòng đã đủ người" });
    expect(roomHint({ ...full, status: "Locked" }, { choosing: true })).toEqual({ tone: "bad", text: "Phòng đang khoá và đã đủ người" });
  });

  it("names the student's major when the room cannot seat it", () => {
    const reserved = room("a", { freeSeats: 1, memberCount: 5, missingMajorSeats: 1, majors: [major("mkt", 0, 1), major("se", 5, 1)] });
    expect(roomHint(reserved, { choosing: true, majorId: "se", majorCode: "SE" })).toEqual({ tone: "bad", text: "Không còn chỗ cho ngành SE" });
  });

  it("puts a removal ahead of every other reason", () => {
    expect(roomHint(room("a", { freeSeats: 0 }), { choosing: true, removed: true })).toEqual({ tone: "bad", text: "Bạn đã bị xoá khỏi phòng này" });
  });

  it("says nothing on a finalized room", () => {
    expect(roomHint({ ...needsTwo, status: "Finalized" })).toBeNull();
  });
});

describe("finalExceptionText", () => {
  it("is empty for a group that met its rules", () => {
    expect(finalExceptionText(room("a", { memberCount: 4, majors: [major("se", 2, 1)] }), 4)).toBeNull();
  });

  it("names the missing majors", () => {
    expect(finalExceptionText(room("a", { memberCount: 4, missingMajorSeats: 1, majors: [major("mkt", 0, 1)] }), 4)).toBe("Thiếu ngành MKT, giáo vụ chấp nhận ngoại lệ khi chốt");
  });

  it("names a shortage of people", () => {
    expect(finalExceptionText(room("a", { memberCount: 3 }), 4)).toBe("Chưa đủ 4 người, giáo vụ chấp nhận ngoại lệ khi chốt");
  });
});

describe("defaultRoomSelection", () => {
  it("prefers the choice, then my room, a pending request, the top suggestion and the first room", () => {
    const all = { chosenId: "1", myRoomId: "2", pendingRoomIds: ["3"], suggestedIds: ["4"], firstRoomId: "5" };
    expect(defaultRoomSelection(all)).toBe("1");
    expect(defaultRoomSelection({ ...all, chosenId: null })).toBe("2");
    expect(defaultRoomSelection({ ...all, chosenId: null, myRoomId: null })).toBe("3");
    expect(defaultRoomSelection({ ...all, chosenId: null, myRoomId: null, pendingRoomIds: [] })).toBe("4");
    expect(defaultRoomSelection({ ...all, chosenId: null, myRoomId: null, pendingRoomIds: [], suggestedIds: [] })).toBe("5");
  });

  it("has nothing to select on a course without rooms", () => {
    expect(defaultRoomSelection({ chosenId: null, myRoomId: null, pendingRoomIds: [], suggestedIds: [], firstRoomId: null })).toBeNull();
  });
});

describe("roomPanelFor", () => {
  const base: RoomPanelInput = { phase: "Published", stale: false, room: room("a", { memberCount: 2, freeSeats: 4 }), myRoomId: null, myMajorId: "mkt", pending: false, removed: false, suggested: false };

  it("joins an open room and applies to a locked one", () => {
    expect(roomPanelFor(base)).toEqual({ kind: "open", action: "join", disabled: false });
    expect(roomPanelFor({ ...base, room: { ...base.room, status: "Locked" } })).toEqual({ kind: "locked", action: "apply", disabled: false });
  });

  it("marks a suggested room and an empty room", () => {
    expect(roomPanelFor({ ...base, suggested: true }).kind).toBe("suggested");
    expect(roomPanelFor({ ...base, room: room("a") }).kind).toBe("empty");
  });

  it("offers entering my own room in every phase", () => {
    const mine = { ...base, myRoomId: "a" };
    expect(roomPanelFor(mine)).toEqual({ kind: "mine", action: "enter", disabled: false });
    expect(roomPanelFor({ ...mine, phase: "Expired" })).toEqual({ kind: "mineExpired", action: "enter", disabled: false });
  });

  it("shows a disabled join before the course opens", () => {
    expect(roomPanelFor({ ...base, phase: "Setup" })).toEqual({ kind: "setup", action: "join", disabled: true });
  });

  it("offers nothing after the deadline", () => {
    expect(roomPanelFor({ ...base, phase: "Expired" })).toEqual({ kind: "expired", action: "none", disabled: false });
    expect(roomPanelFor({ ...base, phase: "Expired", myRoomId: "b" })).toEqual({ kind: "expiredHasRoom", action: "none", disabled: false });
  });

  it("offers nothing when I already sit in another room", () => {
    expect(roomPanelFor({ ...base, myRoomId: "b" })).toEqual({ kind: "hasRoom", action: "none", disabled: false });
  });

  it("explains each refusal and offers no way in", () => {
    expect(roomPanelFor({ ...base, removed: true })).toEqual({ kind: "removed", action: "none", disabled: false });
    expect(roomPanelFor({ ...base, room: room("a", { freeSeats: 0, memberCount: 6 }) })).toEqual({ kind: "full", action: "none", disabled: false });
    expect(roomPanelFor({ ...base, room: room("a", { freeSeats: 0, memberCount: 6, status: "Locked" }) })).toEqual({ kind: "lockedFull", action: "none", disabled: false });
    expect(roomPanelFor({ ...base, room: room("a", { freeSeats: 1, memberCount: 5, missingMajorSeats: 1, majors: [major("se", 5, 1), major("gd", 0, 1)] }), myMajorId: "se" })).toEqual({ kind: "noFit", action: "none", disabled: false });
  });

  it("lets me withdraw a pending request", () => {
    expect(roomPanelFor({ ...base, pending: true, room: { ...base.room, status: "Locked" } })).toEqual({ kind: "pending", action: "withdraw", disabled: false });
  });

  it("keeps the buttons but disables them once the phase went stale", () => {
    expect(roomPanelFor({ ...base, stale: true })).toEqual({ kind: "stale", action: "join", disabled: true });
    expect(roomPanelFor({ ...base, stale: true, room: { ...base.room, status: "Locked" } })).toEqual({ kind: "stale", action: "apply", disabled: true });
    expect(roomPanelFor({ ...base, stale: true, pending: true })).toEqual({ kind: "stale", action: "withdraw", disabled: true });
    expect(roomPanelFor({ ...base, stale: true, removed: true })).toEqual({ kind: "stale", action: "none", disabled: true });
  });
});

describe("roomChecks", () => {
  const detail = (overrides: Partial<RoomDetail>): Pick<RoomDetail, "memberCount" | "minGroupSize" | "minDistinctMajors" | "majors"> => ({
    memberCount: 4,
    minGroupSize: 4,
    minDistinctMajors: 2,
    majors: [major("se", 3, 1), major("gd", 1, 0)],
    ...overrides,
  });

  it("lists required majors, variety and size as met", () => {
    expect(roomChecks(detail({}))).toEqual([
      { label: "Có SE", ok: true },
      { label: "Từ 2 ngành", ok: true },
      { label: "Từ 4 người", ok: true },
    ]);
  });

  it("flags what is still missing", () => {
    expect(roomChecks(detail({ memberCount: 1, majors: [major("se", 1, 1), major("mkt", 0, 1)] }))).toEqual([
      { label: "Có SE", ok: true },
      { label: "Có MKT", ok: false },
      { label: "Từ 2 ngành", ok: false },
      { label: "Từ 4 người", ok: false },
    ]);
  });

  it("shows the count when a major needs more than one person", () => {
    expect(roomChecks(detail({ majors: [major("se", 1, 2)] }))[0]).toEqual({ label: "Có 2 SE", ok: false });
  });
});
