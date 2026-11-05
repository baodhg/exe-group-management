import { requestReasonText, requestStatusLabels } from "../common/messages";
import type { CoursePhase, JoinRequest, RoomDetail } from "../common/types";

export function leadsRoom(room: Pick<RoomDetail, "leaderId">, userId: string | undefined, phase: CoursePhase | undefined): boolean {
  return userId !== undefined && room.leaderId === userId && phase === "Published";
}

export function decisionNote(request: Pick<JoinRequest, "studentName" | "studentCode" | "status" | "reasonCode">): string {
  const who = request.studentName ?? request.studentCode ?? "Người xin";
  const reason = requestReasonText(request.reasonCode);
  return `${who}: ${requestStatusLabels[request.status]}${reason ? ` – ${reason}` : ""}`;
}
