import { toast } from "sonner";
import { ApiError } from "../../shared/api/apiClient";
import { errorText } from "../common/messages";

export const courseErrorText = errorText;

export function errorTraceText(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  return error.traceId ? `Mã lỗi ${error.code}, mã tra cứu ${error.traceId}` : `Mã lỗi ${error.code}`;
}

export function failureToast(error: unknown, description?: string | null) {
  toast.error(courseErrorText(error), { description: description ?? errorTraceText(error) ?? undefined });
}
