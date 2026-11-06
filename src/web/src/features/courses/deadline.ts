import type { CoursePhase } from "../common/types";

export function deadlinePassed(expireAt: string | null, now: number = Date.now()): boolean {
  return expireAt !== null && Date.parse(expireAt) <= now;
}

export function deadlineReached(phase: CoursePhase, expireAt: string | null, now: number = Date.now()): boolean {
  return phase === "Published" && deadlinePassed(expireAt, now);
}

const closingRefreshMs = 20_000;
const phaseRefreshMs = 60_000;

export function courseRefreshMs(course: { phase: CoursePhase; expireAt: string | null }, now: number = Date.now()): number | false {
  if (course.phase === "Finalized") {
    return false;
  }

  return deadlineReached(course.phase, course.expireAt, now) ? closingRefreshMs : phaseRefreshMs;
}

export function countdownText(expireAt: string | null, now: number = Date.now()): string | null {
  if (expireAt === null) {
    return null;
  }

  const left = Date.parse(expireAt) - now;
  if (left <= 0) {
    return null;
  }

  const minutes = Math.ceil(left / 60_000);
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const rest = minutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  }

  if (hours > 0) {
    return rest > 0 ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
  }

  return `${rest} phút`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function shortDateTime(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
