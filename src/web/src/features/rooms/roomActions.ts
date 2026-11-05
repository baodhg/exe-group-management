import type { CoursePhase, RoomSummary } from "../common/types";

export type StudentRoomAction = "join" | "apply" | "leave" | "none";

export interface StudentRoomState {
  phase: CoursePhase;
  room: Pick<RoomSummary, "id" | "status" | "freeSeats">;
  myRoomId: string | null;
  hasPendingApplication: boolean;
}

export function studentActionFor({ phase, room, myRoomId, hasPendingApplication }: StudentRoomState): StudentRoomAction {
  if (phase !== "Published") {
    return "none";
  }

  if (myRoomId === room.id) {
    return "leave";
  }

  if (myRoomId !== null || room.freeSeats === 0) {
    return "none";
  }

  if (room.status === "Open") {
    return "join";
  }

  return room.status === "Locked" && !hasPendingApplication ? "apply" : "none";
}

export const roomSorts = [
  { value: "name", label: "Tên phòng" },
  { value: "-memberCount", label: "Đông người trước" },
  { value: "memberCount", label: "Ít người trước" },
  { value: "status", label: "Trạng thái" },
] as const;
