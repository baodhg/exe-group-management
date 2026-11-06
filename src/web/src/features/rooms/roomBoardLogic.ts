import type { Pagination } from "../../shared/api/types";
import type { CoursePhase, RoomDetail, RoomSuggestions, RoomSummary } from "../common/types";
import { missingMajors } from "./seatLayout";

export const boardPageSize = 24;
export const boardFetchLimit = 100;

const nameOrder = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

type MajorView = Pick<RoomSummary, "majors">;
type SeatView = Pick<RoomSummary, "freeSeats" | "majors" | "missingMajorSeats">;

export function lacksMajor(room: MajorView, majorId: string): boolean {
  const entry = room.majors?.find((major) => major.majorId === majorId);
  return (entry?.members ?? 0) < Math.max(entry?.required ?? 0, 1);
}

export function filterLackingMajor<T extends MajorView>(rooms: readonly T[], majorId: string): T[] {
  return rooms.filter((room) => lacksMajor(room, majorId));
}

export function rankedRoomIds(suggestions: RoomSuggestions | undefined): string[] {
  return suggestions?.ranked ? suggestions.rooms.map((item) => item.room.id) : [];
}

export function sortByFit<T extends Pick<RoomSummary, "id" | "name">>(rooms: readonly T[], rankedIds: readonly string[]): T[] {
  const rank = new Map(rankedIds.map((id, index) => [id, index]));
  const rankOf = (room: T) => rank.get(room.id) ?? rankedIds.length;
  return [...rooms].sort((first, second) => rankOf(first) - rankOf(second) || nameOrder.compare(first.name, second.name));
}

export function pageRooms<T>(rooms: readonly T[], page: number, pageSize: number = boardPageSize): { items: T[]; pagination: Pagination } {
  const totalItems = rooms.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const current = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
  const start = (current - 1) * pageSize;
  return { items: rooms.slice(start, start + pageSize), pagination: { page: current, pageSize, totalItems, totalPages } };
}

export function fitsMajor(room: SeatView, majorId: string): boolean {
  if (room.freeSeats <= 0) {
    return false;
  }

  if (room.majors === undefined || room.missingMajorSeats === undefined) {
    return true;
  }

  const reserved = room.missingMajorSeats;
  const shortByRules = room.majors.reduce((sum, major) => sum + Math.max(major.required - major.members, 0), 0);
  const entry = room.majors.find((major) => major.majorId === majorId);
  const fillsRule = entry !== undefined && entry.members < entry.required;
  const addsVariety = reserved > shortByRules && (entry?.members ?? 0) === 0;
  const reservedAfter = fillsRule || addsVariety ? reserved - 1 : reserved;
  return reservedAfter <= room.freeSeats - 1;
}

export interface RoomHint {
  tone: "bad" | "muted" | "ink";
  text: string;
}

export interface RoomHintOptions {
  choosing?: boolean;
  majorId?: string | null;
  majorCode?: string | null;
  removed?: boolean;
}

export function roomHint(room: Pick<RoomSummary, "status" | "freeSeats" | "majors" | "missingMajorSeats">, options: RoomHintOptions = {}): RoomHint | null {
  const { choosing = false, majorId, majorCode, removed = false } = options;
  if (room.status === "Finalized") {
    return null;
  }

  if (choosing && removed) {
    return { tone: "bad", text: "Bạn đã bị xoá khỏi phòng này" };
  }

  if (room.freeSeats === 0) {
    return { tone: choosing ? "bad" : "muted", text: room.status === "Locked" ? "Phòng đang khoá và đã đủ người" : "Phòng đã đủ người" };
  }

  if (choosing && majorId && !fitsMajor(room, majorId)) {
    return { tone: "bad", text: majorCode ? `Không còn chỗ cho ngành ${majorCode}` : "Không còn chỗ cho ngành của bạn" };
  }

  const reserved = room.missingMajorSeats ?? 0;
  const missing = missingMajors(room.majors);
  if (missing.length > 0) {
    const codes = missing.map((major) => major.majorCode).join(", ");
    return { tone: "ink", text: reserved > 0 ? `Còn thiếu ngành ${codes}, ${reserved} chỗ được giữ cho các ngành này` : `Còn thiếu ngành ${codes}` };
  }

  return reserved > 0 ? { tone: "ink", text: `${reserved} chỗ được giữ cho ngành khác` } : null;
}

