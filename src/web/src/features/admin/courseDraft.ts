import type { Course } from "../common/types";

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
    classCode: draft.classCode.trim(),
    lecturerId: draft.lecturerId || null,
    lecturerName: draft.lecturerId ? draft.lecturerName : null,
    minGroupSize: draft.minGroupSize,
    maxGroupSize: draft.maxGroupSize,
    roomFactor: draft.roomFactor,
    publishAt: fromLocalInput(draft.publishAt),
    expireAt: fromLocalInput(draft.expireAt),
  };
}

export function expectedRooms(students: number, maxGroupSize: number, roomFactor: number): number {
  return students === 0 || maxGroupSize <= 0 ? 0 : Math.ceil((students * roomFactor) / maxGroupSize - 1e-9);
}
