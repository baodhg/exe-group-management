import { ApiError } from "../../shared/api/apiClient";

export const passwordMin = 8;
export const passwordMax = 100;
export const fullNameMax = 150;

export function passwordLengthOk(password: string): boolean {
  return password.length >= passwordMin && password.length <= passwordMax;
}

export function wrongCurrentPassword(error: unknown): boolean {
  return error instanceof ApiError && error.errors.some((item) => item.field === "currentPassword");
}

export function canSaveName(draft: string, saved: string): boolean {
  const name = draft.trim();
  return name !== "" && draft.length <= fullNameMax && name !== saved;
}
