import type { MajorCount, OverviewRoom, RoomSummary, StudentRef } from "../common/types";

export { countdownText, deadlineReached, shortDateTime } from "./deadline";

export function missingMembersText(room: Pick<OverviewRoom, "missingMembers">, minGroupSize: number): string {
  return room.missingMembers > 0 ? `${room.missingMembers} người (tối thiểu ${minGroupSize})` : "Đủ";
}

export function missingMajorsText(room: Pick<OverviewRoom, "missingMajorSeats" | "majors">): string {
  if (room.missingMajorSeats === 0) {
    return "Đủ";
  }

  const short = room.majors.filter((major) => major.members < major.required).map((major) => `${major.majorCode} ${major.members}/${major.required}`);
  return short.length > 0 ? short.join(", ") : `${room.missingMajorSeats} chỗ cho ngành khác`;
}

export interface MajorTally {
  code: string;
  count: number;
}

export function unplacedByMajor(unplaced: readonly Pick<StudentRef, "majorCode">[]): MajorTally[] {
  const counts = new Map<string, number>();
  for (const student of unplaced) {
    counts.set(student.majorCode, (counts.get(student.majorCode) ?? 0) + 1);
  }

  return [...counts].map(([code, count]) => ({ code, count })).sort((first, second) => second.count - first.count || first.code.localeCompare(second.code));
}

export interface Attention {
  majorCode: string;
  rooms: string[];
  people: number;
}

export function attentionFor(rooms: readonly Pick<RoomSummary, "name" | "majors">[], unplaced: readonly Pick<StudentRef, "majorCode">[]): Attention | null {
  const needing = new Map<string, string[]>();
  for (const room of rooms) {
    for (const major of room.majors ?? []) {
      if (major.members < major.required) {
        needing.set(major.majorCode, [...(needing.get(major.majorCode) ?? []), room.name]);
      }
    }
  }

  const people = new Map(unplacedByMajor(unplaced).map((major) => [major.code, major.count]));
  const items = [...needing].map(([majorCode, names]) => ({ majorCode, rooms: names, people: people.get(majorCode) ?? 0 }));
  items.sort((first, second) => second.rooms.length - second.people - (first.rooms.length - first.people) || second.rooms.length - first.rooms.length || first.majorCode.localeCompare(second.majorCode));
  return items[0] ?? null;
}

export function attentionTitle(attention: Attention): string {
  return `Còn ${attention.people} bạn ${attention.majorCode} cho ${attention.rooms.length} phòng cần ${attention.majorCode}`;
}

export type RoomConditionKind = "eligible" | "empty" | "members" | "majors" | "otherMajors";

export interface RoomCondition {
  kind: RoomConditionKind;
  text: string;
  tone: "good" | "neutral" | "warn";
}

type RoomFacts = Pick<RoomSummary, "memberCount" | "majors" | "missingMajorSeats">;

function shortMajors(majors: readonly MajorCount[] = []): MajorCount[] {
  return majors.filter((major) => major.members < major.required);
}

export function roomConditions(room: RoomFacts, minGroupSize: number): RoomCondition[] {
  if (room.memberCount === 0) {
    return [{ kind: "empty", text: "Phòng trống", tone: "neutral" }];
  }

  const conditions: RoomCondition[] = [];
  const members = minGroupSize - room.memberCount;
  if (members > 0) {
    conditions.push({ kind: "members", text: `Thiếu ${members} người`, tone: "warn" });
  }

  const short = shortMajors(room.majors);
  if (short.length > 0) {
    conditions.push({ kind: "majors", text: `Thiếu ${short.map((major) => major.majorCode).join(", ")}`, tone: "warn" });
  }

  const named = short.reduce((sum, major) => sum + major.required - major.members, 0);
  const other = (room.missingMajorSeats ?? 0) - named;
  if (other > 0) {
    conditions.push({ kind: "otherMajors", text: `${other} chỗ cho ngành khác`, tone: "warn" });
  }

  return conditions.length > 0 ? conditions : [{ kind: "eligible", text: "Đủ điều kiện", tone: "good" }];
}

export function roomIsEligible(room: RoomFacts, minGroupSize: number): boolean {
  return roomConditions(room, minGroupSize)[0]?.kind === "eligible";
}

export function changedRooms(before: readonly RoomSummary[], after: readonly RoomSummary[]): string[] {
  const known = new Map(before.map((room) => [room.id, room]));
  return after
    .filter((room) => {
      const previous = known.get(room.id);
      return previous !== undefined && (previous.memberCount !== room.memberCount || previous.status !== room.status || previous.leaderId !== room.leaderId);
    })
    .map((room) => room.name);
}

export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}
