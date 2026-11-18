import type { GroupType } from "../common/types";
import { expectedRooms } from "./courseDraft";

export interface SetupFacts {
  students: number;
  maxGroupSize: number;
  minGroupSize: number;
  roomFactor: number;
  majorCounts: Readonly<Record<string, number>>;
  rule: GroupType | null;
}

export interface SetupCheckItem {
  label: string;
  ok: boolean;
  value: string;
}

export interface MajorShortfall {
  majorCode: string;
  count: number;
  needed: number;
  starvedRooms: number;
}

export interface SetupCheck {
  rooms: number;
  minGroups: number;
  verdict: string;
  checks: SetupCheckItem[];
  shortfalls: MajorShortfall[];
}

function oneDecimal(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export function roomShortfall(majorCode: string, count: number, rooms: number, rule: GroupType | null): MajorShortfall | null {
  if (rule === null || rooms <= 0) {
    return null;
  }

  const need = rule.majors.find((major) => major.majorCode === majorCode);
  if (!need) {
    return null;
  }

  const needed = rooms * need.minMembers;
  const covered = Math.floor(count / need.minMembers);
  return { majorCode, count, needed, starvedRooms: Math.max(0, rooms - covered) };
}

export function setupCheck({ students, maxGroupSize, minGroupSize, roomFactor, majorCounts, rule }: SetupFacts): SetupCheck {
  const safeMax = Math.max(maxGroupSize, 1);
  const rooms = expectedRooms(students, safeMax, roomFactor);
  const seats = rooms * safeMax;
  const average = rooms > 0 ? students / rooms : 0;
  const minGroups = Math.ceil(students / safeMax);
  const requiredOk = rule !== null && rule.majors.every((major) => (majorCounts[major.majorCode] ?? 0) >= minGroups * major.minMembers);
  const averageOk = average >= minGroupSize;
  const shortfalls = rule === null
    ? []
    : rule.majors
        .map((major) => roomShortfall(major.majorCode, majorCounts[major.majorCode] ?? 0, rooms, rule))
        .filter((item): item is MajorShortfall => item !== null && item.starvedRooms > 0);
  const starvedRooms = shortfalls.reduce((highest, item) => Math.max(highest, item.starvedRooms), 0);
  const starvedCodes = [...new Set(shortfalls.map((item) => item.majorCode))].join(", ");

  const verdict = rule === null
    ? "Chọn loại nhóm để kiểm tra ngành"
    : !requiredOk
      ? "Thiếu ngành bắt buộc cho số nhóm tối thiểu"
      : !averageOk
        ? "Dư nhiều phòng, dễ có phòng lẻ người"
        : starvedRooms > 0
          ? `${starvedRooms} phòng sẽ không đủ ${starvedCodes}`
          : "Lớp ghép được";

  return {
    rooms,
    minGroups,
    verdict,
    shortfalls,
    checks: [
      { label: `Đủ chỗ cho ${students} sinh viên`, ok: students > 0 && seats >= students, value: `${seats} chỗ` },
      { label: `Mỗi ngành bắt buộc đủ cho ${minGroups} nhóm`, ok: requiredOk, value: rule === null ? "Chưa chọn" : requiredOk ? "Đủ" : "Thiếu" },
      { label: `Trung bình mỗi phòng từ ${minGroupSize} người`, ok: averageOk, value: `${oneDecimal(average)} người` },
      { label: "Mỗi phòng đều có đủ ngành bắt buộc", ok: starvedRooms === 0, value: starvedRooms === 0 ? "Đủ" : `${starvedRooms} phòng thiếu ${starvedCodes}` },
    ],
  };
}

export type MajorSupply = "enough" | "tight" | "short";

export interface MajorRequirement {
  required: boolean | null;
  supply: MajorSupply | null;
}

export function majorRequirement(majorCode: string, count: number, minGroups: number, rule: GroupType | null): MajorRequirement {
  if (rule === null) {
    return { required: null, supply: null };
  }

  const need = rule.majors.find((major) => major.majorCode === majorCode);
  if (!need) {
    return { required: false, supply: null };
  }

  const wanted = minGroups * need.minMembers;
  return { required: true, supply: count >= wanted * 2 ? "enough" : count >= wanted ? "tight" : "short" };
}
