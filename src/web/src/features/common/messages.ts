import { ApiError } from "../../shared/api/apiClient";
import type { CoursePhase, JoinRequest, RoomSummary } from "./types";

const errorTexts: Record<string, string> = {
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ.",
  UNAUTHORIZED: "Phiên đăng nhập đã hết, hãy đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền làm thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu.",
  CONFLICT: "Dữ liệu vừa thay đổi, hãy tải lại rồi thử lại.",
  CONCURRENCY_CONFLICT: "Dữ liệu vừa thay đổi, hãy tải lại rồi thử lại.",
  TOO_MANY_REQUESTS: "Bạn thao tác quá nhanh, hãy thử lại sau ít phút.",
  UPSTREAM_UNAVAILABLE: "Máy chủ đang bận hoặc chưa sẵn sàng, hãy thử lại.",
  INTERNAL_ERROR: "Máy chủ gặp lỗi, hãy thử lại.",
  EMAIL_TAKEN: "Email đã được dùng cho tài khoản khác.",
  USER_CODE_TAKEN: "Mã người dùng đã tồn tại.",
  OWN_ACCESS_PROTECTED: "Không thể tự khóa hoặc bỏ quyền quản trị của chính mình.",
  SEMESTER_CODE_TAKEN: "Mã học kỳ đã tồn tại.",
  SEMESTER_IN_USE: "Học kỳ đang được dùng, không xóa được.",
  SUBJECT_CODE_TAKEN: "Mã môn đã tồn tại.",
  SUBJECT_IN_USE: "Môn đang được dùng, không xóa được.",
  MAJOR_CODE_TAKEN: "Mã ngành đã tồn tại.",
  MAJOR_IN_USE: "Ngành đang được dùng, không xóa được.",
  SKILL_CODE_TAKEN: "Mã skill đã tồn tại.",
  SKILL_IN_USE: "Skill đang được dùng, không xóa được.",
  GROUP_TYPE_CODE_TAKEN: "Mã loại nhóm đã tồn tại.",
  GROUP_TYPE_IN_USE: "Loại nhóm đang được dùng, không xóa được.",
  COURSE_CLASS_TAKEN: "Lớp này đã có môn đó trong học kỳ.",
  COURSE_NOT_IN_SETUP: "Course đã publish, không còn ở giai đoạn chuẩn bị.",
  COURSE_FINALIZED: "Course đã chốt nhóm, không thay đổi được nữa.",
  COURSE_SCHEDULE_LOCKED: "Khi course đang mở, hạn chỉ được dời về sau.",
  COURSE_NOT_PUBLISHED: "Course không ở giai đoạn tìm nhóm.",
  COURSE_NOT_EXPIRED: "Chỉ xếp người sau khi course hết hạn.",
  STUDENT_MAJOR_LOCKED: "Sinh viên đã ghi danh, không đổi ngành được.",
  STUDENT_ENROLLED: "Sinh viên đang ghi danh course, không xóa được.",
  STUDENT_NOT_IN_SEMESTER: "Sinh viên chưa có trong học kỳ.",
  STUDENT_IN_ROOM: "Sinh viên đã có phòng, không gỡ được.",
  SKILLS_LOCKED: "Skill đã khóa vì có course hết hạn.",
  NOT_ENROLLED: "Bạn không có trong danh sách lớp của course.",
  ALREADY_IN_ROOM: "Bạn đã có phòng trong course này.",
  ROOM_LOCKED: "Phòng đã khóa: hãy gửi đơn xin vào.",
  ROOM_NOT_LOCKED: "Phòng đang mở: vào thẳng, không cần đơn.",
  ROOM_FULL: "Phòng đã đủ người.",
  COMPOSITION_RULE: "Vào phòng sẽ không còn đủ chỗ cho các ngành phòng còn thiếu.",
  REMOVED_FROM_ROOM: "Trưởng phòng đã xóa bạn khỏi phòng này, không vào lại được.",
  NOT_ROOM_LEADER: "Chỉ trưởng phòng làm được việc này.",
  NOT_ROOM_MEMBER: "Người này không phải thành viên của phòng.",
  ROOM_NAME_TAKEN: "Course đã có phòng trùng tên.",
  APPLICATION_PENDING: "Bạn đã có đơn đang chờ vào phòng này.",
  REQUEST_NOT_PENDING: "Đơn đã được xử lý.",
  FINALIZE_BLOCKED: "Chưa chốt được: còn sinh viên chưa có phòng, hoặc còn phòng chưa đủ điều kiện mà chưa chấp nhận ngoại lệ.",
};

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "VALIDATION_FAILED" && error.errors.length > 0) {
      return error.errors.map((item) => item.message).join(" ");
    }

    return errorTexts[error.code] ?? error.message;
  }

  return "Không thực hiện được, hãy thử lại.";
}

export const phaseLabels: Record<CoursePhase, string> = {
  Setup: "Chuẩn bị",
  Published: "Đang tìm nhóm",
  Expired: "Hết hạn",
  Finalized: "Đã chốt nhóm",
};

export const roomStatusLabels: Record<RoomSummary["status"], string> = {
  Open: "Mở",
  Locked: "Khóa",
  Finalized: "Chính thức",
};

export const requestStatusLabels: Record<JoinRequest["status"], string> = {
  Pending: "Đang chờ",
  Approved: "Đã duyệt",
  Rejected: "Bị từ chối",
  Cancelled: "Đã hủy",
};

const requestReasons: Record<string, string> = {
  REJECTED_BY_LEADER: "Trưởng phòng từ chối",
  WITHDRAWN: "Bạn đã rút đơn",
  ROOM_FULL: "Phòng đã đủ người",
  ROOM_REOPENED: "Phòng mở lại, vào thẳng được",
  COMPOSITION_RULE: "Không còn đủ chỗ cho ngành phòng cần",
  JOINED_ANOTHER_ROOM: "Bạn đã vào phòng khác",
  GROUPING_EXPIRED: "Đã hết hạn tìm nhóm",
};

export function requestReasonText(code: string | null): string {
  return code ? (requestReasons[code] ?? code) : "";
}

export function suggestionReasonText(code: string, detail: string): string {
  switch (code) {
    case "MAJOR_NEEDED":
      return `Phòng còn cần ngành ${detail}`;
    case "SKILL_GAP":
      return `Bạn mạnh hơn phòng về ${detail}`;
    case "BELOW_MINIMUM":
      return `Phòng chưa đủ người tối thiểu (${detail})`;
    default:
      return detail ? `${code}: ${detail}` : code;
  }
}

export function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";
}
