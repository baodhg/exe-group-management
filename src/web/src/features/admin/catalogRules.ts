import { ApiError } from "../../shared/api/apiClient";

export const badCodeText = "Mã chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang, và bắt đầu bằng chữ hoặc số.";

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export interface CatalogCodeChecks {
  startsWell: boolean;
  onlyAllowed: boolean;
  shortEnough: boolean;
  patternBad: boolean;
  usable: boolean;
}

export function catalogCodeChecks(value: string, max: number): CatalogCodeChecks {
  const code = value.trim();
  const startsWell = /^[A-Za-z0-9]/.test(code);
  const onlyAllowed = /^[A-Za-z0-9._-]*$/.test(code);
  const shortEnough = code.length <= max;
  const patternBad = code !== "" && !(startsWell && onlyAllowed);
  return { startsWell, onlyAllowed, shortEnough, patternBad, usable: code !== "" && !patternBad && shortEnough };
}

export function numberInRange(value: string, min: number, max: number): boolean {
  const number = Number(value);
  return value.trim() !== "" && Number.isInteger(number) && number >= min && number <= max;
}

export function errorCodeOf(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

export function deleteRefused(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code !== null && (code.endsWith("_IN_USE") || code === "STUDENT_ENROLLED");
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function isAccessFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

export function clampPage(page: number, totalPages: number): number {
  return Math.min(page, Math.max(totalPages, 1));
}
