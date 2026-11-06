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
  OWN_ACCESS_PROTECTED: "Không thể tự khoá hoặc bỏ quyền giáo vụ của chính mình.",
  SEMESTER_CODE_TAKEN: "Mã học kỳ đã tồn tại.",
  SEMESTER_IN_USE: "Học kỳ đang được dùng, không xoá được.",
  SUBJECT_CODE_TAKEN: "Mã môn đã tồn tại.",
  SUBJECT_IN_USE: "Môn đang được dùng, không xoá được.",
  MAJOR_CODE_TAKEN: "Mã ngành đã tồn tại.",
  MAJOR_IN_USE: "Ngành đang được dùng, không xoá được.",
  SKILL_CODE_TAKEN: "Mã kỹ năng đã tồn tại.",
  SKILL_IN_USE: "Kỹ năng đang được dùng, không xoá được.",
  GROUP_TYPE_CODE_TAKEN: "Mã loại nhóm đã tồn tại.",
  GROUP_TYPE_IN_USE: "Loại nhóm đang được dùng, không xoá được.",
  COURSE_CLASS_TAKEN: "Lớp này đã có môn đó trong học kỳ.",
  COURSE_NOT_IN_SETUP: "Lớp đã mở tìm nhóm, không còn ở giai đoạn chuẩn bị.",
  COURSE_FINALIZED: "Lớp đã chốt nhóm, không thay đổi được nữa.",
  COURSE_SCHEDULE_LOCKED: "Khi lớp đang mở, hạn chỉ được dời về sau.",
  COURSE_NOT_PUBLISHED: "Lớp không ở giai đoạn tìm nhóm.",
  COURSE_NOT_EXPIRED: "Chỉ xếp người sau khi lớp hết hạn.",
  STUDENT_MAJOR_LOCKED: "Sinh viên đã ghi danh, không đổi ngành được.",
  STUDENT_ENROLLED: "Sinh viên đang ghi danh lớp, không xoá được.",
  STUDENT_NOT_IN_SEMESTER: "Sinh viên chưa có trong học kỳ.",
  STUDENT_IN_ROOM: "Sinh viên đã có phòng, không gỡ được.",
  SKILLS_LOCKED: "Kỹ năng đã khoá vì có lớp hết hạn.",
  NOT_ENROLLED: "Bạn không có trong danh sách của lớp.",
  ALREADY_IN_ROOM: "Bạn đã có phòng trong lớp này.",
  ROOM_LOCKED: "Phòng đã khoá: hãy gửi đơn xin vào.",
  ROOM_NOT_LOCKED: "Phòng đang mở: vào thẳng, không cần đơn.",
  ROOM_FULL: "Phòng đã đủ người.",
  COMPOSITION_RULE: "Vào phòng sẽ không còn đủ chỗ cho các ngành phòng còn thiếu.",
  REMOVED_FROM_ROOM: "Trưởng nhóm đã xoá bạn khỏi phòng này, không vào lại được.",
  NOT_ROOM_LEADER: "Chỉ trưởng nhóm làm được việc này.",
  NOT_ROOM_MEMBER: "Người này không phải thành viên của phòng.",
  ROOM_NAME_TAKEN: "Lớp đã có phòng trùng tên.",
  APPLICATION_PENDING: "Bạn đã có đơn đang chờ vào phòng này.",
  REQUEST_NOT_PENDING: "Đơn đã được xử lý.",
  FINALIZE_BLOCKED: "Chưa chốt được: còn sinh viên chưa có phòng, hoặc còn phòng chưa đủ điều kiện mà chưa chấp nhận ngoại lệ.",
};

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const fieldMessages = error.errors.map((item) => item.message).filter(Boolean).join(" ");
    if (error.code === "VALIDATION_FAILED" && fieldMessages) {
      return fieldMessages;
    }

    return errorTexts[error.code] ?? error.message;
  }

  return "Không thực hiện được, hãy thử lại.";
}

export function traceIdOf(error: unknown): string | null {
  return error instanceof ApiError && error.status >= 500 ? error.traceId : null;
}

export const phaseLabels: Record<CoursePhase, string> = {
  Setup: "Chuẩn bị",
  Published: "Đang tìm nhóm",
  Expired: "Hết hạn",
  Finalized: "Đã chốt nhóm",
};

export const roomStatusLabels: Record<RoomSummary["status"], string> = {
  Open: "Mở",
  Locked: "Khoá",
  Finalized: "Chính thức",
};

export const requestStatusLabels: Record<JoinRequest["status"], string> = {
  Pending: "Đang chờ",
  Approved: "Đã duyệt",
  Rejected: "Bị từ chối",
  Cancelled: "Đã huỷ",
};

const requestReasons: Record<string, string> = {
  REJECTED_BY_LEADER: "Trưởng nhóm từ chối",
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
  return value ? new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

const relative = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" });

export function formatRelative(value: string | null, now: number = Date.now()): string {
  if (!value) {
    return "—";
  }

  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const distance = Math.abs(seconds);
  if (distance < 45) {
    return "vừa xong";
  }

  if (distance < 3600) {
    return relative.format(Math.round(seconds / 60), "minute");
  }

  if (distance < 86_400) {
    return relative.format(Math.round(seconds / 3600), "hour");
  }

  if (distance < 7 * 86_400) {
    return relative.format(Math.round(seconds / 86_400), "day");
  }

  return formatDateTime(value);
}

export function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

export function signInErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Email hoặc mật khẩu không đúng.";
    }

    if (error.status === 403) {
      return "Tài khoản đang bị khoá, hãy liên hệ giáo vụ.";
    }
  }

  return errorText(error);
}

export const phaseTones: Record<CoursePhase, "neutral" | "good" | "warn" | "info"> = {
  Setup: "neutral",
  Published: "good",
  Expired: "warn",
  Finalized: "info",
};

export interface DeadlineInfo {
  text: string;
  urgent: boolean;
  passed: boolean;
}

export function deadlineInfo(expireAt: string | null, now: number = Date.now()): DeadlineInfo | null {
  if (!expireAt) {
    return null;
  }

  const left = new Date(expireAt).getTime() - now;
  if (left <= 0) {
    return { text: "Đã hết hạn", urgent: false, passed: true };
  }

  const hours = Math.floor(left / 3_600_000);
  if (hours < 1) {
    return { text: `Còn ${Math.max(Math.ceil(left / 60_000), 1)} phút`, urgent: true, passed: false };
  }

  if (hours < 48) {
    return { text: `Còn ${hours} giờ`, urgent: true, passed: false };
  }

  return { text: `Còn ${Math.floor(hours / 24)} ngày`, urgent: hours < 72, passed: false };
}
