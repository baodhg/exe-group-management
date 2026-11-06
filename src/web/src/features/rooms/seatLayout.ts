import type { MajorCount } from "../common/types";

export type Seat = { kind: "member"; code: string | null } | { kind: "reserved"; code: string | null } | { kind: "free" };

export function seatsFor(capacity: number, memberCount: number, majors: readonly MajorCount[] = [], missingMajorSeats = 0): Seat[] {
  const seats: Seat[] = [];
  for (const major of majors) {
    for (let index = 0; index < major.members; index++) {
      seats.push({ kind: "member", code: major.majorCode });
    }
  }

  while (seats.length < memberCount) {
    seats.push({ kind: "member", code: null });
  }

  const members = seats.slice(0, Math.max(memberCount, 0));
  const open = Math.max(capacity - members.length, 0);
  const reservedCount = Math.min(Math.max(missingMajorSeats, 0), open);
  const named = majors.flatMap((major) => Array.from({ length: Math.max(major.required - major.members, 0) }, () => major.majorCode));
  const reserved = Array.from({ length: reservedCount }, (_, index): Seat => ({ kind: "reserved", code: named[index] ?? null }));
  return [...members, ...reserved, ...Array.from({ length: open - reservedCount }, (): Seat => ({ kind: "free" }))];
}

export function missingMajors(majors: readonly MajorCount[] = []): MajorCount[] {
  return majors.filter((major) => major.members < major.required);
}
