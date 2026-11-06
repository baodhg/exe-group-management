import { ApiError } from "../../shared/api/apiClient";
import type { Course, CoursePhase } from "../common/types";
import { courseErrorText } from "./courseErrors";

export interface CourseDraft {
  semesterId: string;
  subjectId: string;
  classCode: string;
  lecturerId: string;
  lecturerName: string;
  minGroupSize: number;
  maxGroupSize: number;
  roomFactor: number;
  publishAt: string;
  expireAt: string;
}

export type CourseFieldErrors = Partial<Record<keyof CourseDraft, string>>;

export const maxClassCodeLength = 30;

export const newCourse: CourseDraft = {
  semesterId: "",
  subjectId: "",
  classCode: "",
  lecturerId: "",
  lecturerName: "",
  minGroupSize: 4,
  maxGroupSize: 6,
  roomFactor: 1.2,
  publishAt: "",
  expireAt: "",
};

export function toLocalInput(iso: string | null): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function draftOf(course: Course): CourseDraft {
  return {
    semesterId: course.semesterId,
    subjectId: course.subjectId,
    classCode: course.classCode,
    lecturerId: course.lecturerId ?? "",
    lecturerName: course.lecturerName ?? "",
    minGroupSize: course.minGroupSize,
    maxGroupSize: course.maxGroupSize,
    roomFactor: course.roomFactor,
    publishAt: toLocalInput(course.publishAt),
    expireAt: toLocalInput(course.expireAt),
  };
}

export function settingsOf(draft: CourseDraft) {
  return {
    classCode: draft.classCode.trim().toUpperCase(),
    lecturerId: draft.lecturerId || null,
    lecturerName: draft.lecturerId ? draft.lecturerName : null,
    minGroupSize: draft.minGroupSize,
    maxGroupSize: draft.maxGroupSize,
    roomFactor: draft.roomFactor,
    publishAt: fromLocalInput(draft.publishAt),
    expireAt: fromLocalInput(draft.expireAt),
  };
}

export function settingsFor(course: Pick<Course, "publishAt" | "expireAt">, draft: CourseDraft) {
  return {
    ...settingsOf(draft),
    publishAt: draft.publishAt === toLocalInput(course.publishAt) ? course.publishAt : fromLocalInput(draft.publishAt),
    expireAt: draft.expireAt === toLocalInput(course.expireAt) ? course.expireAt : fromLocalInput(draft.expireAt),
  };
}

export function expectedRooms(students: number, maxGroupSize: number, roomFactor: number): number {
  return students === 0 || maxGroupSize <= 0 ? 0 : Math.ceil((students * roomFactor) / maxGroupSize - 1e-9);
}

export function draftChanged(first: CourseDraft, second: CourseDraft): boolean {
  return (Object.keys(first) as (keyof CourseDraft)[]).some((key) => first[key] !== second[key]);
}

export function validateDraft(draft: CourseDraft, phase: CoursePhase, baseline: CourseDraft): CourseFieldErrors {
  const errors: CourseFieldErrors = {};
  if (phase === "Setup") {
    if (draft.classCode.trim().length > maxClassCodeLength) {
      errors.classCode = `Lớp dài tối đa ${maxClassCodeLength} ký tự.`;
    }

    if (!(draft.minGroupSize >= 1 && draft.minGroupSize <= 50)) {
      errors.minGroupSize = "Số người tối thiểu từ 1 đến 50.";
    }

    if (!(draft.maxGroupSize >= 1 && draft.maxGroupSize <= 50)) {
      errors.maxGroupSize = "Số người tối đa từ 1 đến 50.";
    } else if (draft.maxGroupSize < draft.minGroupSize) {
      errors.maxGroupSize = "Số người tối đa không được nhỏ hơn tối thiểu.";
    }

    if (!(draft.roomFactor >= 1 && draft.roomFactor <= 9.99)) {
      errors.roomFactor = "Hệ số phòng từ 1,00 đến 9,99.";
    }

    if (draft.publishAt && draft.expireAt && draft.expireAt <= draft.publishAt) {
      errors.expireAt = "Hạn tìm nhóm phải sau lúc mở.";
    }
  }

  if (phase === "Published" && draft.expireAt !== baseline.expireAt && (!draft.expireAt || draft.expireAt <= baseline.expireAt)) {
    errors.expireAt = "Khi lớp đang mở, hạn chỉ được dời về sau.";
  }

  return errors;
}

const serverFieldTexts: Partial<Record<keyof CourseDraft, string>> = {
  classCode: "Mã lớp chỉ gồm chữ, số, dấu chấm, gạch và bắt đầu bằng chữ hoặc số.",
  minGroupSize: "Số người tối thiểu từ 1 đến 50.",
  maxGroupSize: "Số người tối đa từ 1 đến 50.",
  roomFactor: "Hệ số phòng từ 1,00 đến 9,99.",
  expireAt: "Hạn đã qua, hãy dời về sau.",
};

export function courseFieldErrors(error: unknown): CourseFieldErrors {
  if (!(error instanceof ApiError)) {
    return {};
  }

  if (error.code === "COURSE_CLASS_TAKEN") {
    return { classCode: courseErrorText(error) };
  }

  if (error.code === "COURSE_SCHEDULE_LOCKED") {
    return { expireAt: courseErrorText(error) };
  }

  const errors: CourseFieldErrors = {};
  for (const item of error.errors) {
    const field = item.field ? ((item.field[0]!.toLowerCase() + item.field.slice(1)) as keyof CourseDraft) : null;
    const text = field ? serverFieldTexts[field] : undefined;
    if (field && text) {
      errors[field] = text;
    }
  }

  return errors;
}

export function stuckInSetup(course: Pick<Course, "phase" | "publishAt" | "expireAt">, now: number = Date.now()): boolean {
  return course.phase === "Setup" && course.publishAt !== null && course.expireAt !== null && Date.parse(course.publishAt) <= now && Date.parse(course.expireAt) <= now;
}
