import { ApiError } from "../../shared/api/apiClient";
import type { CoursePhase, RoomDetail, RoomSummary } from "../common/types";
import { countdownText } from "../courses/deadline";

export type StudentRoomAction = "join" | "apply" | "leave" | "none";

export const applicationLimit = 500;

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

export function visitorNote({ phase, room, myRoomId }: StudentRoomState): string | null {
  if (phase !== "Published" || myRoomId === room.id) {
    return null;
  }

  if (myRoomId !== null) {
    return "Bạn đã có phòng trong lớp này. Muốn vào phòng này, hãy rời phòng hiện tại trước.";
  }

  return room.freeSeats === 0 ? "Phòng đã đủ người." : null;
}

export type RoomViewer = "leader" | "member" | "visitor" | "staff";

export function viewerOf(room: Pick<RoomDetail, "leaderId" | "members">, userId: string | undefined, isStudent: boolean): RoomViewer {
  if (!isStudent) {
    return "staff";
  }

  if (userId !== undefined && room.leaderId === userId) {
    return "leader";
  }

  return room.members.some((member) => member.studentId === userId) ? "member" : "visitor";
}

export interface RoomCapabilities {
  chat: boolean;
  leave: boolean;
  readOnly: boolean;
  deadlineCard: boolean;
  afterDeadline: boolean;
  suggestions: boolean;
  joinDetails: boolean;
}

export function capabilitiesOf(viewer: RoomViewer, phase: CoursePhase): RoomCapabilities {
  const inRoom = viewer === "leader" || viewer === "member";
  return {
    chat: inRoom,
    leave: inRoom && phase === "Published",
    readOnly: viewer === "staff",
    deadlineCard: inRoom && (phase === "Published" || phase === "Expired"),
    afterDeadline: viewer === "member" && phase === "Expired",
    suggestions: viewer === "member" && phase === "Published",
    joinDetails: inRoom && phase === "Finalized",
  };
}

export type LeaveOutcome = { kind: "plain" } | { kind: "succession"; successor: string } | { kind: "reopens"; pending: number };

export function leaveOutcome(room: Pick<RoomDetail, "leaderId" | "members" | "status">, userId: string | undefined, pendingCount: number): LeaveOutcome {
  const others = room.members.filter((member) => member.studentId !== userId);
  if (others.length === 0) {
    return room.status === "Locked" ? { kind: "reopens", pending: pendingCount } : { kind: "plain" };
  }

  if (room.leaderId !== userId) {
    return { kind: "plain" };
  }

  const earliest = others.reduce((first, member) => (new Date(member.joinedAt) < new Date(first.joinedAt) ? member : first));
  return { kind: "succession", successor: earliest.fullName };
}

export function leftRoomText(result: Pick<RoomDetail, "leaderName">, outcome: LeaveOutcome): string {
  switch (outcome.kind) {
    case "succession":
      return `${result.leaderName || outcome.successor} là trưởng nhóm mới của phòng.`;
    case "reopens":
      return outcome.pending > 0 ? "Phòng không còn ai nên đã tự mở lại, các đơn đang chờ đã bị huỷ." : "Phòng không còn ai nên đã tự mở lại.";
    default:
      return "Bạn có thể vào phòng khác nếu còn chỗ.";
  }
}

export interface RoomCheck {
  ok: boolean;
  label: string;
  value: string;
}

function distinctMajors(room: Pick<RoomDetail, "majors">): number {
  return room.majors.filter((major) => major.members > 0).length;
}

export function roomChecks(room: Pick<RoomDetail, "memberCount" | "minGroupSize" | "minDistinctMajors" | "majors">): RoomCheck[] {
  const distinct = distinctMajors(room);
  return [
    { ok: room.memberCount >= room.minGroupSize, label: `Ít nhất ${room.minGroupSize} người`, value: `Đang có ${room.memberCount}` },
    { ok: distinct >= room.minDistinctMajors, label: `Ít nhất ${room.minDistinctMajors} ngành khác nhau`, value: `Đang có ${distinct}` },
    ...room.majors
      .filter((major) => major.required > 0)
      .map((major) => ({ ok: major.members >= major.required, label: `Ngành ${major.majorCode}: ít nhất ${major.required} người`, value: `Đang có ${major.members}` })),
  ];
}

export function unmetConditions(room: Pick<RoomDetail, "memberCount" | "minGroupSize" | "minDistinctMajors" | "majors">): string[] {
  return [
    ...(room.memberCount < room.minGroupSize ? [`Đủ ${room.minGroupSize} người`] : []),
    ...(distinctMajors(room) < room.minDistinctMajors ? [`Đủ ${room.minDistinctMajors} ngành khác nhau`] : []),
    ...room.majors.filter((major) => major.members < major.required).map((major) => `Ngành ${major.majorCode}`),
  ];
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function dayMonth(value: string): string {
  const date = new Date(value);
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}`;
}

export function dayTime(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return `${dayMonth(value)}, ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

export function deadlineCard(viewer: RoomViewer, phase: CoursePhase, expireAt: string | null, now: number = Date.now()): { label: string; value: string; note: string } {
  if (phase === "Expired") {
    return { label: "Đã hết hạn chọn phòng", value: dayTime(expireAt), note: "Giáo vụ xếp người còn lại rồi chốt nhóm" };
  }

  return {
    label: viewer === "leader" ? "Hạn chọn phòng" : "Còn được đổi phòng trong",
    value: countdownText(expireAt, now) ?? dayTime(expireAt),
    note: `Hạn ${dayTime(expireAt)}`,
  };
}

export function isBlockedRoom(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

export const roomSorts = [
  { value: "name", label: "Tên phòng" },
  { value: "-memberCount", label: "Đông người trước" },
  { value: "memberCount", label: "Ít người trước" },
  { value: "status", label: "Trạng thái" },
] as const;
