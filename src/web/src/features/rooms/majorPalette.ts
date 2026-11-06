import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "../../shared/auth/useAuth";
import type { CatalogItem, MajorCount } from "../common/types";

export const majorSlots = 8;
const unassigned = "var(--muted-foreground)";

export function majorColor(order: readonly string[], majorId: string): string {
  const index = order.indexOf(majorId);
  return index >= 0 && index < majorSlots ? `var(--major-${index + 1})` : unassigned;
}

export function useMajorColor(): (majorId: string) => string {
  const { api } = useAuth();
  const majors = useQuery({
    queryKey: ["majors", "palette"],
    queryFn: () => api.get<CatalogItem[]>("/api/v1/majors", { pageSize: 100, sort: "code" }),
    staleTime: 5 * 60_000,
    select: (result) => result.data.map((major) => major.id),
  });
  const order = majors.data;

  return useCallback((majorId: string) => (order ? majorColor(order, majorId) : unassigned), [order]);
}

export type Seat = { kind: "member"; majorId: string | null } | { kind: "reserved" } | { kind: "free" };

export function seatsFor(capacity: number, memberCount: number, majors: readonly MajorCount[] = [], missingMajorSeats = 0): Seat[] {
  const seats: Seat[] = [];
  for (const major of majors) {
    for (let index = 0; index < major.members; index++) {
      seats.push({ kind: "member", majorId: major.majorId });
    }
  }

  while (seats.length < memberCount) {
    seats.push({ kind: "member", majorId: null });
  }

  const members = seats.slice(0, Math.max(memberCount, 0));
  const open = Math.max(capacity - members.length, 0);
  const reserved = Math.min(Math.max(missingMajorSeats, 0), open);
  return [...members, ...Array.from({ length: reserved }, (): Seat => ({ kind: "reserved" })), ...Array.from({ length: open - reserved }, (): Seat => ({ kind: "free" }))];
}

export function missingMajors(majors: readonly MajorCount[] = []): MajorCount[] {
  return majors.filter((major) => major.members < major.required);
}