export function finalExceptionText(room: Pick<RoomSummary, "memberCount" | "majors" | "missingMajorSeats">, minGroupSize: number): string | null {
  const suffix = "giáo vụ chấp nhận ngoại lệ khi chốt";
  const missing = missingMajors(room.majors);
  if (missing.length > 0) {
    return `Thiếu ngành ${missing.map((major) => major.majorCode).join(", ")}, ${suffix}`;
  }

  if ((room.missingMajorSeats ?? 0) > 0) {
    return `Thiếu ngành, ${suffix}`;
  }

  return room.memberCount < minGroupSize ? `Chưa đủ ${minGroupSize} người, ${suffix}` : null;
}

export function defaultRoomSelection({
  chosenId,
  myRoomId,
  pendingRoomIds,
  suggestedIds,
  firstRoomId,
}: {
  chosenId: string | null;
  myRoomId: string | null;
  pendingRoomIds: readonly string[];
  suggestedIds: readonly string[];
  firstRoomId: string | null;
}): string | null {
  return chosenId ?? myRoomId ?? pendingRoomIds[0] ?? suggestedIds[0] ?? firstRoomId;
}

export type RoomPanelKind =
  | "mine"
  | "mineExpired"
  | "setup"
  | "expired"
  | "expiredHasRoom"
  | "hasRoom"
  | "stale"
  | "removed"
  | "pending"
  | "full"
  | "lockedFull"
  | "noFit"
  | "suggested"
  | "empty"
  | "open"
  | "locked";

export type RoomPanelAction = "join" | "apply" | "withdraw" | "enter" | "none";

export interface RoomPanel {
  kind: RoomPanelKind;
  action: RoomPanelAction;
  disabled: boolean;
}

export interface RoomPanelInput {
  phase: CoursePhase;
  stale: boolean;
  room: Pick<RoomSummary, "id" | "status" | "memberCount" | "freeSeats" | "majors" | "missingMajorSeats">;
  myRoomId: string | null;
  myMajorId: string | null;
  pending: boolean;
  removed: boolean;
  suggested: boolean;
}

export function roomPanelFor({ phase, stale, room, myRoomId, myMajorId, pending, removed, suggested }: RoomPanelInput): RoomPanel {
  const passive = (kind: RoomPanelKind, action: RoomPanelAction = "none", disabled = false): RoomPanel => ({ kind, action, disabled });
  const entry: RoomPanelAction = room.status === "Locked" ? "apply" : "join";
  const fits = myMajorId === null || fitsMajor(room, myMajorId);

  if (room.id === myRoomId) {
    return passive(phase === "Expired" ? "mineExpired" : "mine", "enter");
  }

  if (phase === "Setup") {
    return passive("setup", "join", true);
  }

  if (phase !== "Published") {
    return passive(myRoomId ? "expiredHasRoom" : "expired");
  }

  if (myRoomId) {
    return passive("hasRoom");
  }

  if (stale) {
    if (pending) {
      return passive("stale", "withdraw", true);
    }

    return passive("stale", removed || !fits ? "none" : entry, true);
  }

  if (removed) {
    return passive("removed");
  }

  if (pending) {
    return passive("pending", "withdraw");
  }

  if (room.freeSeats <= 0) {
    return passive(room.status === "Locked" ? "lockedFull" : "full");
  }

  if (!fits) {
    return passive("noFit");
  }

  if (suggested) {
    return passive("suggested", entry);
  }

  if (room.memberCount === 0 && entry === "join") {
    return passive("empty", "join");
  }

  return passive(entry === "apply" ? "locked" : "open", entry);
}

export interface RoomCheck {
  label: string;
  ok: boolean;
}

export function roomChecks(room: Pick<RoomDetail, "memberCount" | "minGroupSize" | "minDistinctMajors" | "majors">): RoomCheck[] {
  const required = room.majors
    .filter((major) => major.required > 0)
    .map((major) => ({ label: major.required > 1 ? `Có ${major.required} ${major.majorCode}` : `Có ${major.majorCode}`, ok: major.members >= major.required }));
  const distinct = room.majors.filter((major) => major.members > 0).length;
  return [
    ...required,
    ...(room.minDistinctMajors > 1 ? [{ label: `Từ ${room.minDistinctMajors} ngành`, ok: distinct >= room.minDistinctMajors }] : []),
    { label: `Từ ${room.minGroupSize} người`, ok: room.memberCount >= room.minGroupSize },
  ];
}
