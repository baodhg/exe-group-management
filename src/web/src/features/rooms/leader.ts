import { requestStatusLabels, roomRequestReasonText } from "../common/messages";
import type { CoursePhase, JoinRequest, MajorCount, RoomDetail } from "../common/types";

export const topicLimit = 200;
export const rejectionLimit = 500;
export const removalLimit = 300;

export function leadsRoom(room: Pick<RoomDetail, "leaderId">, userId: string | undefined, phase: CoursePhase | undefined): boolean {
  return userId !== undefined && room.leaderId === userId && phase === "Published";
}

export function leaderKeepsRecords(room: Pick<RoomDetail, "leaderId">, userId: string | undefined, phase: CoursePhase | undefined): boolean {
  return userId !== undefined && room.leaderId === userId && (phase === "Published" || phase === "Expired");
}

export function decisionNote(request: Pick<JoinRequest, "studentName" | "studentCode" | "status" | "reasonCode">): string {
  const who = request.studentName ?? request.studentCode ?? "Người xin";
  const reason = roomRequestReasonText(request.reasonCode);
  return `${who}: ${requestStatusLabels[request.status]}${reason ? ` – ${reason}` : ""}`;
}

export function approvalFillsRoom(result: Pick<JoinRequest, "status">, room: Pick<RoomDetail, "freeSeats">, pendingCount: number): boolean {
  return result.status === "Approved" && room.freeSeats === 1 && pendingCount > 1;
}

export function seatsStillNeeded(majors: readonly MajorCount[], minDistinctMajors: number): number {
  const missingPerMajor = majors.reduce((sum, major) => sum + Math.max(major.required - major.members, 0), 0);
  const present = majors.filter((major) => major.members > 0).length;
  const addedByRules = majors.filter((major) => major.required > 0 && major.members === 0).length;
  return missingPerMajor + Math.max(minDistinctMajors - present - addedByRules, 0);
}

function withApplicant(majors: readonly MajorCount[], majorCode: string): MajorCount[] {
  if (majors.some((major) => major.majorCode === majorCode)) {
    return majors.map((major) => (major.majorCode === majorCode ? { ...major, members: major.members + 1 } : major));
  }

  return [...majors, { majorId: majorCode, majorCode, members: 1, required: 0 }];
}

export interface ApplicationHint {
  kind: "fills" | "tight";
  text: string;
}

export function applicationHint(
  request: Pick<JoinRequest, "majorCode">,
  room: Pick<RoomDetail, "capacity" | "memberCount" | "freeSeats" | "minDistinctMajors" | "majors">,
): ApplicationHint | null {
  if (room.freeSeats <= 0) {
    return { kind: "tight", text: "Phòng đã đủ người" };
  }

  if (!request.majorCode) {
    return null;
  }

  const missing = room.majors.filter((major) => major.members < major.required);
  if (missing.some((major) => major.majorCode === request.majorCode)) {
    return { kind: "fills", text: `Đúng ngành ${request.majorCode} đang thiếu` };
  }

  const seatsLeft = room.capacity - room.memberCount - 1;
  if (seatsStillNeeded(withApplicant(room.majors, request.majorCode), room.minDistinctMajors) <= seatsLeft) {
    return null;
  }

  const held = missing.map((major) => major.majorCode).join(", ");
  return { kind: "tight", text: `Chỗ còn lại đang giữ cho ${held || "ngành khác"}` };
}
