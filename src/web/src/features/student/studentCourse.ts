import { ApiError } from "../../shared/api/apiClient";
import { requestReasonText } from "../common/messages";
import type { Course, CoursePhase, JoinRequest, RoomSummary } from "../common/types";

const phaseSteps: Record<CoursePhase, number> = { Setup: 0, Published: 1, Expired: 2, Finalized: 3 };

export function phaseStep(phase: CoursePhase): number {
  return phaseSteps[phase];
}

export function countdownText(target: string, now: number = Date.now()): string {
  const minutes = Math.ceil((new Date(target).getTime() - now) / 60_000);
  if (minutes <= 0) {
    return "Đã hết hạn";
  }

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  }

  if (hours > 0) {
    return rest > 0 ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
  }

  return `${rest} phút`;
}

export function isPhaseStale(phase: CoursePhase, { deadlineReached, refused }: { deadlineReached: boolean; refused: boolean }): boolean {
  return phase === "Published" && (deadlineReached || refused);
}

export function heroCopy(phase: CoursePhase, hasRoom: boolean): { title: string; text: string } {
  switch (phase) {
    case "Setup":
      return { title: "Lớp chưa mở tìm nhóm", text: "Khi lớp mở, bạn sẽ nhận thông báo và có thể chọn phòng." };
    case "Published":
      return hasRoom
        ? { title: "Bảng phòng", text: "Bạn đã có phòng trong lớp này. Các phòng khác chỉ để xem." }
        : { title: "Chọn phòng", text: "Bạn chưa có phòng. Chọn một phòng gợi ý hoặc tìm trên bảng phòng. Phòng mở thì vào thẳng, phòng khoá thì gửi đơn cho trưởng nhóm." };
    case "Expired":
      return {
        title: "Đã hết hạn tìm nhóm",
        text: hasRoom ? "Bạn đã có phòng. Không còn rời hoặc đổi phòng được nữa, trò chuyện của phòng vẫn mở." : "Bạn chưa có phòng. Giáo vụ sẽ xếp bạn vào một phòng còn chỗ trước khi chốt nhóm.",
      };
    case "Finalized":
      return {
        title: "Danh sách nhóm chính thức",
        text: hasRoom ? "Danh sách đã chốt và chỉ đọc với mọi người." : "Bạn không thuộc nhóm nào của lớp này. Danh sách đã chốt và chỉ đọc với mọi người.",
      };
  }
}

export function courseForSemester(courses: readonly Course[], semesterId: string): Course | undefined {
  const inSemester = courses.filter((course) => course.semesterId === semesterId);
  return inSemester.find((course) => course.phase === "Published") ?? inSemester.find((course) => course.phase === "Setup") ?? inSemester[0];
}

export function publishedCourse(courses: readonly Course[]): Course | undefined {
  return courses.find((course) => course.phase === "Published");
}

export function sumMembers(rooms: readonly Pick<RoomSummary, "memberCount">[]): number {
  return rooms.reduce((sum, room) => sum + room.memberCount, 0);
}

export function requestReason(request: Pick<JoinRequest, "status" | "reasonCode">): string {
  if (request.reasonCode) {
    return requestReasonText(request.reasonCode);
  }

  if (request.status === "Pending") {
    return "Chờ trưởng nhóm duyệt";
  }

  return request.status === "Approved" ? "Trưởng nhóm đã duyệt" : "";
}

export function deniedStatus(error: unknown): 403 | 404 | null {
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return error.status;
  }

  return null;
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
