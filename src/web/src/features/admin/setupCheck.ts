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

export interface SetupCheck {
  rooms: number;
  minGroups: number;
  verdict: string;
  checks: SetupCheckItem[];
}

function oneDecimal(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

export function setupCheck({ students, maxGroupSize, minGroupSize, roomFactor, majorCounts, rule }: SetupFacts): SetupCheck {
  const safeMax = Math.max(maxGroupSize, 1);
  const rooms = expectedRooms(students, safeMax, roomFactor);
  const seats = rooms * safeMax;
  const average = rooms > 0 ? students / rooms : 0;
  const minGroups = Math.ceil(students / safeMax);
  const requiredOk = rule !== null && rule.majors.every((major) => (majorCounts[major.majorCode] ?? 0) >= minGroups * major.minMembers);
  const averageOk = average >= minGroupSize;

  const verdict = rule === null ? "Chọn loại nhóm để kiểm tra ngành" : !requiredOk ? "Thiếu ngành bắt buộc cho số nhóm tối thiểu" : averageOk ? "Lớp ghép được" : "Dư nhiều phòng, dễ có phòng lẻ người";

  return {
    rooms,
    minGroups,
    verdict,
    checks: [
      { label: `Đủ chỗ cho ${students} sinh viên`, ok: students > 0 && seats >= students, value: `${seats} chỗ` },
      { label: `Mỗi ngành bắt buộc đủ cho ${minGroups} nhóm`, ok: requiredOk, value: rule === null ? "Chưa chọn" : requiredOk ? "Đủ" : "Thiếu" },
      { label: `Trung bình mỗi phòng từ ${minGroupSize} người`, ok: averageOk, value: `${oneDecimal(average)} người` },
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
