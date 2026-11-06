import { toast } from "sonner";
import { ApiError } from "../../shared/api/apiClient";
import { errorText } from "../common/messages";

const courseWording: Record<string, string> = {
  COURSE_NOT_IN_SETUP: "Lớp đã mở, không còn ở giai đoạn chuẩn bị.",
  COURSE_FINALIZED: "Lớp đã chốt nhóm, không thay đổi được nữa.",
  COURSE_SCHEDULE_LOCKED: "Khi lớp đang mở, hạn chỉ được dời về sau.",
  COURSE_NOT_PUBLISHED: "Lớp không ở giai đoạn tìm nhóm.",
  COURSE_NOT_EXPIRED: "Chỉ xếp người sau khi lớp hết hạn.",
  COURSE_CLASS_TAKEN: "Lớp này đã có môn đó trong học kỳ.",
  ROOM_NAME_TAKEN: "Lớp đã có phòng trùng tên.",
  STUDENT_IN_ROOM: "Sinh viên từng vào phòng của lớp này nên không gỡ được.",
  STUDENT_MAJOR_LOCKED: "Sinh viên đã vào phòng trong học kỳ này nên không đổi được ngành.",
};

export function courseErrorText(error: unknown): string {
  if (error instanceof ApiError && error.code in courseWording) {
    return courseWording[error.code]!;
  }

  return errorText(error);
}

export function errorTraceText(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  return error.traceId ? `Mã lỗi ${error.code}, mã tra cứu ${error.traceId}` : `Mã lỗi ${error.code}`;
}

export function failureToast(error: unknown, description?: string | null) {
  toast.error(courseErrorText(error), { description: description ?? errorTraceText(error) ?? undefined });
}
