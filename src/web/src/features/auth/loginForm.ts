import { ApiError } from "../../shared/api/apiClient";
import { errorText, signInErrorText } from "../common/messages";

export interface LoginFailure {
  message: string;
  credentialsRejected: boolean;
}

export interface LoginFieldErrors {
  email: string | null;
  password: string | null;
}

export const nothingMissing: LoginFieldErrors = { email: null, password: null };

export const sessionEndedText = errorText(new ApiError(401, "", [{ code: "UNAUTHORIZED", field: null, message: "" }], null));

export function loginFailureOf(error: unknown): LoginFailure {
  return { message: signInErrorText(error), credentialsRejected: error instanceof ApiError && error.status === 401 };
}

export function missingFieldsOf(email: string, password: string): LoginFieldErrors {
  return { email: email.trim() ? null : "Hãy nhập email.", password: password ? null : "Hãy nhập mật khẩu." };
}

export function cameFromGuardedRoute(state: unknown): boolean {
  if (typeof state !== "object" || state === null || !("from" in state)) {
    return false;
  }

  return typeof state.from === "string" && state.from.length > 0;
}
