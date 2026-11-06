import type { CoursePhase } from "../common/types";

export function deadlinePassed(expireAt: string | null, now: number = Date.now()): boolean {
  return expireAt !== null && Date.parse(expireAt) <= now;
}

export function deadlineReached(phase: CoursePhase, expireAt: string | null, now: number = Date.now()): boolean {
  return phase === "Published" && deadlinePassed(expireAt, now);
}

export function countdownText(expireAt: string | null, now: number = Date.now()): string | null {
  if (expireAt === null) {
    return null;
  }

  const left = Date.parse(expireAt) - now;
  if (left <= 0) {
    return null;
  }

  const hours = Math.floor(left / 3_600_000);
  if (hours < 1) {
    return `${Math.max(Math.ceil(left / 60_000), 1)} phút`;
  }

  return hours < 24 ? `${hours} giờ` : `${Math.floor(hours / 24)} ngày ${hours % 24} giờ`;
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
