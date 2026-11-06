import type { Placement, RoomSummary } from "../common/types";
import { roomConditions } from "../courses/overview";

export interface PlacementMove {
  studentId: string;
  roomId: string;
}

export interface FinalizeResult {
  groups: number;
  deletedRooms: number;
}

export interface FinalizeFacts {
  unplaced: number;
  exceptions: number;
  accepted: boolean;
}

export function freeSeatsOf(rooms: readonly Pick<RoomSummary, "id" | "freeSeats">[]): Map<string, number> {
  return new Map(rooms.map((room) => [room.id, room.freeSeats]));
}

export function chosenPlacements(placements: readonly Placement[], free: ReadonlyMap<string, number>, skipped: ReadonlySet<string>): Placement[] {
  const used = new Map<string, number>();
  return placements.filter((placement) => {
    if (skipped.has(placement.student.studentId)) {
      return false;
    }

    const taken = used.get(placement.roomId) ?? 0;
    if (taken >= (free.get(placement.roomId) ?? 0)) {
      return false;
    }

    used.set(placement.roomId, taken + 1);
    return true;
  });
}

export function fullRoomText(moves: readonly PlacementMove[], rooms: readonly Pick<RoomSummary, "id" | "name" | "freeSeats">[]): string | null {
  for (const room of rooms) {
    const wanted = moves.filter((move) => move.roomId === room.id).length;
    if (wanted > room.freeSeats) {
      return `${room.name} còn ${room.freeSeats} chỗ cho ${wanted} sinh viên. Không sinh viên nào được xếp.`;
    }
  }

  return null;
}

export function moveAfterText(room: Pick<RoomSummary, "memberCount" | "leaderId">, studentId: string): string {
  if (room.memberCount <= 1) {
    return "Trở thành phòng trống";
  }

  const left = `Còn ${room.memberCount - 1} người`;
  return room.leaderId === studentId ? `${left}, đổi trưởng nhóm` : left;
}

export function canFinalize({ unplaced, exceptions, accepted }: FinalizeFacts): boolean {
  return unplaced === 0 && (exceptions === 0 || accepted);
}

export function placementHeadline(facts: FinalizeFacts): string {
  if (canFinalize(facts)) {
    return "Sẵn sàng chốt";
  }

  return facts.unplaced > 0 ? `Còn ${facts.unplaced} bạn cần xếp` : `Còn ${facts.exceptions} phòng chưa đủ điều kiện`;
}

export function placementSubline(facts: FinalizeFacts): string {
  if (facts.unplaced > 0) {
    return "Đã hết hạn chọn phòng. Chỉ giáo vụ mới xếp hoặc chuyển được người từ lúc này.";
  }

  if (!canFinalize(facts)) {
    return "Cả lớp đã có phòng. Chấp nhận ngoại lệ để chốt các phòng còn thiếu.";
  }

  return facts.exceptions > 0 ? `Cả lớp đã có phòng, ${facts.exceptions} phòng được chấp nhận ngoại lệ.` : "Cả lớp đã có phòng và mọi phòng đều đủ điều kiện.";
}

export interface RoomFinalState {
  kind: "empty" | "ok" | "short";
  label: string;
}

export function roomFinalState(room: Pick<RoomSummary, "memberCount" | "majors" | "missingMajorSeats">, minGroupSize: number): RoomFinalState {
  const [first] = roomConditions(room, minGroupSize);
  if (first?.kind === "empty") {
    return { kind: "empty", label: "Sẽ xoá" };
  }

  if (first?.kind === "eligible") {
    return { kind: "ok", label: "Đủ điều kiện" };
  }

  return { kind: "short", label: first?.text ?? "" };
}

export function seatShortageText(students: number, rooms: readonly Pick<RoomSummary, "capacity">[]): string {
  const seats = rooms.reduce((sum, room) => sum + room.capacity, 0);
  return `${students} sinh viên nhưng ${rooms.length} phòng chỉ có ${seats} chỗ. Sau khi mở lớp không tạo thêm phòng được.`;
}
